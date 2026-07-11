"use client";

import { useCallback, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { CsvUpload } from "@/components/upload/CsvUpload";
import { CsvPreviewTable } from "@/components/preview/CsvPreviewTable";
import { ImportResultsView } from "@/components/results/ImportResultsView";
import { startImportJob, ApiError, ImportJobStatus } from "@/lib/api-client";
import { RawCsvRow, ImportResult } from "@/types/crm-record";
import { ProcessingView } from "@/components/preview/ProcessingView";

type Step = "upload" | "preview" | "processing" | "results";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RawCsvRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleParsed(file: File, parsedRows: RawCsvRow[]) {
    setCsvFile(file);
    setRows(parsedRows);
    setSubmitError(null);
    setStep("preview");
  }

  async function handleConfirm() {
    if (!csvFile) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const id = await startImportJob(csvFile);
      setJobId(id);
      setStep("processing");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong while starting the import. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Wrapped in useCallback so ProcessingView's polling effect (which
  // depends on this function) doesn't tear down and restart its
  // interval on every render.
  const handleJobComplete = useCallback((status: ImportJobStatus) => {
    if (status.result) setResult(status.result);
    setStep("results");
  }, []);

  const handleJobError = useCallback((message: string) => {
    setSubmitError(message);
    setStep("preview");
  }, []);

  function handleStartOver() {
    setCsvFile(null);
    setRows([]);
    setResult(null);
    setJobId(null);
    setSubmitError(null);
    setStep("upload");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Topbar title="Import Leads" subtitle="Upload CSV and let AI extract lead information" />
      <div className="p-8 max-w-6xl mx-auto space-y-4">
        {submitError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{submitError}</div>}
        {step === "upload" && <CsvUpload onParsed={handleParsed} />}
        {step === "preview" && csvFile && (
          <CsvPreviewTable rows={rows} fileName={csvFile.name} onConfirm={handleConfirm} isSubmitting={isSubmitting} />
        )}
        {step === "processing" && csvFile && jobId && (
          <ProcessingView
            fileName={csvFile.name}
            rowCount={rows.length}
            jobId={jobId}
            onComplete={handleJobComplete}
            onError={handleJobError}
          />
        )}
        {step === "results" && result && <ImportResultsView result={result} onStartOver={handleStartOver} />}
      </div>
    </main>
  );
}
