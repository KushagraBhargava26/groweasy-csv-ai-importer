import { Download } from "lucide-react";
import { ImportResult } from "@/types/crm-record";
import { ImportSummaryPanel } from "@/components/shared/ImportSummaryPanel";
import { downloadImportedCsv, downloadSkippedCsv, downloadImportedJson, downloadSkippedJson } from "@/lib/sample-csv";

interface ImportResultsViewProps {
  result: ImportResult;
  onStartOver: () => void;
}

export function ImportResultsView({ result, onStartOver }: ImportResultsViewProps) {
  const importedColumns = result.imported.length > 0 ? (Object.keys(result.imported[0]) as (keyof (typeof result.imported)[number])[]) : [];

  return (
    <div className="space-y-6">
      <ImportSummaryPanel
        totalRows={result.totalImported + result.totalSkipped}
        importedCount={result.totalImported}
        skippedCount={result.totalSkipped}
        batchesFailed={result.batchesFailed}
        isLive={false}
      />

      {result.imported.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Imported Records</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{result.imported.length} records mapped to CRM format</p>
            </div>
            <button
              onClick={() => downloadImportedCsv(result.imported)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shrink-0">
              <Download size={16} />
              Download CRM CSV
            </button>
            <button
              onClick={() => downloadImportedJson(result.imported)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shrink-0">
              <Download size={16} />
              Download CRM JSON
            </button>
          </div>
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-10">
                <tr>
                  {importedColumns.map((col) => (
                    <th key={col} className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-300 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.imported.map((record, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800">
                    {importedColumns.map((col) => (
                      <td key={col} className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {record[col] || <span className="text-gray-300 dark:text-slate-600">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.skipped.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Skipped Records</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{result.skipped.length} records were not imported</p>
            </div>
            <button
              onClick={() => downloadSkippedCsv(result.skipped)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shrink-0">
              <Download size={16} />
              Download Skipped CSV
            </button>
            <button
              onClick={() => downloadSkippedJson(result.skipped)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shrink-0">
              <Download size={16} />
              Download Skipped JSON
            </button>
          </div>
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-10">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-300">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-300">Original Row (raw)</th>
                </tr>
              </thead>
              <tbody>
                {result.skipped.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 align-top">
                    <td className="px-4 py-3 text-red-600 dark:text-red-400 whitespace-nowrap">{item.reason}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 font-mono text-xs">{JSON.stringify(item.originalRow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={onStartOver}
        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
        ← Import another file
      </button>
    </div>
  );
}
