import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const JOB_TTL_MS = 30 * 60 * 1000; // must match the real constant in job-store.service.ts

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// Dynamic import + resetModules gives each test its own fresh copy of the
// module, meaning a brand-new, empty `jobs` Map every time — the `jobs`
// Map itself is a module-level singleton with no exported way to clear it,
// so this is the only clean way to isolate tests from each other.
async function freshJobStore() {
  vi.resetModules();
  return import("./job-store.service");
}

describe("createJob", () => {
  it("creates a job with correct initial state", async () => {
    const { createJob } = await freshJobStore();

    const job = createJob("leads.csv", 100, 10);

    expect(job.status).toBe("pending");
    expect(job.fileName).toBe("leads.csv");
    expect(job.totalRows).toBe(100);
    expect(job.totalBatches).toBe(10);
    expect(job.batchesCompleted).toBe(0);
    expect(job.importedSoFar).toBe(0);
    expect(job.skippedSoFar).toBe(0);
    expect(job.result).toBeUndefined();
    expect(job.error).toBeUndefined();
    expect(typeof job.id).toBe("string");
    expect(job.id.length).toBeGreaterThan(0);
  });

  it("assigns a unique id to each job", async () => {
    const { createJob } = await freshJobStore();

    const jobA = createJob("a.csv", 10, 1);
    const jobB = createJob("b.csv", 10, 1);

    expect(jobA.id).not.toBe(jobB.id);
  });
});

describe("getJob", () => {
  it("retrieves a previously created job by id", async () => {
    const { createJob, getJob } = await freshJobStore();

    const created = createJob("leads.csv", 5, 1);
    const fetched = getJob(created.id);

    expect(fetched).toEqual(created);
  });

  it("returns undefined for an unknown id", async () => {
    const { getJob } = await freshJobStore();

    expect(getJob("nonexistent-id")).toBeUndefined();
  });
});

describe("updateJob", () => {
  it("merges a partial patch into the existing job", async () => {
    const { createJob, getJob, updateJob } = await freshJobStore();

    const job = createJob("leads.csv", 20, 2);
    updateJob(job.id, { status: "processing", batchesCompleted: 1, importedSoFar: 8, skippedSoFar: 2 });

    const updated = getJob(job.id);
    expect(updated?.status).toBe("processing");
    expect(updated?.batchesCompleted).toBe(1);
    expect(updated?.importedSoFar).toBe(8);
    expect(updated?.skippedSoFar).toBe(2);
    // Fields not included in the patch should be left untouched.
    expect(updated?.fileName).toBe("leads.csv");
    expect(updated?.totalRows).toBe(20);
  });

  it("bumps updatedAt on every update", async () => {
    const { createJob, getJob, updateJob } = await freshJobStore();

    const job = createJob("leads.csv", 20, 2);
    const originalUpdatedAt = job.updatedAt;

    vi.setSystemTime(new Date("2026-01-01T00:05:00Z"));
    updateJob(job.id, { status: "processing" });

    const updated = getJob(job.id);
    expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
  });

  it("silently does nothing when the job id doesn't exist", async () => {
    const { updateJob, getJob } = await freshJobStore();

    // Should not throw, and should not create a phantom job.
    expect(() => updateJob("nonexistent-id", { status: "completed" })).not.toThrow();
    expect(getJob("nonexistent-id")).toBeUndefined();
  });
});

describe("TTL sweep", () => {
  it("removes a job older than JOB_TTL_MS once a new job is created", async () => {
    const { createJob, getJob } = await freshJobStore();

    const oldJob = createJob("old.csv", 10, 1);

    // Advance time past the TTL. sweepOldJobs() runs at the top of every
    // createJob() call, so the next createJob() below triggers the sweep.
    vi.setSystemTime(new Date(Date.now() + JOB_TTL_MS + 1000));

    const newJob = createJob("new.csv", 10, 1);

    expect(getJob(oldJob.id)).toBeUndefined();
    expect(getJob(newJob.id)).toBeDefined();
  });

  it("keeps a job that has NOT yet exceeded JOB_TTL_MS", async () => {
    const { createJob, getJob } = await freshJobStore();

    const recentJob = createJob("recent.csv", 10, 1);

    // Advance time, but stay under the TTL threshold.
    vi.setSystemTime(new Date(Date.now() + JOB_TTL_MS - 1000));

    createJob("another.csv", 10, 1);

    expect(getJob(recentJob.id)).toBeDefined();
  });
});