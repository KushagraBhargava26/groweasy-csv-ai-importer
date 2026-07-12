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
  const [sheetName, setSheetName] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<RawCsvRow[]>([]);
  const [mappingPreview, setMappingPreview] = useState<MappingPreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleParsed(file: File, parsedRows: RawCsvRow[]) {
    setCsvFile(file);
    setSheetName(undefined);
    setRows(parsedRows);
    setMappingPreview(null);
    setSubmitError(null);
    setStep("preview");
  }

  // Excel path: no client-side row preview exists, so this jumps straight
  // from Upload into the AI Mapping step, using previewMapping's own
  // totalRows as the row count (there's no separately-parsed rows array
  // for xlsx files).
  async function handleXlsxReady(file: File, selectedSheet: string) {
    setCsvFile(file);
    setSheetName(selectedSheet);
    setRows([]);
    setSubmitError(null);
    setIsFetchingPreview(true);
    try {
      const preview = await previewMapping(file, selectedSheet);
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

  async function handleRequestMappingPreview() {
    if (!csvFile) return;
    setIsFetchingPreview(true);
    setSubmitError(null);
    try {
      const preview = await previewMapping(csvFile, sheetName);
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

  function handleContinueToReview() {
    setStep("review");
  }

  function handleSkipToReview() {
    setMappingPreview(null);
    setStep("review");
  }

  function handleBackFromReview() {
    setStep(mappingPreview ? "mapping" : "preview");
  }

  async function handleConfirmImport() {
    if (!csvFile) return;
    setIsStartingImport(true);
    setSubmitError(null);
    try {
      const id = await startImportJob(csvFile, sheetName);
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
    setSheetName(undefined);
    setRows([]);
    setMappingPreview(null);
    setResult(null);
    setJobId(null);
    setSubmitError(null);
    setStep("upload");
  }

  const indicatorStep: FlowStep = step === "processing" ? "review" : step;
  const totalRowsForProcessing = mappingPreview?.totalRows ?? rows.length;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <Topbar title="Import Leads" subtitle="Upload a file and let AI extract lead information" />
      <div className="p-8 max-w-6xl mx-auto space-y-4">
        <StepIndicator currentStep={indicatorStep} />

        {submitError && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
            {submitError}
          </div>
        )}

        {step === "upload" && <CsvUpload onParsed={handleParsed} onXlsxReady={handleXlsxReady} />}

        {step === "preview" && csvFile && (
          <CsvPreviewTable
            rows={rows}
            fileName={csvFile.name}
            onPreviewMapping={handleRequestMappingPreview}
            onSkipToConfirm={handleSkipToReview}
            isSubmitting={isFetchingPreview}
          />
        )}

        {step === "mapping" && mappingPreview && (
          <AiMappingPreview preview={mappingPreview} onContinue={handleContinueToReview} isStartingImport={false} />
        )}

        {step === "review" && csvFile && (
          <ReviewConfirm
            fileName={csvFile.name}
            totalRows={mappingPreview?.totalRows ?? rows.length}
            sampleMappedCount={mappingPreview?.sampleResult.imported.length}
            sampleSkippedCount={mappingPreview?.sampleResult.skipped.length}
            onConfirm={handleConfirmImport}
            onBack={handleBackFromReview}
            isSubmitting={isStartingImport}
          />
        )}

        {step === "processing" && csvFile && jobId && (
          <ProcessingView
            fileName={csvFile.name}
            rowCount={totalRowsForProcessing}
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
