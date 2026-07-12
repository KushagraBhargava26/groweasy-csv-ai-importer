import Papa from "papaparse";
import { RawCsvRow } from "@/types/crm-record";

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

// How often to report progress, in rows. Calling onProgress on every
// single row for a 32,000-row file would mean 32,000 React state updates
// on the main thread — the parsing itself runs off-thread (worker: true),
// but applying that many progress updates would still be wasteful and
// could visibly lag the UI. Reporting every 250 rows keeps the progress
// indicator responsive without flooding React with updates.
const PROGRESS_REPORT_INTERVAL = 250;

/**
 * Parses a File object (from drag&drop or file picker) into row objects.
 * Runs in a background Web Worker (worker: true) so parsing a large file
 * does NOT block the browser's main thread — this is what actually
 * matters for a 32,000+ row CSV; the earlier table virtualization fix
 * only solved the RENDERING freeze, this solves the PARSING freeze.
 * Uses PapaParse's step callback (row-by-row, incremental) rather than
 * waiting for the whole file to parse before we see anything, which is
 * both the mechanism for the worker relay AND what lets us report real,
 * live progress via the optional onProgress callback.
 *
 * Still mirrors the backend's csv-parser.service.ts logic (same trimming,
 * same blank-row filtering) so what the user sees in preview matches
 * what the backend will actually process.
 */
export function parseCsvFile(
  file: File,
  onProgress?: (rowsParsedSoFar: number) => void
): Promise<RawCsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: RawCsvRow[] = [];
    let rowsSeen = 0;

    Papa.parse<RawCsvRow>(file, {
      header: true,
      worker: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      step: (result) => {
        rowsSeen++;
        const row = result.data;
        const values = Object.values(row);
        const isBlank = !values.some((v) => v && v.toString().trim().length > 0);

        if (!isBlank) {
          rows.push(row);
        }

        if (rowsSeen % PROGRESS_REPORT_INTERVAL === 0) {
          onProgress?.(rows.length);
        }
      },
      complete: () => {
        onProgress?.(rows.length);

        if (rows.length === 0) {
          reject(new CsvParseError("No usable rows found in this CSV file."));
          return;
        }
        resolve(rows);
      },
      error: (error) => {
        reject(new CsvParseError(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}