"use client";
import { useCallback, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { CsvUpload } from "@/components/upload/CsvUpload";
import { CsvPreviewTable } from "@/components/preview/CsvPreviewTable";
import { ImportResultsView } from "@/components/results/ImportResultsView";
import { ProcessingView } from "@/components/preview/ProcessingView";
import { StepIndicator, FlowStep } from "@/components/layout/StepIndicator";
import { AiMappingPreview } from "@/components/mapping/AiMappingPreview";
import { ReviewConfirm } from "@/components/mapping/ReviewConfirm";
import { startImportJob, previewMapping, ApiError, ImportJobStatus, MappingPreviewResponse } from "@/lib/api-client";
import { RawCsvRow, ImportResult } from "@/types/crm-record";

type Step = "upload" | "preview" | "mapping" | "review" | "processing" | "results";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RawCsvRow[]>([]);
  const [mappingPreview, setMappingPreview] = useState<MappingPreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleParsed(file: File, parsedRows: RawCsvRow[]) {
    setCsvFile(file);
    setRows(parsedRows);
    setSubmitError(null);
    setStep("preview");
  }

  // Step 2 -> 3: run the real AI pipeline on a small sample so the user
  // can sanity-check mapping quality before committing to the full job.
  async function handleRequestMappingPreview() {
    if (!csvFile) return;
    setIsFetchingPreview(true);
    setSubmitError(null);
    try {
      const preview = await previewMapping(csvFile);
      setMappingPreview(preview);
      setStep("mapping");
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Something went wrong while generating the mapping preview. Please try again.",
      );
    } finally {
      setIsFetchingPreview(false);
    }
  }

  // Step 3 -> 4: no async work here, just moving to the review checkpoint.
  function handleContinueToReview() {
    setStep("review");
  }

  function handleBackToMapping() {
    setStep("mapping");
  }

  // Step 4 -> 5: this is what actually kicks off the full background job.
  async function handleConfirmImport() {
    if (!csvFile) return;
    setIsStartingImport(true);
    setSubmitError(null);
    try {
      const id = await startImportJob(csvFile);
      setJobId(id);
      setStep("processing");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong while starting the import. Please try again.");
    } finally {
      setIsStartingImport(false);
    }
  }

  const handleJobComplete = useCallback((status: ImportJobStatus) => {
    if (status.result) setResult(status.result);
    setStep("results");
  }, []);

  const handleJobError = useCallback((message: string) => {
    setSubmitError(message);
    setStep("review");
  }, []);

  function handleStartOver() {
    setCsvFile(null);
    setRows([]);
    setMappingPreview(null);
    setResult(null);
    setJobId(null);
    setSubmitError(null);
    setStep("upload");
  }

  const indicatorStep: FlowStep = step === "processing" ? "review" : step;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <Topbar title="Import Leads" subtitle="Upload CSV and let AI extract lead information" />
      <div className="p-8 max-w-6xl mx-auto space-y-4">
        <StepIndicator currentStep={indicatorStep} />

        {submitError && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
            {submitError}
          </div>
        )}

        {step === "upload" && <CsvUpload onParsed={handleParsed} />}

        {step === "preview" && csvFile && (
          <CsvPreviewTable rows={rows} fileName={csvFile.name} onConfirm={handleRequestMappingPreview} isSubmitting={isFetchingPreview} />
        )}

        {step === "mapping" && mappingPreview && (
          <AiMappingPreview preview={mappingPreview} onContinue={handleContinueToReview} isStartingImport={false} />
        )}

        {step === "review" && csvFile && mappingPreview && (
          <ReviewConfirm
            fileName={csvFile.name}
            totalRows={mappingPreview.totalRows}
            sampleMappedCount={mappingPreview.sampleResult.imported.length}
            sampleSkippedCount={mappingPreview.sampleResult.skipped.length}
            onConfirm={handleConfirmImport}
            onBack={handleBackToMapping}
            isSubmitting={isStartingImport}
          />
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
