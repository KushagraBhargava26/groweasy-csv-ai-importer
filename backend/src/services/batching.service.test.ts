import { describe, it, expect, vi } from "vitest";
import { createBatches, DEFAULT_BATCH_SIZE } from "./batching.service";
import { RawCsvRow } from "../types/crm-record";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeRows(count: number): RawCsvRow[] {
  return Array.from({ length: count }, (_, i) => ({ id: String(i) }));
}

describe("createBatches", () => {
  it("splits rows into evenly-sized batches when the count divides cleanly", () => {
    const batches = createBatches(makeRows(20), 10);
    expect(batches).toHaveLength(2);
    expect(batches[0].rows).toHaveLength(10);
    expect(batches[1].rows).toHaveLength(10);
  });

  it("puts the remainder in the last batch when the count doesn't divide cleanly", () => {
    const batches = createBatches(makeRows(25), 10);
    expect(batches).toHaveLength(3);
    expect(batches[0].rows).toHaveLength(10);
    expect(batches[1].rows).toHaveLength(10);
    expect(batches[2].rows).toHaveLength(5);
  });

  it("assigns sequential, zero-based batchIndex values", () => {
    const batches = createBatches(makeRows(25), 10);
    expect(batches.map((b) => b.batchIndex)).toEqual([0, 1, 2]);
  });

  it("returns a single batch when all rows fit within one batch size", () => {
    const batches = createBatches(makeRows(5), 10);
    expect(batches).toHaveLength(1);
    expect(batches[0].rows).toHaveLength(5);
  });

  it("returns an empty array for an empty input", () => {
    const batches = createBatches([], 10);
    expect(batches).toEqual([]);
  });

  it("uses DEFAULT_BATCH_SIZE (10) when no batchSize is given", () => {
    const batches = createBatches(makeRows(15));
    expect(batches[0].rows).toHaveLength(DEFAULT_BATCH_SIZE);
    expect(batches[1].rows).toHaveLength(5);
  });

  it("handles a batch size of 1 (one row per batch)", () => {
    const batches = createBatches(makeRows(3), 1);
    expect(batches).toHaveLength(3);
    batches.forEach((b) => expect(b.rows).toHaveLength(1));
  });

  it("preserves row content and order within and across batches", () => {
    const rows = makeRows(5);
    const batches = createBatches(rows, 2);
    const flattened = batches.flatMap((b) => b.rows);
    expect(flattened).toEqual(rows);
  });

  it("throws when batchSize is zero", () => {
    expect(() => createBatches(makeRows(5), 0)).toThrow(/positive number/i);
  });

  it("throws when batchSize is negative", () => {
    expect(() => createBatches(makeRows(5), -5)).toThrow(/positive number/i);
  });
});
