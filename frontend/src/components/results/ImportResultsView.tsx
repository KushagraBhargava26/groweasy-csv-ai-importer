import { CheckCircle2, XCircle, FileWarning } from "lucide-react";
import { ImportResult } from "@/types/crm-record";

interface ImportResultsViewProps {
  result: ImportResult;
  onStartOver: () => void;
}

export function ImportResultsView({ result, onStartOver }: ImportResultsViewProps) {
  const importedColumns = result.imported.length > 0 ? (Object.keys(result.imported[0]) as (keyof (typeof result.imported)[number])[]) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<FileWarning size={18} className="text-indigo-500 dark:text-indigo-400" />}
          label="Total Processed"
          value={result.totalImported + result.totalSkipped}
        />
        <SummaryCard
          icon={<CheckCircle2 size={18} className="text-green-500 dark:text-green-400" />}
          label="Imported"
          value={result.totalImported}
        />
        <SummaryCard icon={<XCircle size={18} className="text-red-500 dark:text-red-400" />} label="Skipped" value={result.totalSkipped} />
        <SummaryCard
          icon={<FileWarning size={18} className="text-amber-500 dark:text-amber-400" />}
          label="Batches Failed"
          value={result.batchesFailed}
        />
      </div>

      {result.imported.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h3 className="font-medium text-gray-900 dark:text-white">Imported Records</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{result.imported.length} records mapped to CRM format</p>
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
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h3 className="font-medium text-gray-900 dark:text-white">Skipped Records</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{result.skipped.length} records were not imported</p>
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

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
