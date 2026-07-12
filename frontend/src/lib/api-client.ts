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

/**
 * Sends the ORIGINAL CSV file (not the client-parsed rows) to the backend
 * as multipart/form-data. The backend does its own independent parsing —
 * we deliberately don't try to reconstruct CSV text from the already-parsed
 * JSON rows, since that round-trip is lossy (quoting, special characters)
 * and the backend is the authoritative parser anyway.
 */
export interface ImportJobStatus {
  status: "pending" | "processing" | "completed" | "failed";
  totalRows: number;
  totalBatches: number;
  batchesCompleted: number;
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
 * Kicks off a background import job and returns its id immediately.
 * The caller is responsible for polling getImportStatus() to track
 * progress and retrieve the final result.
 */
export async function startImportJob(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

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
 * Calls the new synchronous sample-mapping endpoint — runs the REAL AI
 * pipeline on just the first 5 rows, fast enough to await directly like
 * a normal request (unlike the full-file job, which requires polling).
 * Powers the AI Mapping review step.
 */
export async function previewMapping(file: File): Promise<MappingPreviewResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/import/preview-mapping`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    await parseErrorResponse(response, "Could not generate mapping preview. Please try again.");
  }

  return response.json();
}
