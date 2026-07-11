import { describe, it, expect, vi } from "vitest";
import { validateAiOutput } from "./validation.service";
import { RawCsvRow } from "../types/crm-record";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeRowMap(rows: Record<string, RawCsvRow>): Map<string, RawCsvRow> {
  return new Map(Object.entries(rows));
}

describe("validateAiOutput", () => {
  it("keeps a record with a valid email and no phone", () => {
    const rowById = makeRowMap({ "0": { Name: "Test User" } });
    const result = validateAiOutput(
      [{ _row_id: "0", name: "Test User", email: "test@example.com", mobile_without_country_code: "" }],
      rowById,
    );
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0].email).toBe("test@example.com");
    expect(result.skipped).toHaveLength(0);
    expect(result.unmatchedIds).toHaveLength(0);
  });

  it("keeps a record with a valid phone and no email", () => {
    const rowById = makeRowMap({ "0": { Name: "Test User" } });
    const result = validateAiOutput([{ _row_id: "0", name: "Test User", email: "", mobile_without_country_code: "9876543210" }], rowById);
    expect(result.kept).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it("skips a record with neither email nor phone", () => {
    const rowById = makeRowMap({ "0": { Name: "Ghost Row" } });
    const result = validateAiOutput([{ _row_id: "0", name: "Ghost Row", email: "", mobile_without_country_code: "" }], rowById);
    expect(result.kept).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/no email or mobile/i);
  });

  it("skips a record that fails schema validation (missing _row_id)", () => {
    const rowById = makeRowMap({ "0": { Name: "Test User" } });
    const result = validateAiOutput([{ name: "Test User", email: "test@example.com" }], rowById);
    expect(result.kept).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/did not match expected record shape/i);
  });

  it("clears an out-of-whitelist crm_status but still keeps the record", () => {
    const rowById = makeRowMap({ "0": { Name: "Test User" } });
    const result = validateAiOutput([{ _row_id: "0", email: "test@example.com", crm_status: "NOT_A_REAL_STATUS" }], rowById);
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0].crm_status).toBeUndefined();
  });

  it("keeps a valid crm_status value from the whitelist", () => {
    const rowById = makeRowMap({ "0": { Name: "Test User" } });
    const result = validateAiOutput([{ _row_id: "0", email: "test@example.com", crm_status: "GOOD_LEAD_FOLLOW_UP" }], rowById);
    expect(result.kept[0].crm_status).toBe("GOOD_LEAD_FOLLOW_UP");
  });

  it("clears an out-of-whitelist data_source but still keeps the record", () => {
    const rowById = makeRowMap({ "0": { Name: "Test User" } });
    const result = validateAiOutput([{ _row_id: "0", email: "test@example.com", data_source: "made_up_source" }], rowById);
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0].data_source).toBeUndefined();
  });

  it("clears an unparseable created_at value", () => {
    const rowById = makeRowMap({ "0": { Name: "Test User" } });
    const result = validateAiOutput([{ _row_id: "0", email: "test@example.com", created_at: "not a real date" }], rowById);
    expect(result.kept[0].created_at).toBe("");
  });

  it("keeps a valid, parseable created_at value", () => {
    const rowById = makeRowMap({ "0": { Name: "Test User" } });
    const result = validateAiOutput([{ _row_id: "0", email: "test@example.com", created_at: "2026-05-13 14:20:48" }], rowById);
    expect(result.kept[0].created_at).toBe("2026-05-13 14:20:48");
  });

  it("reports a row as unmatched when the AI never returns its _row_id at all", () => {
    const rowById = makeRowMap({
      "0": { Name: "Present Row" },
      "1": { Name: "Missing Row" },
    });
    const result = validateAiOutput([{ _row_id: "0", email: "test@example.com" }], rowById);
    expect(result.unmatchedIds).toEqual(["1"]);
  });
});
