"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { CsvUpload } from "@/components/upload/CsvUpload";
import { CsvPreviewTable } from "@/components/preview/CsvPreviewTable";
import { RawCsvRow } from "@/types/crm-record";

type Step = "upload" | "preview";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RawCsvRow[]>([]);

  function handleParsed(file: File, parsedRows: RawCsvRow[]) {
    setCsvFile(file);
    setRows(parsedRows);
    setStep("preview");
  }

  function handleConfirm() {
    // Wired up properly in the next step (API call + results display).
    // Placeholder for now so the button has something to do without erroring.
    console.log("Confirm clicked — API integration comes next.", csvFile);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Topbar title="Import Leads" subtitle="Upload CSV and let AI extract lead information" />
      <div className="p-8 max-w-5xl mx-auto">
        {step === "upload" && <CsvUpload onParsed={handleParsed} />}
        {step === "preview" && csvFile && (
          <CsvPreviewTable rows={rows} fileName={csvFile.name} onConfirm={handleConfirm} isSubmitting={false} />
        )}
      </div>
    </main>
  );
}
