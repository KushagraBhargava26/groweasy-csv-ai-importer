import { describe, it, expect, vi } from "vitest";
import { parseCsv, CsvParseError } from "./csv-parser.service";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("parseCsv", () => {
  it("parses a simple valid CSV into row objects keyed by header", () => {
    const csv = "Name,Email\nRahul,rahul@test.com\nPriya,priya@test.com";
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Name: "Rahul", Email: "rahul@test.com" });
    expect(rows[1]).toEqual({ Name: "Priya", Email: "priya@test.com" });
  });

  it("trims whitespace from header names", () => {
    const csv = " Name , Email \nRahul,rahul@test.com";
    const rows = parseCsv(csv);
    expect(Object.keys(rows[0])).toEqual(["Name", "Email"]);
  });

  it("trims whitespace from cell values", () => {
    const csv = "Name,Email\n  Rahul  ,  rahul@test.com  ";
    const rows = parseCsv(csv);
    expect(rows[0].Name).toBe("Rahul");
    expect(rows[0].Email).toBe("rahul@test.com");
  });

  it("keeps values as strings, never coerces types", () => {
    const csv = "Phone,Date\n0091234567,2026-05-13";
    const rows = parseCsv(csv);
    expect(rows[0].Phone).toBe("0091234567");
    expect(typeof rows[0].Phone).toBe("string");
    expect(rows[0].Date).toBe("2026-05-13");
  });

  it("skips fully-blank rows (all commas, no values)", () => {
    const csv = "Name,Email\nRahul,rahul@test.com\n,,\nPriya,priya@test.com";
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
  });

  it("throws CsvParseError on an empty file", () => {
    expect(() => parseCsv("")).toThrow(CsvParseError);
    expect(() => parseCsv("   ")).toThrow(CsvParseError);
  });

  it("throws CsvParseError with a helpful message on an empty file", () => {
    expect(() => parseCsv("")).toThrow(/empty/i);
  });

  it("throws CsvParseError when there are no usable data rows", () => {
    const csv = "Name,Email\n,,";
    expect(() => parseCsv(csv)).toThrow(CsvParseError);
    expect(() => parseCsv(csv)).toThrow(/no usable rows/i);
  });

  it("handles a single data row correctly", () => {
    const csv = "Name,Email\nRahul,rahul@test.com";
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
  });
});
