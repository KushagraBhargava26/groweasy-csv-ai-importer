import { RawCsvRow, CrmRecord, SkippedRow, ImportResult } from "../types/crm-record";
import { createBatches, DEFAULT_BATCH_SIZE, Batch } from "./batching.service";
import { extractBatch } from "./ai-extraction.service";
import { validateAiOutput } from "./validation.service";
import { logger } from "../utils/logger";

const ROW_ID_KEY = "_row_id";
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

function tagRowsWithId(rows: RawCsvRow[]): RawCsvRow[] {
  return rows.map((row, index) => ({
    ...row,
    [ROW_ID_KEY]: String(index),
  }));
}

function stripRowId(row: RawCsvRow): RawCsvRow {
  const { [ROW_ID_KEY]: _discard, ...rest } = row;
  return rest;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractBatchWithRetry(batch: Batch): Promise<unknown[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await extractBatch(batch);
    } catch (err) {
      lastError = err;
      logger.warn("Batch extraction attempt failed", {
        batchIndex: batch.batchIndex,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
      });
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError;
}

/**
 * REVERTED from the concurrency-limited version: capping concurrency to 4
 * with short retry backoff made things WORSE (73/100 batches permanently
 * failed on a real run, vs 0 failures — just slow — when firing everything
 * at once). Likely cause: a worker hitting a rate limit, backing off only
 * 500-1000ms, exhausting its 2 retries, and immediately grabbing the next
 * batch into that same slot — hammering the API in a tight loop instead of
 * genuinely backing off. Firing all batches at once and letting the
 * existing retry-with-backoff sort itself out organically over ~20 minutes
 * was slower but reliably reached 100% success. Back to that.
 */
export async function runCrmImportPipeline(
  rawRows: RawCsvRow[],
  batchSize: number = DEFAULT_BATCH_SIZE,
  onProgress?: (batchesCompleted: number, totalBatches: number) => void
): Promise<ImportResult> {
  const taggedRows = tagRowsWithId(rawRows);
  const batches = createBatches(taggedRows, batchSize);

  const imported: CrmRecord[] = [];
  const skipped: SkippedRow[] = [];
  let batchesProcessed = 0;
  let batchesFailed = 0;
  let batchesCompleted = 0;

  const results = await Promise.allSettled(
    batches.map(async (batch) => {
      const result = await extractBatchWithRetry(batch);
      batchesCompleted++;
      onProgress?.(batchesCompleted, batches.length);
      return result;
    })
  );

  results.forEach((result, i) => {
    const batch = batches[i];

    if (result.status === "rejected") {
      batchesFailed++;
      batchesCompleted++;
      onProgress?.(batchesCompleted, batches.length);
      logger.error("Batch failed after all retries — skipping its rows", {
        batchIndex: batch.batchIndex,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      batch.rows.forEach((row) => {
        skipped.push({
          originalRow: stripRowId(row),
          reason: "AI extraction failed for this batch after retries",
        });
      });
      return;
    }

    batchesProcessed++;

    const rowById = new Map<string, RawCsvRow>();
    batch.rows.forEach((row) => {
      rowById.set(row[ROW_ID_KEY], stripRowId(row));
    });

    const { kept, skipped: skippedInBatch, unmatchedIds } = validateAiOutput(
      result.value,
      rowById
    );

    imported.push(...kept);
    skipped.push(...skippedInBatch);

    unmatchedIds.forEach((id) => {
      const originalRow = rowById.get(id);
      if (originalRow) {
        skipped.push({
          originalRow,
          reason: "No email or mobile number found — omitted by AI per import rules",
        });
      }
    });
  });

  logger.info("CRM import pipeline complete", {
    totalRows: rawRows.length,
    totalImported: imported.length,
    totalSkipped: skipped.length,
    batchesProcessed,
    batchesFailed,
  });

  return {
    imported,
    skipped,
    totalImported: imported.length,
    totalSkipped: skipped.length,
    batchesProcessed,
    batchesFailed,
  };
}