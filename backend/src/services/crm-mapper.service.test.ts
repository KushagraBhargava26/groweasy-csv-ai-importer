import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { runCrmImportPipeline } from "./crm-mapper.service";
import { RawCsvRow, CrmRecord, SkippedRow } from "../types/crm-record";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// A lightweight duplicate of the real AiExtractionError class — NOT the
// real ai-extraction.service.ts, which throws at import time without a
// GEMINI_API_KEY and constructs a real GoogleGenAI client. crm-mapper's
// `instanceof AiExtractionError` and `.kind` checks work correctly here
// because crm-mapper imports AiExtractionError from this same mocked
// module path, so it's always comparing against OUR class.
vi.mock("./ai-extraction.service", () => {
  class AiExtractionError extends Error {
    batchIndex: number;
    kind: "QUOTA_EXCEEDED" | "MALFORMED_RESPONSE" | "API_ERROR";
    constructor(message: string, batchIndex: number, kind: "QUOTA_EXCEEDED" | "MALFORMED_RESPONSE" | "API_ERROR" = "API_ERROR") {
      super(message);
      this.name = "AiExtractionError";
      this.batchIndex = batchIndex;
      this.kind = kind;
    }
  }
  return { extractBatch: vi.fn(), AiExtractionError };
});

vi.mock("./validation.service", () => ({
  validateAiOutput: vi.fn(),
}));

import { extractBatch, AiExtractionError } from "./ai-extraction.service";
import { validateAiOutput } from "./validation.service";

const extractBatchMock = extractBatch as unknown as Mock;
const validateAiOutputMock = validateAiOutput as unknown as Mock;

function makeRows(count: number): RawCsvRow[] {
  return Array.from({ length: count }, (_, i) => ({
    Name: `Person ${i}`,
    Email: `person${i}@test.com`,
  }));
}

function makeCrmRecord(rowId: string): CrmRecord {
  return { name: `Person ${rowId}`, email: `person${rowId}@test.com` };
}

