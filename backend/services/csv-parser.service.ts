import Papa from "papaparse";
import { RawCsvRow } from "../types/crm-record";
import { logger } from "../utils/logger";

// A small custom error type so the controller layer can distinguish
// "the CSV itself is broken" from other kinds of failures (AI errors,
// validation errors, etc.) and respond with the right HTTP status.
export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

/**
 * Parses raw CSV text into an array of row objects, keyed by header name.
 *
 * Deliberately keeps every value as a string (no dynamicTyping) — a phone
 * number like "0091234567" or a date like "2026-05-13" must NOT be silently
 * converted to a number or a Date object here. Type coercion happens later,
 * in validation, where we control it explicitly per-field.
 */
export function parseCsv(rawCsvText: string): RawCsvRow[] {
  if (!rawCsvText || rawCsvText.trim().length === 0) {
    throw new CsvParseError("The uploaded file is empty.");
  }

  const result = Papa.parse<RawCsvRow>(rawCsvText, {
    header: true,          // first row = column names, used as object keys
    skipEmptyLines: true,  // ignore blank lines (common at end of exported files)
    transformHeader: (header) => header.trim(), // "Email " -> "Email"
    transform: (value) => value.trim(),         // trim every cell value too
  });

  // PapaParse collects parse errors instead of throwing — we decide here
  // whether they're fatal. A few malformed rows (e.g. inconsistent column
  // count) are common in real-world exports and shouldn't kill the whole
  // import; but zero usable rows means something is fundamentally wrong.
  if (result.errors.length > 0) {
    logger.warn("CSV parsing encountered non-fatal issues", {
      errorCount: result.errors.length,
      sample: result.errors.slice(0, 3),
    });
  }

  const rows = result.data.filter((row) => {
    // Guard against fully-blank rows PapaParse sometimes still emits
    // (e.g. a row of only commas: ",,,,,")
    const values = Object.values(row);
    return values.some((v) => v && v.toString().trim().length > 0);
  });

  if (rows.length === 0) {
    throw new CsvParseError(
      "No usable rows found in the CSV. Check that the file has a header row and at least one data row."
    );
  }

  const headers = result.meta.fields ?? [];
  if (headers.length === 0) {
    throw new CsvParseError("Could not detect column headers in the CSV.");
  }

  logger.info("CSV parsed successfully", {
    rowCount: rows.length,
    columnCount: headers.length,
    headers,
  });

  return rows;
}