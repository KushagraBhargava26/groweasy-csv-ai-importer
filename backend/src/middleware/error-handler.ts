import { Request, Response, NextFunction } from "express";
import { CsvParseError } from "../services/csv-parser.service";
import { AiExtractionError } from "../services/ai-extraction.service";
import { logger } from "../utils/logger";

/**
 * Express error-handling middleware. Must have exactly 4 parameters
 * (err, req, res, next) — that specific signature is how Express
 * identifies this as error middleware rather than regular middleware.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  logger.error("Request failed", {
    path: req.path,
    method: req.method,
    error: err instanceof Error ? err.message : String(err),
  });

  if (err instanceof CsvParseError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof Error && err.message === "Only .csv files are accepted") {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof AiExtractionError) {
    if (err.kind === "QUOTA_EXCEEDED") {
      res.status(429).json({
        error: "AI service rate limit exceeded. Please wait a moment and try again.",
      });
      return;
    }
    if (err.kind === "MALFORMED_RESPONSE") {
      res.status(502).json({
        error: "AI service returned an unexpected response. Please try again.",
      });
      return;
    }
    res.status(502).json({
      error: "AI service call failed. Please try again.",
    });
    return;
  }

  // Anything unrecognized: 500, and a generic message — never leak raw
  // internal error details (stack traces, API keys in error strings) to
  // the client in the response body. Full details already went to the log above.
  res.status(500).json({ error: "An unexpected error occurred while processing your request." });
}
