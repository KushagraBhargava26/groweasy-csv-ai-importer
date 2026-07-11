import Papa from "papaparse";
import { RawCsvRow } from "@/types/crm-record";

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

/**
 * Parses a File object (from drag&drop or file picker) into row objects,
 * entirely client-side. This mirrors the backend's csv-parser.service.ts
 * logic (same trimming, same blank-row filtering) so what the user sees
 * in the preview table matches what the backend will actually process —
 * no surprises between "what I previewed" and "what got imported."
 */
export function parseCsvFile(file: File): Promise<RawCsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (result) => {
        const rows = result.data.filter((row) => {
          const values = Object.values(row);
          return values.some((v) => v && v.toString().trim().length > 0);
        });

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