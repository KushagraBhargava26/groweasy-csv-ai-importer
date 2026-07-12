import { ImportResult } from "@/types/crm-record";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export interface ImportJobStatus {
  status: "pending" | "processing" | "completed" | "failed";
  totalRows: number;
  totalBatches: number;
  batchesCompleted: number;
  importedSoFar: number;
  skippedSoFar: number;
  result?: ImportResult;
  error?: string;
}

async function parseErrorResponse(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const data = await response.json();
    if (data?.error) message = data.error;
  } catch {
    // response body wasn't JSON — fall back to the generic message above
  }
  throw new ApiError(message, response.status);
}

/**
 * Cheap, sheet-names-only call — powers the Excel sheet picker before
 * any real parsing/AI processing happens.
 */
export async function listXlsxSheets(file: File): Promise<string[]> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/import/xlsx-sheets`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    await parseErrorResponse(response, "Could not read sheets from this Excel file. Please try again.");
  }

  const data = await response.json();
  return data.sheetNames;
}

/**
 * Kicks off a background import job and returns its id immediately.
 * sheetName is only relevant (and required by the backend) for .xlsx
 * uploads — omitted entirely for CSV.
 */
export async function startImportJob(file: File, sheetName?: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  if (sheetName) formData.append("sheetName", sheetName);

  const response = await fetch(`${API_BASE_URL}/api/import/process`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    await parseErrorResponse(response, "Import failed to start. Please try again.");
  }

  const data = await response.json();
  return data.jobId;
}

export async function getImportStatus(jobId: string): Promise<ImportJobStatus> {
  const response = await fetch(`${API_BASE_URL}/api/import/status/${jobId}`);

  if (!response.ok) {
    await parseErrorResponse(response, "Could not check import status. Please try again.");
  }

  return response.json();
}

export interface MappingPreviewResponse {
  totalRows: number;
  sampleResult: ImportResult;
}

/**
 * Runs the REAL AI pipeline on a small sample, synchronously. sheetName
 * is required by the backend for .xlsx files, omitted for CSV.
 */
export async function previewMapping(file: File, sheetName?: string): Promise<MappingPreviewResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (sheetName) formData.append("sheetName", sheetName);

  const response = await fetch(`${API_BASE_URL}/api/import/preview-mapping`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    await parseErrorResponse(response, "Could not generate mapping preview. Please try again.");
  }

  return response.json();
}