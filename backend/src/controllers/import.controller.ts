import { Request, Response, NextFunction } from "express";
import { parseCsv } from "../services/csv-parser.service";
import { runCrmImportPipeline } from "../services/crm-mapper.service";
import { logger } from "../utils/logger";

/**
 * POST /api/import/process
 * Expects a multipart/form-data request with a single file field named "file".
 * Wrapped so any thrown error (from parseCsv, from the AI pipeline, from
 * anywhere) is forwarded to Express's error-handling middleware via next(),
 * rather than crashing the process or leaving the request hanging.
 */
// AI extraction hits Gemini's free-tier rate limit (15 requests/minute),
// and batches are processed concurrently — so above a certain row count,
// the request simply cannot finish inside a serverless function's timeout
// window, no matter how the code is optimized. 300 rows (~15 batches at
// the default batch size of 20) is a safe ceiling that comfortably fits.
const MAX_IMPORT_ROWS = 300;

export async function processImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Expected a 'file' field." });
      return;
    }

    const rawCsvText = req.file.buffer.toString("utf-8");
    const rawRows = parseCsv(rawCsvText);

    if (rawRows.length > MAX_IMPORT_ROWS) {
      logger.warn("Rejected import: file exceeds row limit", {
        fileName: req.file.originalname,
        rowCount: rawRows.length,
        maxAllowed: MAX_IMPORT_ROWS,
      });
      res.status(413).json({
        error: `This file has ${rawRows.length} rows, which exceeds the current limit of ${MAX_IMPORT_ROWS} rows per import. Please split it into smaller files and import them separately.`,
      });
      return;
    }

    logger.info("Starting import pipeline", {
      fileName: req.file.originalname,
      rowCount: rawRows.length,
    });

    const result = await runCrmImportPipeline(rawRows);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
