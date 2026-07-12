"use client";

import { FileText, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

interface ReviewConfirmProps {
  fileName: string;
  totalRows: number;
  sampleMappedCount: number;
  sampleSkippedCount: number;
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

/**
 * Step 4: the final checkpoint before the real, full-file background job
 * starts. This is deliberately a separate step from AI Mapping (step 3) —
 * reviewing sample quality and committing to the actual run (which, for a
 * large file, can take a long time on the free tier) are different
 * decisions, and conflating them into one click risks starting a slow job
 * the user hasn't actually agreed to.
 */
export function ReviewConfirm({
  fileName,
  totalRows,
  sampleMappedCount,
  sampleSkippedCount,
  onConfirm,
  onBack,
  isSubmitting,
}: ReviewConfirmProps) {
  const sampleTotal = sampleMappedCount + sampleSkippedCount;
  const estimatedMinutes = Math.ceil((totalRows / 10) * (4.2 / 60));

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={20} className="text-indigo-500" />
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">Ready to import {fileName}</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{totalRows.toLocaleString()} rows total</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 mb-6 space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 shrink-0" />
          Based on a sample of {sampleTotal} rows, {sampleMappedCount} mapped successfully
          {sampleSkippedCount > 0 && ` and ${sampleSkippedCount} would be skipped`}.
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          This will run in the background and may take approximately {estimatedMinutes} minute
          {estimatedMinutes === 1 ? "" : "s"} to fully process, due to AI provider rate limits. You'll see live progress on the next screen.
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="text-sm font-medium text-gray-600 dark:text-slate-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={isSubmitting}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Starting import…
            </>
          ) : (
            "Confirm & Start Import"
          )}
        </button>
      </div>
    </div>
  );
}
