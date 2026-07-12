"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getImportStatus, ImportJobStatus } from "@/lib/api-client";

const POLL_INTERVAL_MS = 2000;

interface ProcessingViewProps {
  fileName: string;
  rowCount: number;
  jobId: string;
  onComplete: (status: ImportJobStatus) => void;
  onError: (message: string) => void;
}

export function ProcessingView({ fileName, rowCount, jobId, onComplete, onError }: ProcessingViewProps) {
  const [status, setStatus] = useState<ImportJobStatus | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    resolvedRef.current = false;

    const interval = setInterval(async () => {
      if (resolvedRef.current) return;
      try {
        const latest = await getImportStatus(jobId);
        setStatus(latest);

        if (latest.status === "completed") {
          resolvedRef.current = true;
          clearInterval(interval);
          onComplete(latest);
        } else if (latest.status === "failed") {
          resolvedRef.current = true;
          clearInterval(interval);
          onError(latest.error ?? "Import failed for an unknown reason.");
        }
      } catch (err) {
        resolvedRef.current = true;
        clearInterval(interval);
        onError(err instanceof Error ? err.message : "Lost connection while checking import progress.");
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [jobId, onComplete, onError]);

  const batchesCompleted = status?.batchesCompleted ?? 0;
  const totalBatches = status?.totalBatches ?? 0;
  const percent = totalBatches > 0 ? Math.round((batchesCompleted / totalBatches) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-12 flex flex-col items-center text-center">
      <Loader2 size={40} className="text-indigo-600 dark:text-indigo-400 animate-spin mb-5" />
      <h3 className="font-medium text-gray-900 dark:text-white">Processing {fileName}</h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{rowCount} rows being mapped to GrowEasy CRM format</p>

      {totalBatches > 0 && (
        <>
          <div className="w-full max-w-sm bg-gray-100 dark:bg-slate-800 rounded-full h-2 mt-6 overflow-hidden">
            <div
              className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-3">
            {batchesCompleted} of {totalBatches} batches processed ({percent}%)
          </p>
        </>
      )}
    </div>
  );
}
