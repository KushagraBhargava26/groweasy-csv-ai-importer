import { Request, Response, NextFunction } from "express";
import { parseCsv } from "../services/csv-parser.service";
import { listSheetNames, parseXlsxSheet, XlsxParseError } from "../services/xlsx-parser.service";
import { runCrmImportPipeline } from "../services/crm-mapper.service";
import { createBatches, DEFAULT_BATCH_SIZE } from "../services/batching.service";
import { createJob, updateJob, getJob } from "../services/job-store.service";
import { RawCsvRow } from "../types/crm-record";
import { logger } from "../utils/logger";

const XLSX_MIMETYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isXlsxFile(file: Express.Multer.File): boolean {
  return file.mimetype === XLSX_MIMETYPE || file.originalname.toLowerCase().endsWith(".xlsx");
}

/**
 * Parses an uploaded file into RawCsvRow[] regardless of whether it's a
 * .csv or .xlsx file — this is the one place that branches by format;
 * everything downstream (batching, AI extraction, validation) stays
 * completely format-agnostic. For xlsx files, sheetName is required
 * (the frontend must have already called /xlsx-sheets and let the user
 * pick one — there's no silent "just use the first sheet" fallback,
 * since that could quietly import the wrong data on a multi-sheet file).
 */
async function parseUploadedFile(file: Express.Multer.File, sheetName?: string): Promise<RawCsvRow[]> {
  if (isXlsxFile(file)) {
    if (!sheetName) {
      throw new XlsxParseError("This is an Excel file — a 'sheetName' field is required to select which sheet to import.");
    }
    return parseXlsxSheet(file.buffer, sheetName);
  }

  const rawCsvText = file.buffer.toString("utf-8");
  return parseCsv(rawCsvText);
}

/**
 * POST /api/import/process
 * Runs as a background job: parses the file (CSV or Excel), creates a
 * job, kicks off processing WITHOUT awaiting it, and returns the jobId
 * immediately. The client polls GET /api/import/status/:jobId for
 * progress and the final result.
 */
export async function processImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Expected a 'file' field." });
      return;
    }

    const sheetName = typeof req.body.sheetName === "string" ? req.body.sheetName : undefined;
    const rawRows = await parseUploadedFile(req.file, sheetName);
    const batchCount = createBatches(rawRows, DEFAULT_BATCH_SIZE).length;

    const job = createJob(req.file.originalname, rawRows.length, batchCount);

    logger.info("Starting background import job", {
      jobId: job.id,
      fileName: req.file.originalname,
      sheetName,
      rowCount: rawRows.length,
      batchCount,
    });

    // Deliberately not awaited — this is the whole point. The request
    // returns immediately; processing continues after the response
    // has already been sent.
    runImportInBackground(job.id, rawRows);

    res.status(202).json({ jobId: job.id });
  } catch (err) {
    if (err instanceof XlsxParseError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
}

async function runImportInBackground(jobId: string, rawRows: RawCsvRow[]): Promise<void> {
  updateJob(jobId, { status: "processing" });

  try {
    const result = await runCrmImportPipeline(
      rawRows,
      DEFAULT_BATCH_SIZE,
      (batchesCompleted, totalBatches, importedSoFar, skippedSoFar) => {
        updateJob(jobId, { batchesCompleted, totalBatches, importedSoFar, skippedSoFar });
      },
    );
    updateJob(jobId, { status: "completed", result });
  } catch (err) {
    logger.error("Background import job failed", {
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
    updateJob(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Import failed for an unknown reason.",
    });
  }
}

/**
 * GET /api/import/status/:jobId
 */
export function getImportStatus(req: Request, res: Response): void {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Import job not found. It may have expired or the ID is incorrect." });
    return;
  }

  res.status(200).json({
    status: job.status,
    totalRows: job.totalRows,
    totalBatches: job.totalBatches,
    batchesCompleted: job.batchesCompleted,
    importedSoFar: job.importedSoFar,
    skippedSoFar: job.skippedSoFar,
    result: job.result,
    error: job.error,
  });
}

const SAMPLE_SIZE = 5;

/**
 * POST /api/import/preview-mapping
 * Runs the REAL AI extraction pipeline, but only on the first few rows,
 * synchronously. Now format-aware (CSV or Excel) via the same
 * parseUploadedFile() helper processImport uses.
 */
export async function previewMapping(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Expected a 'file' field." });
      return;
    }

    const sheetName = typeof req.body.sheetName === "string" ? req.body.sheetName : undefined;
    const rawRows = await parseUploadedFile(req.file, sheetName);
    const sampleRows = rawRows.slice(0, SAMPLE_SIZE);

    logger.info("Running AI mapping preview on sample", {
      fileName: req.file.originalname,
      sheetName,
      totalRows: rawRows.length,
      sampleSize: sampleRows.length,
    });

    const sampleResult = await runCrmImportPipeline(sampleRows, sampleRows.length);

    res.status(200).json({
      totalRows: rawRows.length,
      sampleResult,
    });
  } catch (err) {
    if (err instanceof XlsxParseError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
}

/**
 * POST /api/import/xlsx-sheets
 * Cheap, sheet-names-only endpoint — lets the frontend show a sheet
 * picker for multi-sheet workbooks before committing to a specific one.
 */
export async function listXlsxSheets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Expected a 'file' field." });
      return;
    }

    const sheetNames = await listSheetNames(req.file.buffer);

    res.status(200).json({ sheetNames });
  } catch (err) {
    if (err instanceof XlsxParseError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
}
