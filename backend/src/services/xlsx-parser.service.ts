import ExcelJS from "exceljs";
import { RawCsvRow } from "../types/crm-record";
import { logger } from "../utils/logger";

// Mirrors CsvParseError deliberately — the controller layer treats both
// the same way (a 400-level "the uploaded file itself is broken" error),
// so it makes sense for xlsx parsing to signal failures the same way CSV
// parsing does.
export class XlsxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XlsxParseError";
  }
}

/**
 * Returns just the sheet names in a workbook, without fully parsing any
 * of them into rows. Cheap and fast — used to power the frontend's
 * sheet-picker step before the user commits to a specific sheet.
 */
export async function listSheetNames(fileBuffer: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(fileBuffer as any); // see npm ls @types/node — likely a duplicate/conflicting @types/node install causing a structural Buffer type mismatch, not a real bug
  } catch (err) {
    throw new XlsxParseError("Could not read this file as a valid .xlsx workbook.");
  }

  const names = workbook.worksheets.map((sheet) => sheet.name);

  if (names.length === 0) {
    throw new XlsxParseError("This workbook has no sheets.");
  }

  return names;
}

/**
 * Parses one named sheet from an .xlsx workbook into the same RawCsvRow[]
 * shape parseCsv() produces from a CSV file — first row = headers, every
 * cell value coerced to a trimmed string, blank rows filtered out. This
 * is what lets the rest of the pipeline (batching, AI extraction,
 * validation) stay completely format-agnostic: it never needs to know
 * whether a row originally came from a CSV or an Excel sheet.
 *
 * Deliberately stringifies every cell rather than trusting exceljs's
 * native types (numbers, Dates, formula results, rich text objects) —
 * same reasoning as csv-parser.service.ts: a phone number or a date must
 * not be silently reinterpreted here. Type handling happens later, in
 * validation, where it's explicit and field-aware.
 */
export async function parseXlsxSheet(fileBuffer: Buffer, sheetName: string): Promise<RawCsvRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(fileBuffer as any); // see npm ls @types/node — likely a duplicate/conflicting @types/node install causing a structural Buffer type mismatch, not a real bug
  } catch (err) {
    throw new XlsxParseError("Could not read this file as a valid .xlsx workbook.");
  }

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new XlsxParseError(`Sheet "${sheetName}" was not found in this workbook.`);
  }

  const allRows = worksheet.getSheetValues();
  // exceljs's getSheetValues() returns a sparse array where index 0 is
  // always empty and real rows start at index 1 — a 1-indexed quirk of
  // the underlying spreadsheet model, not a bug.
  const headerRow = allRows[1];
  if (!headerRow || !Array.isArray(headerRow)) {
    throw new XlsxParseError("Could not detect a header row in this sheet.");
  }

  const headers = cellArrayToStrings(headerRow).map((h) => h.trim());
  if (headers.every((h) => h.length === 0)) {
    throw new XlsxParseError("Could not detect column headers in this sheet.");
  }

  const rows: RawCsvRow[] = [];
  for (let i = 2; i < allRows.length; i++) {
    const rawRow = allRows[i];
    if (!rawRow || !Array.isArray(rawRow)) continue;

    const values = cellArrayToStrings(rawRow);
    const row: RawCsvRow = {};
    headers.forEach((header, colIndex) => {
      if (header.length === 0) return; // skip unnamed columns, same as PapaParse would
      row[header] = (values[colIndex] ?? "").trim();
    });

    const isBlank = Object.values(row).every((v) => v.length === 0);
    if (!isBlank) rows.push(row);
  }

  if (rows.length === 0) {
    throw new XlsxParseError("No usable rows found in this sheet. Check that it has a header row and at least one data row.");
  }

  logger.info("XLSX sheet parsed successfully", {
    sheetName,
    rowCount: rows.length,
    columnCount: headers.length,
    headers,
  });

  return rows;
}

// exceljs cell values can be a plain string/number, a Date, a formula
// object ({ formula, result }), a rich-text object ({ richText: [...] }),
// or a hyperlink object ({ text, hyperlink }) — this normalizes all of
// them down to a single plain string, consistently, in one place.
function cellArrayToStrings(row: unknown[]): string[] {
  return row.map((cell) => cellToString(cell));
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString();
  if (typeof cell === "object") {
    const cellObj = cell as Record<string, unknown>;
    if ("result" in cellObj) return cellToString(cellObj.result); // formula cell
    if ("richText" in cellObj && Array.isArray(cellObj.richText)) {
      return cellObj.richText.map((part: { text?: string }) => part.text ?? "").join("");
    }
    if ("text" in cellObj) return String(cellObj.text); // hyperlink cell
    return "";
  }
  return String(cell).trim();
}
