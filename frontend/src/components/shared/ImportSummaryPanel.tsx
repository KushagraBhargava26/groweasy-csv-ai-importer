import { FileText, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface ImportSummaryPanelProps {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  batchesFailed?: number;
  /** True while the job is still running — shows counts as "so far" rather than final. */
  isLive: boolean;
}

/**
 * Reused on both the Processing step (live, growing numbers as batches
 * complete) and the Results step (final numbers). Every number shown here
 * is real — during processing, imported/skipped counts come from the
 * backend's running tally (job-store.service.ts), not an estimate.
 */
export function ImportSummaryPanel({
  totalRows,
  importedCount,
  skippedCount,
  batchesFailed,
  isLive,
}: ImportSummaryPanelProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SummaryCard
        icon={<FileText size={18} className="text-indigo-500 dark:text-indigo-400" />}
        label="Total Rows"
        value={totalRows}
      />
      <SummaryCard
        icon={<CheckCircle2 size={18} className="text-green-500 dark:text-green-400" />}
        label={isLive ? "Imported so far" : "Imported"}
        value={importedCount}
      />
      <SummaryCard
        icon={<XCircle size={18} className="text-red-500 dark:text-red-400" />}
        label={isLive ? "Skipped so far" : "Skipped"}
        value={skippedCount}
      />
      {batchesFailed !== undefined && (
        <SummaryCard
          icon={<AlertTriangle size={18} className="text-amber-500 dark:text-amber-400" />}
          label="Batches Failed"
          value={batchesFailed}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}