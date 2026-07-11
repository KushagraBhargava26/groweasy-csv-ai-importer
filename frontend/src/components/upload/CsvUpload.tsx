"use client";

import { useCallback, useState } from "react";
import { UploadCloud, FileText, CheckCircle2 } from "lucide-react";
import { parseCsvFile, CsvParseError } from "@/lib/csv-parser";
import { RawCsvRow } from "@/types/crm-record";

interface CsvUploadProps {
  onParsed: (rows: RawCsvRow[], fileName: string, fileSizeBytes: number) => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // matches backend's multer limit — reject oversized files before even attempting a parse

/**
 * Step 1 of the import flow: drag & drop or file-picker upload.
 * Parses the CSV entirely client-side (via parseCsvFile) and hands the
 * resulting rows up to the parent — no network request happens here,
 * per the spec's "no AI processing yet" rule for this step.
 */
export function CsvUpload({ onParsed }: CsvUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
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
        onParsed(rows, file.name, file.size);
      } catch (err) {
        setError(err instanceof CsvParseError ? err.message : "Something went wrong while reading this file.");
      } finally {
        setIsParsing(false);
      }
    },
    [onParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center text-center transition-colors ${
          isDragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300"
        }`}
      >
        <UploadCloud size={40} className="text-indigo-500 mb-3" />
        <h3 className="font-medium text-gray-900">Upload your CSV file</h3>
        <p className="text-sm text-gray-500 mt-1">
          Drag & drop your file here, or click to browse
        </p>
        <p className="text-xs text-gray-400 mt-1">Supports .csv files up to 10MB</p>

        <label className="mt-4 cursor-pointer">
          <span className="inline-block bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            Browse Files
          </span>
          <input type="file" accept=".csv" className="hidden" onChange={handleFileInputChange} />
        </label>
      </div>

      {isParsing && (
        <p className="text-sm text-gray-500 mt-4">Reading file…</p>
      )}

      {fileName && !isParsing && !error && (
        <div className="mt-4 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <FileText size={18} className="text-gray-500" />
          <span className="text-sm text-gray-700 flex-1">{fileName}</span>
          <CheckCircle2 size={18} className="text-green-500" />
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
    </div>
  );
}