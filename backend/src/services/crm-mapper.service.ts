import { RawCsvRow, CrmRecord, SkippedRow, ImportResult } from "../types/crm-record";
import { createBatches, DEFAULT_BATCH_SIZE, Batch } from "./batching.service";
import { extractBatch, AiExtractionError } from "./ai-extraction.service";
import { validateAiOutput } from "./validation.service";
import { logger } from "../utils/logger";

const ROW_ID_KEY = "_row_id";
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

/**
 * Tags every row with a stable, unique identifier before it goes anywhere
 * near the AI. This is the fix for the index-alignment problem: since the
 * AI is instructed to OMIT skipped rows from its output entirely (not mark
 * them), the AI's output array can never safely be matched back to the
 * input array by position. An explicit id the AI must echo back removes
 * that assumption completely.
 */
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

/**
 * Wraps extractBatch with a simple retry-with-backoff. A single flaky
 * Gemini call (rate limit, transient network error) shouldn't mean every
 * row in that batch gets dropped from the import.
 */
// Quota errors (429) are temporary and self-resolving — the correct
// response is to wait it out and try again, not give up. Since this
// runs as a background job with no request timeout to race against,
// we can afford to retry quota errors patiently and for much longer
// than genuine errors (malformed response, etc.), which DO deserve a
// quick give-up since more time won't fix a real bug.
const MAX_QUOTA_RETRIES = 8;
const QUOTA_RETRY_DELAY_MS = 10_000;

async function extractBatchWithRetry(batch: Batch): Promise<unknown[]> {
  let lastError: unknown;
  let quotaAttempts = 0;
  let attempt = 0;

  while (true) {
    try {
      return await extractBatch(batch);
    } catch (err) {
      lastError = err;
      const isQuotaError = err instanceof AiExtractionError && err.kind === "QUOTA_EXCEEDED";

      if (isQuotaError) {
        quotaAttempts++;
        if (quotaAttempts > MAX_QUOTA_RETRIES) break;
        logger.warn("Batch hit quota limit, waiting before retry", {
          batchIndex: batch.batchIndex,
          quotaAttempt: quotaAttempts,
          maxQuotaRetries: MAX_QUOTA_RETRIES,
        });
        await delay(QUOTA_RETRY_DELAY_MS);
        continue;
      }

      attempt++;
      logger.warn("Batch extraction attempt failed", {
        batchIndex: batch.batchIndex,
        attempt,
        maxRetries: MAX_RETRIES,
      });
      if (attempt > MAX_RETRIES) break;
      await delay(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

/**
 * The full pipeline: raw parsed CSV rows in, a complete ImportResult out.
 * This is the single function the controller layer calls.
 */
// Gemini's free tier caps at 15 requests/minute. Firing every batch
// concurrently (the old Promise.allSettled approach) blows past that
// almost immediately on anything but a tiny file. Processing batches
// ONE AT A TIME with a fixed delay between calls keeps us safely under
// the limit regardless of file size — the tradeoff is throughput
// (~14 batches/minute) instead of speed, which is the right tradeoff
// for staying on the free tier. See RATE_LIMIT_INTERVAL_MS below.
const RATE_LIMIT_INTERVAL_MS = 4200; // ~14.3 requests/minute, safely under the 15 RPM cap

export async function runCrmImportPipeline(
  rawRows: RawCsvRow[],
  batchSize: number = DEFAULT_BATCH_SIZE,
  onBatchComplete?: (batchesCompleted: number, totalBatches: number) => void,
): Promise<ImportResult> {
  const taggedRows = tagRowsWithId(rawRows);
  const batches = createBatches(taggedRows, batchSize);

  const imported: CrmRecord[] = [];
  const skipped: SkippedRow[] = [];
  let batchesProcessed = 0;
  let batchesFailed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    const result = await (async () => {
      try {
        const value = await extractBatchWithRetry(batch);
        return { status: "fulfilled" as const, value };
      } catch (reason) {
        return { status: "rejected" as const, reason };
      }
    })();

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
      continue;
    }

    batchesProcessed++;

    const rowById = new Map<string, RawCsvRow>();
    batch.rows.forEach((row) => {
      rowById.set(row[ROW_ID_KEY], stripRowId(row));
    });

    const { kept, skipped: skippedInBatch, unmatchedIds } = validateAiOutput(result.value, rowById);

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

    onBatchComplete?.(i + 1, batches.length);

    // Only wait between batches, not after the last one.
    if (i < batches.length - 1) {
      await delay(RATE_LIMIT_INTERVAL_MS);
    }
  }

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
