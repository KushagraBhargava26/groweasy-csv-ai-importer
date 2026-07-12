import { describe, it, expect, vi, beforeEach } from "vitest";
import { Batch } from "./batching.service";
import { extractBatch, AiExtractionError } from "./ai-extraction.service";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock the whole SDK. generateContent is a mock function we control
// per-test via mockResolvedValueOnce/mockRejectedValueOnce below.
// vi.hoisted() is required here: vi.mock() factories are hoisted above
// ALL other code in this file (including plain const declarations), so
// a normal `const mockGenerateContent = vi.fn()` above vi.mock() would
// still run AFTER the factory needs it, causing a "before initialization"
// error. vi.hoisted() hoists this value's creation right along with it.
const mockGenerateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { models: { generateContent: mockGenerateContent } };
  }),
  Type: { ARRAY: "ARRAY", OBJECT: "OBJECT", STRING: "STRING" },
  ThinkingLevel: { LOW: "LOW", MEDIUM: "MEDIUM" },
}));

vi.mock("../prompts/crm-extraction.prompt", () => ({
  buildCrmExtractionPrompt: () => "mock system instruction",
}));

function makeBatch(rowCount = 2): Batch {
  return {
    batchIndex: 0,
    rows: Array.from({ length: rowCount }, (_, i) => ({ _row_id: String(i), name: `Row ${i}` })),
  };
}

describe("extractBatch", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it("returns parsed records on a successful call", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify([{ _row_id: "0", name: "Row 0" }]),
      candidates: [{ finishReason: "STOP" }],
    });

    const result = await extractBatch(makeBatch(1));
    expect(result).toEqual([{ _row_id: "0", name: "Row 0" }]);
  });

  it("throws MALFORMED_RESPONSE when the response isn't valid JSON", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: "not json at all",
      candidates: [{ finishReason: "STOP" }],
    });

    await expect(extractBatch(makeBatch(1))).rejects.toMatchObject({
      kind: "MALFORMED_RESPONSE",
    });
  });

  it("throws MALFORMED_RESPONSE when the response is valid JSON but not an array", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ not: "an array" }),
      candidates: [{ finishReason: "STOP" }],
    });

    await expect(extractBatch(makeBatch(1))).rejects.toMatchObject({
      kind: "MALFORMED_RESPONSE",
    });
  });

  it("classifies a 429/RESOURCE_EXHAUSTED failure as QUOTA_EXCEEDED", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("429 RESOURCE_EXHAUSTED: quota exceeded"));

    await expect(extractBatch(makeBatch(1))).rejects.toMatchObject({
      kind: "QUOTA_EXCEEDED",
    });
  });

  it("classifies a generic API failure as API_ERROR", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("500 internal server error"));

    await expect(extractBatch(makeBatch(1))).rejects.toMatchObject({
      kind: "API_ERROR",
    });
  });

  it("includes the batchIndex on the thrown error", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("boom"));

    const batch = { ...makeBatch(1), batchIndex: 7 };
    await expect(extractBatch(batch)).rejects.toMatchObject({ batchIndex: 7 });
  });

  it("thrown errors are real AiExtractionError instances", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("boom"));

    try {
      await extractBatch(makeBatch(1));
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AiExtractionError);
    }
  });

  it("handles an empty successful array response", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: "[]",
      candidates: [{ finishReason: "STOP" }],
    });

    const result = await extractBatch(makeBatch(1));
    expect(result).toEqual([]);
  });
});
