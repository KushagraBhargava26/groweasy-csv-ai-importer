"use client";

import { CheckCircle2, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { MappingPreviewResponse } from "@/lib/api-client";
import { CrmRecord } from "@/types/crm-record";

interface AiMappingPreviewProps {
  preview: MappingPreviewResponse;
  onContinue: () => void;
  isStartingImport: boolean;
}

/**
 * Step 3: shows the REAL AI-mapped output for a small sample of rows,
 * so the user can sanity-check field mapping quality before committing
 * to processing the entire file. This is genuine AI output, not a mock —
 * it hit the same Gemini pipeline the full import will use.
 */
export function AiMappingPreview({ preview, onContinue, isStartingImport }: AiMappingPreviewProps) {
  const { sampleResult, totalRows } = preview;
  const sampleColumns: (keyof CrmRecord)[] =
    sampleResult.imported.length > 0 ? (Object.keys(sampleResult.imported[0]) as (keyof CrmRecord)[]) : [];

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-medium text-gray-900 dark:text-white">AI Mapping Preview</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Showing AI-mapped results for the first {sampleResult.imported.length + sampleResult.skipped.length} of{" "}
          {totalRows.toLocaleString()} rows — review before processing the full file
        </p>
      </div>

      {sampleResult.imported.length > 0 && (
        <div className="overflow-auto max-h-[320px] border-b border-gray-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-10">
              <tr>
                {sampleColumns.map((col) => (
                  <th key={col} className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-300 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleResult.imported.map((record, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-slate-800">
                  {sampleColumns.map((col) => (
                    <td key={col} className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                      {record[col] || <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <CheckCircle2 size={16} />
            {sampleResult.imported.length} mapped correctly
          </span>
          {sampleResult.skipped.length > 0 && (
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <XCircle size={16} />
              {sampleResult.skipped.length} would be skipped
            </span>
          )}
        </div>

        <button
          onClick={onContinue}
          disabled={isStartingImport}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
          {isStartingImport ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Preparing…
            </>
          ) : (
            <>
              Looks good, continue
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
