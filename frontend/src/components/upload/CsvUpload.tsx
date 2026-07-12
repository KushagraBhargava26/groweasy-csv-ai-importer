"use client";

import { useCallback, useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, Shield, Sparkles, Clock, Lightbulb } from "lucide-react";
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
  const [parsingProgress, setParsingProgress] = useState<number | null>(null);

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
        {/* Decorative illustration — purely visual, no functional claim */}
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

          {isParsing && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-4">
              {parsingProgress && parsingProgress > 0
                ? `Reading file… ${parsingProgress.toLocaleString()} rows parsed so far`
                : "Reading file…"}
            </p>
          )}

          {fileName && fileSize !== null && !isParsing && !error && (
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
          <span className="font-medium">Tips:</span> Ensure your file is in CSV format. First row should contain column headers for best
          results.
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
