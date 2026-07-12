"use client";

import { useCallback, useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { parseCsvFile, CsvParseError } from "@/lib/csv-parser";
import { RawCsvRow } from "@/types/crm-record";

interface CsvUploadProps {
  onParsed: (file: File, rows: RawCsvRow[]) => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // matches backend's multer limit — reject oversized files before even attempting a parse

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Step 1 of the import flow: drag & drop or file-picker upload.
 * Parses the CSV entirely client-side (via parseCsvFile) and hands the
 * resulting rows up to the parent — no network request happens here,
 * per the spec's "no AI processing yet" rule for this step.
 */
export function CsvUpload({ onParsed }: CsvUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Only .csv files are supported.");
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError("File is too large. Maximum size is 10MB.");
        return;
      }

      setIsParsing(true);
      try {
        const rows = await parseCsvFile(file);
        setFileName(file.name);
        setFileSize(file.size);
        setRowCount(rows.length);
        onParsed(file, rows);
      } catch (err) {
        setError(err instanceof CsvParseError ? err.message : "Something went wrong while reading this file.");
      } finally {
        setIsParsing(false);
      }
    },
    [onParsed],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 flex flex-col md:flex-row items-center gap-6 transition-colors ${
          isDragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950" : "border-gray-300 dark:border-slate-600"
        }`}>
        <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1">
          <UploadCloud size={40} className="text-indigo-500 mb-3" />
          <h3 className="font-medium text-gray-900 dark:text-white">Upload your CSV file</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Drag & drop your file here, or click to browse</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Supports .csv files up to 10MB</p>

          <label className="mt-4 cursor-pointer">
            <span className="inline-block bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Choose File
            </span>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileInputChange} />
          </label>
        </div>

        {isParsing && <p className="text-sm text-gray-500 dark:text-slate-400">Reading file…</p>}

        {fileName && fileSize !== null && !isParsing && !error && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-3 w-full md:w-auto md:min-w-[260px]">
            <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white truncate">{fileName}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">{formatFileSize(fileSize)}</p>
            </div>
            <CheckCircle2 size={20} className="text-green-500 shrink-0" />
          </div>
        )}
      </div>

      {rowCount !== null && !isParsing && !error && (
        <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-3 text-right">
          {rowCount.toLocaleString()} rows detected
        </p>
      )}

      {error && (
        <div className="mt-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
    </div>
  );
}