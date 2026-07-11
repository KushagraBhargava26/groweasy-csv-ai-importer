"use client";

import { useState } from "react";
import { RawCsvRow } from "@/types/crm-record";
import { Loader2 } from "lucide-react";

interface CsvPreviewTableProps {
  rows: RawCsvRow[];
  fileName: string;
  onConfirm: () => void;
  isSubmitting: boolean;
}

const ROWS_PER_PAGE = 10;

/**
 * Step 2 of the import flow: shows the raw, unprocessed CSV rows exactly
 * as parsed — NO AI involvement here, per the spec. Sticky header +
 * horizontal/vertical scroll handle wide, messy real-world CSVs (the whole
 * point of this project is that column layouts vary wildly).
 */
export function CsvPreviewTable({ rows, fileName, onConfirm, isSubmitting }: CsvPreviewTableProps) {
  const [page, setPage] = useState(0);

  // Column names are unknown ahead of time — derive them from the data
  // itself rather than hardcoding, since that's the entire premise of
  // this project (arbitrary CSV layouts).
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const visibleRows = rows.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h3 className="font-medium text-gray-900">CSV Preview</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {fileName} — {rows.length} rows detected
          </p>
        </div>
        <button
          onClick={onConfirm}
          disabled={isSubmitting}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? "Importing…" : "Confirm Import"}
        </button>
      </div>

      {/* max-h + overflow-auto gives both scroll directions; sticky header
          stays pinned to the top of THIS scroll container, not the page,
          which matters once rows exceed the visible area. */}
      <div className="overflow-auto max-h-[420px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              {columns.map((col) => (
                <th key={col} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {row[col] || <span className="text-gray-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 text-sm text-gray-500">
          <span>
            Showing {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
