import { RawCsvRow } from "../types/crm-record";
import { logger } from "../utils/logger";

// Rows per Gemini call. Chosen as a balance: small enough that the model
// doesn't start dropping/merging rows in a long response, large enough
// that we're not making an excessive number of API calls for a big CSV.
// Kept as a named constant (not buried inline) so it's the one place to
// tune if testing shows accuracy dropping at this size.
export const DEFAULT_BATCH_SIZE = 20;

export interface Batch {
  batchIndex: number;
  rows: RawCsvRow[];
}

/**
 * Splits rows into fixed-size batches for AI processing.
 * Pure function — no I/O, no AI calls — so it's trivial to unit test
 * with plain arrays and assert on batch count/sizes.
 */
export function createBatches(rows: RawCsvRow[], batchSize: number = DEFAULT_BATCH_SIZE): Batch[] {
  if (batchSize <= 0) {
    throw new Error("batchSize must be a positive number");
  }

  const batches: Batch[] = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push({
      batchIndex: batches.length,
      rows: rows.slice(i, i + batchSize),
    });
  }

  logger.info("Rows split into batches", {
    totalRows: rows.length,
    batchSize,
    batchCount: batches.length,
  });

  return batches;
}
