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
export async function processImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Expected a 'file' field." });
      return;
    }

    const rawCsvText = req.file.buffer.toString("utf-8");
    const rawRows = parseCsv(rawCsvText);

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