beforeEach(() => {
  vi.useFakeTimers();
  extractBatchMock.mockReset();
  validateAiOutputMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runCrmImportPipeline", () => {
  it("processes a single successful batch and reports correct totals", async () => {
    const rows = makeRows(2);

    extractBatchMock.mockResolvedValueOnce([{ _row_id: "0" }, { _row_id: "1" }]);
    validateAiOutputMock.mockReturnValueOnce({
      kept: [makeCrmRecord("0"), makeCrmRecord("1")],
      skipped: [] as SkippedRow[],
      unmatchedIds: [] as string[],
    });

    const onBatchComplete = vi.fn();
    const result = await runCrmImportPipeline(rows, 2, onBatchComplete);

    expect(result.totalImported).toBe(2);
    expect(result.totalSkipped).toBe(0);
    expect(result.batchesProcessed).toBe(1);
    expect(result.batchesFailed).toBe(0);
    expect(onBatchComplete).toHaveBeenCalledWith(1, 1, 2, 0);
  });

  it("processes multiple batches sequentially with a rate-limit delay between them", async () => {
    const rows = makeRows(4);

    extractBatchMock
      .mockResolvedValueOnce([{ _row_id: "0" }, { _row_id: "1" }])
      .mockResolvedValueOnce([{ _row_id: "2" }, { _row_id: "3" }]);

    validateAiOutputMock
      .mockReturnValueOnce({ kept: [makeCrmRecord("0"), makeCrmRecord("1")], skipped: [], unmatchedIds: [] })
      .mockReturnValueOnce({ kept: [makeCrmRecord("2")], skipped: [{ originalRow: {}, reason: "test skip" }], unmatchedIds: [] });

    const onBatchComplete = vi.fn();
    const resultPromise = runCrmImportPipeline(rows, 2, onBatchComplete);

    // Batch 0 resolves near-instantly; the pipeline then awaits the
    // 4.2s rate-limit delay before starting batch 1.
    await vi.advanceTimersByTimeAsync(4200);
    const result = await resultPromise;

    expect(extractBatchMock).toHaveBeenCalledTimes(2);
    expect(result.batchesProcessed).toBe(2);
    expect(result.totalImported).toBe(3);
    expect(result.totalSkipped).toBe(1);
    expect(onBatchComplete).toHaveBeenNthCalledWith(1, 1, 2, 2, 0);
    expect(onBatchComplete).toHaveBeenNthCalledWith(2, 2, 2, 3, 1);
  });

  it("marks a batch as failed after exhausting generic retries, and strips _row_id from skipped rows", async () => {
    const rows = makeRows(2);
    extractBatchMock.mockRejectedValue(new AiExtractionError("simulated failure", 0, "API_ERROR"));

    const resultPromise = runCrmImportPipeline(rows, 2);

    // MAX_RETRIES = 2 → 3 total attempts, with delays of 500ms then 1000ms
    // between them (RETRY_BASE_DELAY_MS * attempt).
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(extractBatchMock).toHaveBeenCalledTimes(3);
    expect(result.batchesFailed).toBe(1);
    expect(result.batchesProcessed).toBe(0);
    expect(result.totalSkipped).toBe(2);
    expect(result.skipped[0].reason).toBe("AI extraction failed for this batch after retries");
    expect(result.skipped[0].originalRow).not.toHaveProperty("_row_id");
  });

  it("fails fast on a 400 error without retrying", async () => {
    const rows = makeRows(2);
    extractBatchMock.mockRejectedValue(new AiExtractionError("Batch 0: ... 400 Bad Request", 0, "API_ERROR"));

    const result = await runCrmImportPipeline(rows, 2);

    // No fake-timer advancement needed — a 400 should break immediately,
    // with no delay ever awaited before giving up.
    expect(extractBatchMock).toHaveBeenCalledTimes(1);
    expect(result.batchesFailed).toBe(1);
  });

  it("retries quota errors patiently and succeeds once the quota clears", async () => {
    const rows = makeRows(2);
    extractBatchMock
      .mockRejectedValueOnce(new AiExtractionError("quota 1", 0, "QUOTA_EXCEEDED"))
      .mockRejectedValueOnce(new AiExtractionError("quota 2", 0, "QUOTA_EXCEEDED"))
      .mockResolvedValueOnce([{ _row_id: "0" }, { _row_id: "1" }]);

    validateAiOutputMock.mockReturnValueOnce({
      kept: [makeCrmRecord("0"), makeCrmRecord("1")],
      skipped: [],
      unmatchedIds: [],
    });

    const resultPromise = runCrmImportPipeline(rows, 2);

    // QUOTA_RETRY_DELAY_MS = 10s, two quota failures before success.
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;

    expect(extractBatchMock).toHaveBeenCalledTimes(3);
    expect(result.batchesProcessed).toBe(1);
    expect(result.totalImported).toBe(2);
  });

  it("gives up after MAX_QUOTA_RETRIES consecutive quota errors", async () => {
    const rows = makeRows(2);
    extractBatchMock.mockRejectedValue(new AiExtractionError("always quota-exceeded", 0, "QUOTA_EXCEEDED"));

    const resultPromise = runCrmImportPipeline(rows, 2);

    // MAX_QUOTA_RETRIES = 8 → 9 total attempts, 8 delays of 10s each
    // between them before giving up on the 9th.
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
    }
    const result = await resultPromise;

    expect(extractBatchMock).toHaveBeenCalledTimes(9);
    expect(result.batchesFailed).toBe(1);
  });

  it("adds unmatched row ids to skipped with the correct reason and original row content", async () => {
    const rows = makeRows(3);
    extractBatchMock.mockResolvedValueOnce([{ _row_id: "0" }, { _row_id: "2" }]);

    // Row "1" never appears in the AI's output at all — the expected
    // shape when the AI correctly omits a no-contact-info row per the
    // skip rule, rather than returning a malformed record for it.
    validateAiOutputMock.mockReturnValueOnce({
      kept: [makeCrmRecord("0"), makeCrmRecord("2")],
      skipped: [],
      unmatchedIds: ["1"],
    });

    const result = await runCrmImportPipeline(rows, 3);

    expect(result.totalSkipped).toBe(1);
    expect(result.skipped[0].reason).toBe(
      "No email or mobile number found — omitted by AI per import rules"
    );
    expect(result.skipped[0].originalRow).toEqual({ Name: "Person 1", Email: "person1@test.com" });
  });
});