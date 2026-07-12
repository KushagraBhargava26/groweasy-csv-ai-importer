import { Request, Response, NextFunction } from "express";
import { parseCsv } from "../services/csv-parser.service";
import { runCrmImportPipeline } from "../services/crm-mapper.service";
import { createBatches, DEFAULT_BATCH_SIZE } from "../services/batching.service";
import { createJob, updateJob, getJob } from "../services/job-store.service";
import { logger } from "../utils/logger";

/**
 * POST /api/import/process
 * Now runs as a background job instead of blocking the request: parses
 * the CSV, creates a job, kicks off processing WITHOUT awaiting it, and
 * returns the jobId immediately. The row-count cap is gone — the old
 * limit existed only because a single synchronous request couldn't
 * survive a big file's total processing time. That constraint no longer
 * applies once processing happens outside the request/response cycle.
 * The client polls GET /api/import/status/:jobId for progress and the
 * final result.
 */
export async function processImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Expected a 'file' field." });
      return;
    }

    const rawCsvText = req.file.buffer.toString("utf-8");
    const rawRows = parseCsv(rawCsvText);
    const batchCount = createBatches(rawRows, DEFAULT_BATCH_SIZE).length;

    const job = createJob(req.file.originalname, rawRows.length, batchCount);

    logger.info("Starting background import job", {
      jobId: job.id,
      fileName: req.file.originalname,
      rowCount: rawRows.length,
      batchCount,
    });

    // Deliberately not awaited — this is the whole point. The request
    // returns immediately; processing continues after the response
    // has already been sent.
    runImportInBackground(job.id, rawRows);

    res.status(202).json({ jobId: job.id });
  } catch (err) {
    next(err);
  }
}

async function runImportInBackground(jobId: string, rawRows: Awaited<ReturnType<typeof parseCsv>>): Promise<void> {
  updateJob(jobId, { status: "processing" });

  try {
    const result = await runCrmImportPipeline(rawRows, DEFAULT_BATCH_SIZE, (batchesCompleted, totalBatches) => {
      updateJob(jobId, { batchesCompleted, totalBatches });
    });
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
 * Returns the current state of a background import job: still processing
 * (with progress), completed (with the full ImportResult), failed (with
 * an error message), or 404 if the jobId is unknown or has expired.
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
    result: job.result,
    error: job.error,
  });
}

const SAMPLE_SIZE = 5;

/**
 * POST /api/import/preview-mapping
 * Runs the REAL AI extraction pipeline, but only on the first few rows,
 * synchronously — small enough to stay well within a normal request/
 * response cycle, unlike the full-file job which runs in the background.
 * This powers the "AI Mapping" review step: the user sees actual mapped
 * output before committing to processing the entire file.
 */
export async function previewMapping(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Expected a 'file' field." });
      return;
    }

    const rawCsvText = req.file.buffer.toString("utf-8");
    const rawRows = parseCsv(rawCsvText);
    const sampleRows = rawRows.slice(0, SAMPLE_SIZE);

    logger.info("Running AI mapping preview on sample", {
      fileName: req.file.originalname,
      totalRows: rawRows.length,
      sampleSize: sampleRows.length,
    });

    // Reuses the exact same pipeline as the real import — same prompt,
    // same schema, same validation — just on a handful of rows so it's
    // genuinely representative of what the full run will produce, not a
    // simplified or faked preview.
    const sampleResult = await runCrmImportPipeline(sampleRows, sampleRows.length);

    res.status(200).json({
      totalRows: rawRows.length,
      sampleResult,
    });
  } catch (err) {
    next(err);
  }
}