import { RawCsvRow, CrmRecord, SkippedRow, ImportResult } from "../types/crm-record";
import { createBatches, DEFAULT_BATCH_SIZE, Batch } from "./batching.service";
import { extractBatch } from "./ai-extraction.service";
import { validateAiOutput } from "./validation.service";
import { logger } from "../utils/logger";

const ROW_ID_KEY = "_row_id";
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

// How many batches are allowed to be in flight against Gemini at once.
// Free-tier Gemini rate limits (roughly 10-15 requests/minute for
// flash-lite-class models) mean firing all batches simultaneously — e.g.
// 50 batches for a 1000-row file — causes most of them to get rate-limited
// immediately, fall through to retry-with-backoff, and only trickle through
// as the rate-limit window rolls over. Capping concurrency keeps us
// comfortably under the limit instead of relying on brute-force retries.
const MAX_CONCURRENT_BATCHES = 4;

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
 * Runs a list of async tasks with at most `limit` running concurrently,
 * preserving input order in the returned results (same contract as
 * Promise.allSettled, just throttled).
 *
 * onEachSettled fires after EVERY task settles — success or failure —
 * with a running count. This is what powers the job-store's live progress
 * (batchesCompleted / totalBatches), which the frontend polls to show
 * "X of Y batches processed." Without this callback firing incrementally,
 * the progress bar would just sit at 0% until the entire import finished,
 * same as before.
 */
async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  onEachSettled?: (completedCount: number, total: number) => void
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;
  let completedCount = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex++;
      try {
        const value = await tasks[currentIndex]();
        results[currentIndex] = { status: "fulfilled", value };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
      completedCount++;
      onEachSettled?.(completedCount, tasks.length);
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * The full pipeline: raw parsed CSV rows in, a complete ImportResult out.
 * onProgress is optional — the background job runner (import.controller.ts)
 * passes one in to update the job store as batches complete; a direct
 * synchronous caller (e.g. a test) can simply omit it.
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

  const results = await runWithConcurrencyLimit(
    batches.map((batch) => () => extractBatchWithRetry(batch)),
    MAX_CONCURRENT_BATCHES,
    onProgress
  );

  results.forEach((result, i) => {
    const batch = batches[i];

    if (result.status === "rejected") {
      batchesFailed++;
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