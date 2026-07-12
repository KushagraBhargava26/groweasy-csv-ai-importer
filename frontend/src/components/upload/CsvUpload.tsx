"use client";

import { useCallback, useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, Shield, Sparkles, Clock, Lightbulb, ArrowRight } from "lucide-react";
import { parseCsvFile, CsvParseError } from "@/lib/csv-parser";
import { listXlsxSheets, ApiError } from "@/lib/api-client";
import { RawCsvRow } from "@/types/crm-record";

interface CsvUploadProps {
  onParsed: (file: File, rows: RawCsvRow[]) => void;
  onXlsxReady: (file: File, sheetName: string) => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // matches backend's multer limit

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isXlsxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".xlsx");
}

/**
 * Step 1 of the import flow. CSV files are parsed entirely client-side
 * (unchanged). Excel files skip client-side parsing entirely — there's
 * no full row-preview table for .xlsx (a deliberate scope cut given time
 * constraints, not a bug) — instead this fetches just the sheet names
 * from the backend and, once the user picks one, hands off to the
 * parent which routes straight into the AI Mapping step.
 */
export function CsvUpload({ onParsed, onXlsxReady }: CsvUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<number | null>(null);

  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[] | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);

  const handleCsvFile = useCallback(
    async (file: File) => {
      setIsParsing(true);
      setParsingProgress(0);
      try {
        const rows = await parseCsvFile(file, (rowsParsedSoFar) => setParsingProgress(rowsParsedSoFar));
        setFileName(file.name);
        setFileSize(file.size);
        setRowCount(rows.length);
        onParsed(file, rows);
      } catch (err) {
        setError(err instanceof CsvParseError ? err.message : "Something went wrong while reading this file.");
      } finally {
        setIsParsing(false);
        setParsingProgress(null);
      }
    },
    [onParsed],
  );

  const handleXlsxFile = useCallback(async (file: File) => {
    setIsFetchingSheets(true);
    try {
      const sheets = await listXlsxSheets(file);
      setXlsxFile(file);
      setFileName(file.name);
      setFileSize(file.size);
      setSheetNames(sheets);
      setSelectedSheet(sheets[0] ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong while reading this Excel file.");
    } finally {
      setIsFetchingSheets(false);
    }
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      setXlsxFile(null);
      setSheetNames(null);

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError("File is too large. Maximum size is 10MB.");
        return;
      }

      if (isXlsxFile(file)) {
        handleXlsxFile(file);
        return;
      }

      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Only .csv and .xlsx files are supported.");
        return;
      }

      handleCsvFile(file);
    },
    [handleCsvFile, handleXlsxFile],
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="hidden md:flex items-center justify-center">
          <div className="relative w-56 h-56 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-indigo-50 dark:bg-indigo-950" />
            <div className="relative flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-center">
                <UploadCloud size={32} className="text-indigo-500" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center shadow-sm">
                <FileSpreadsheet size={20} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center text-center transition-colors ${
              isDragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950" : "border-gray-300 dark:border-slate-600"
            }`}>
            <UploadCloud size={32} className="text-indigo-500 mb-3" />
            <h3 className="font-medium text-gray-900 dark:text-white">Upload your file</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Drag & drop your file here, or click to browse</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Supports .csv and .xlsx files up to 10MB</p>

            <label className="mt-4 cursor-pointer">
              <span className="inline-block bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Choose File
              </span>
              <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileInputChange} />
            </label>
          </div>

          {(isParsing || isFetchingSheets) && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-4">
              {isFetchingSheets
                ? "Reading workbook…"
                : parsingProgress && parsingProgress > 0
                  ? `Reading file… ${parsingProgress.toLocaleString()} rows parsed so far`
                  : "Reading file…"}
            </p>
          )}

          {fileName && fileSize !== null && !isParsing && !isFetchingSheets && !error && (
            <div className="mt-4 flex items-center gap-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-3">
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

          {rowCount !== null && !isParsing && !error && (
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-3 text-right">
              {rowCount.toLocaleString()} rows detected
            </p>
          )}

          {xlsxFile && sheetNames && sheetNames.length > 0 && (
            <div className="mt-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                {sheetNames.length > 1 ? "Select a sheet to import" : "Sheet to import"}
              </label>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                disabled={sheetNames.length === 1}
                className="w-full text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-700 dark:text-slate-200 disabled:opacity-70">
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onXlsxReady(xlsxFile, selectedSheet)}
                disabled={!selectedSheet}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                Continue with this sheet
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-gray-100 dark:border-slate-800">
        <FeatureBadge
          icon={<Shield size={18} className="text-indigo-500" />}
          title="Secure & Private"
          description="Your data is processed in memory and never stored."
        />
        <FeatureBadge
          icon={<Sparkles size={18} className="text-indigo-500" />}
          title="AI-Powered"
          description="GrowEasy AI will analyze and extract leads intelligently."
        />
        <FeatureBadge
          icon={<Clock size={18} className="text-indigo-500" />}
          title="Save Time"
          description="Import thousands of leads in just a few clicks."
        />
      </div>

      <div className="flex items-start gap-3 mt-6 bg-indigo-50 dark:bg-indigo-950 rounded-lg px-4 py-3">
        <Lightbulb size={18} className="text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-900 dark:text-indigo-200">
          <span className="font-medium">Tips:</span> Ensure your file has column headers in the first row for best results.
        </p>
      </div>
    </div>
  );
}

function FeatureBadge({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}