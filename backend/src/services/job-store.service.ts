import { ImportResult } from "../types/crm-record";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface ImportJob {
  id: string;
  status: JobStatus;
  fileName: string;
  totalRows: number;
  totalBatches: number;
  batchesCompleted: number;
  result?: ImportResult;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// In-memory store — safe because this backend runs as a single persistent
// process on Render, not as stateless serverless functions. If this ever
// moves to a multi-instance or serverless deployment, this needs to become
// a real external store (Redis, a DB table) instead.
const jobs = new Map<string, ImportJob>();

// Jobs older than this get swept on each create, so memory doesn't grow
// unbounded over a long-running process.
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

function sweepOldJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.updatedAt < cutoff) jobs.delete(id);
  }
}

export function createJob(fileName: string, totalRows: number, totalBatches: number): ImportJob {
  sweepOldJobs();
  const now = Date.now();
  const job: ImportJob = {
    id: crypto.randomUUID(),
    status: "pending",
    fileName,
    totalRows,
    totalBatches,
    batchesCompleted: 0,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): ImportJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<ImportJob>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
}
