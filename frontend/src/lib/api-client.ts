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
export async function importCsv(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/import/process`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Import failed. Please try again.";
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // response body wasn't JSON — fall back to the generic message above
    }
    throw new ApiError(message, response.status);
  }

  return response.json();
}
