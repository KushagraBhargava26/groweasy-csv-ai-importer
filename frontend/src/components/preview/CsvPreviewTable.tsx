"use client";
import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Eye, Download, ArrowRight } from "lucide-react";
import { RawCsvRow } from "@/types/crm-record";
import { downloadExampleCsv } from "@/lib/sample-csv";

interface CsvPreviewTableProps {
  rows: RawCsvRow[];
  fileName: string;
  onConfirm: () => void;
  isSubmitting: boolean;
}

const ROW_HEIGHT_PX = 44;
const TABLE_HEIGHT_PX = 420;

export function CsvPreviewTable({ rows, fileName, onConfirm, isSubmitting }: CsvPreviewTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const allColumns = rows.length > 0 ? Object.keys(rows[0]) : [];

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  const visibleColumns = useMemo(
    () => allColumns.filter((col) => !hiddenColumns.has(col)),
    [allColumns, hiddenColumns],
  );

  function toggleColumn(col: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
  }

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">CSV Preview</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {fileName} — {rows.length.toLocaleString()} rows detected
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setIsColumnMenuOpen((open) => !open)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
              <Eye size={16} />
              Column Visibility
            </button>
            {isColumnMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 max-h-72 overflow-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-20 p-2">
                {allColumns.map((col) => (
                  <label
                    key={col}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 dark:text-slate-200 rounded hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.has(col)}
                      onChange={() => toggleColumn(col)}
                      className="rounded"
                    />
                    <span className="truncate">{col}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={downloadExampleCsv}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
            <Download size={16} />
            Download Sample
          </button>

          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isSubmitting ? (
              "Analyzing…"
            ) : (
              <>
                Next: AI Mapping
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="overflow-auto" style={{ height: TABLE_HEIGHT_PX }}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          <table className="w-full text-sm">
            <thead
              className="sticky top-0 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-10"
              style={{ position: "sticky" }}>
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col} className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-300 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ position: "relative" }}>
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <tr
                    key={virtualRow.key}
                    className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}>
                    {visibleColumns.map((col) => (
                      <td key={col} className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {row[col] || <span className="text-gray-300 dark:text-slate-600">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}