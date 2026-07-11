import { CheckCircle2, XCircle, FileWarning } from "lucide-react";
import { ImportResult } from "@/types/crm-record";

interface ImportResultsViewProps {
  result: ImportResult;
  onStartOver: () => void;
}

/**
 * Step 4: the final results screen. Shows summary counts up top (per the
 * spec's explicit requirement), then both imported and skipped records in
 * their own scrollable tables — skipped records include the AI's/
 * validator's reason, which matters for a user trying to understand why
 * something didn't come through.
 */
export function ImportResultsView({ result, onStartOver }: ImportResultsViewProps) {
  const importedColumns =
    result.imported.length > 0 ? (Object.keys(result.imported[0]) as (keyof (typeof result.imported)[number])[]) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<FileWarning size={18} className="text-indigo-500" />}
          label="Total Processed"
          value={result.totalImported + result.totalSkipped}
        />
        <SummaryCard
          icon={<CheckCircle2 size={18} className="text-green-500" />}
          label="Imported"
          value={result.totalImported}
        />
        <SummaryCard
          icon={<XCircle size={18} className="text-red-500" />}
          label="Skipped"
          value={result.totalSkipped}
        />
        <SummaryCard
          icon={<FileWarning size={18} className="text-amber-500" />}
          label="Batches Failed"
          value={result.batchesFailed}
        />
      </div>

      {result.imported.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Imported Records</h3>
            <p className="text-sm text-gray-500 mt-0.5">{result.imported.length} records mapped to CRM format</p>
          </div>
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  {importedColumns.map((col) => (
                    <th key={col} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.imported.map((record, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    {importedColumns.map((col) => (
                      <td key={col} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {record[col] || <span className="text-gray-300">—</span>}
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
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Skipped Records</h3>
            <p className="text-sm text-gray-500 mt-0.5">{result.skipped.length} records were not imported</p>
          </div>
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Original Row (raw)</th>
                </tr>
              </thead>
              <tbody>
                {result.skipped.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-red-600 whitespace-nowrap">{item.reason}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {JSON.stringify(item.originalRow)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={onStartOver}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        ← Import another file
      </button>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}