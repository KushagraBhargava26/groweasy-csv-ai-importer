# Architecture

This document describes how the GrowEasy CSV AI Importer is put together: the two applications, how they communicate, the shape of the backend pipeline, and the data model that flows through it.

## 1. System overview

The system is a two-tier application:

```
┌─────────────────────────┐        HTTP / multipart / JSON        ┌──────────────────────────┐
│  Frontend (Next.js)     │ ─────────────────────────────────────▶│  Backend (Express API)  │
│  localhost:3000         │◀───────────────────────────────────── │  localhost:5000          │
└─────────────────────────┘                                       └───────────┬──────────────┘
                                                                                │
                                                                                │ generateContent()
                                                                                ▼
                                                                     ┌─────────────────────┐
                                                                     │  Google Gemini API   │
                                                                     │ gemini-3.1-flash-lite│
                                                                     └─────────────────────┘
```

- The **frontend** is a Next.js (App Router) single-page flow that never talks to Gemini directly — it only talks to the backend.
- The **backend** is a stateless-per-request Express API that owns all CSV parsing, batching, AI calls, and validation, and holds in-memory state only for tracking background job progress.
- The **AI provider** is Google Gemini, called once per batch of rows via the `@google/genai` SDK, with a structured JSON response schema.

## 2. Request flow (end to end)

```
 User                 Frontend                     Backend                    Gemini
  │                       │                            │                         │
  │  select .csv file     │                             │                        │
  │──────────────────────▶│  parse locally for preview  │                        │
  │                       │  (csv-parser.ts, client)    │                        │
  │                       │                             │                        │
  │  confirm mapping step │                             │                        │
  │──────────────────────▶│ POST /api/import/preview-mapping (file)              │
  │                       │────────────────────────────▶│                        │
  │                       │                             │  parseCsv() [server]   │
  │                       │                             │  sample first 5 rows   │
  │                       │                             │  runCrmImportPipeline()│
  │                       │                             │───────────────────────▶│
  │                       │                             │◀───────────────────────│
  │                       │◀────────────────────────────│  200 { sampleResult }  │
  │  review & confirm     │                             │                        │
  │──────────────────────▶│ POST /api/import/process (file)                     │
  │                       │────────────────────────────▶│                        │
  │                       │                             │  parseCsv()            │
  │                       │                             │  createJob()          │
  │                       │◀────────────────────────────│  202 { jobId }         │
  │                       │                             │  (job runs async,      │
  │                       │                             │   not awaited by the   │
  │                       │                             │   request handler)     │
  │                       │  poll GET /status/:jobId     │                        │
  │                       │────────────────────────────▶│                        │
  │                       │◀────────────────────────────│  progress snapshot     │
  │                       │        ... repeats ...       │  batch 1 ──▶ Gemini    │
  │                       │                             │  batch 2 ──▶ Gemini    │
  │                       │                             │  ...                   │
  │                       │◀────────────────────────────│  { status: completed,  │
  │  view results         │                             │    result }            │
  │◀──────────────────────│                             │                        │
```

## 3. Frontend architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.

The UI is a single client-side page (`src/app/page.tsx`) driven by a `step` state machine:

```
upload → preview → mapping → review → processing → results
```

| Step | Component | Responsibility |
|---|---|---|
| `upload` | `components/upload/CsvUpload.tsx` | File picker, client-side CSV parse (`lib/csv-parser.ts`) for the raw preview |
| `preview` | `components/preview/CsvPreviewTable.tsx` | Shows the raw parsed rows as a table |
| `mapping` | `components/mapping/AiMappingPreview.tsx` | Displays the AI's mapping of a 5-row sample, fetched via `previewMapping()` |
| `review` | `components/mapping/ReviewConfirm.tsx` | Final confirmation checkpoint before the full run |
| `processing` | `components/preview/ProcessingView.tsx` | Polls job status and shows live progress |
| `results` | `components/results/ImportResultsView.tsx` + `components/shared/ImportSummaryPanel.tsx` | Final imported/skipped summary |

Shared layout pieces live in `components/layout/` (`Topbar`, `StepIndicator`, `ThemeToggle`), and theme state is provided by `contexts/ThemeContext.tsx`.

All backend communication is centralized in `lib/api-client.ts`, which exposes three typed functions: `startImportJob`, `getImportStatus`, `previewMapping`. Types in `src/types/crm-record.ts` mirror the backend's types so the two stay structurally compatible.

## 4. Backend architecture

**Stack:** Express (TypeScript), Multer (file upload), PapaParse (CSV parsing), Zod (schema validation), `@google/genai` (Gemini SDK).

### 4.1 Layers

```
routes/          import.route.ts          → maps HTTP verbs+paths to controllers
controllers/     import.controller.ts     → request/response handling, job lifecycle
services/        csv-parser.service.ts    → CSV text → RawCsvRow[]
                 batching.service.ts      → RawCsvRow[] → Batch[]
                 ai-extraction.service.ts → Batch → Gemini call → parsed JSON
                 crm-mapper.service.ts    → orchestrates the full pipeline end-to-end
                 validation.service.ts    → Zod validation + business rules on AI output
                 job-store.service.ts     → in-memory job tracking for background runs
middleware/      upload-limits.ts         → Multer config (memory storage, size/type limits)
                 error-handler.ts         → centralized error → HTTP status mapping
prompts/         crm-extraction.prompt.ts → the Gemini system prompt
types/           crm-record.ts            → shared domain types
utils/           logger.ts                → structured logging
```

### 4.2 Routes

| Method | Path | Controller | Behavior |
|---|---|---|---|
| `GET` | `/health` | inline in `app.ts` | Liveness check |
| `POST` | `/api/import/process` | `processImport` | Starts a background job, returns `202` + `jobId` |
| `GET` | `/api/import/status/:jobId` | `getImportStatus` | Returns job progress/result |
| `POST` | `/api/import/preview-mapping` | `previewMapping` | Synchronous AI run on a 5-row sample |

### 4.3 The import pipeline (`crm-mapper.service.ts`)

This is the core orchestrator, used by both the background job and the sample-preview endpoint:

```
RawCsvRow[]
   │
   ▼
tagRowsWithId()          — stamps each row with a stable _row_id
   │
   ▼
createBatches()          — splits into fixed-size batches (default 10 rows/batch)
   │
   ▼
for each batch, sequentially:
   │
   ├─▶ extractBatchWithRetry() ─▶ extractBatch() ─▶ Gemini generateContent()
   │        │
   │        └─ retries on quota / transient errors, gives up fast on bad requests
   │
   ├─▶ validateAiOutput()     — Zod schema check, enum whitelist, contact-info rule,
   │                            row-id reconciliation against the original batch
   │
   ├─▶ accumulate imported[] / skipped[]
   │
   └─▶ onBatchComplete callback — used to update the job store's progress fields
   │
   ▼
ImportResult { imported, skipped, totalImported, totalSkipped, batchesProcessed, batchesFailed }
```

### 4.4 AI extraction (`ai-extraction.service.ts`)

- Model: `gemini-3.1-flash-lite`, called via `ai.models.generateContent()`.
- A fixed `responseSchema` (built by `buildCrmRecordSchema`) forces a JSON array output where every object has all 16 fields present, including the echoed `_row_id`.
- The system instruction is built once by `buildCrmExtractionPrompt()` and reused for every batch.
- Errors are normalized into an `AiExtractionError` with a `kind`: `QUOTA_EXCEEDED`, `MALFORMED_RESPONSE`, or `API_ERROR`, which downstream retry logic and the error-handler middleware key off of.

### 4.5 Validation (`validation.service.ts`)

Runs on every record Gemini returns, independent of what the prompt asked for:

- Parses each record against a Zod schema (`crmRecordInputSchema`).
- Normalizes `created_at` (must be `Date`-parseable, else cleared).
- Whitelists `crm_status` against `CRM_STATUS_VALUES` and `data_source` against `DATA_SOURCE_VALUES` — anything else is dropped, never passed through.
- Enforces the "must have email or mobile" rule in code.
- Reconciles `_row_id`s against the original batch to produce `unmatchedIds` — rows the AI legitimately omitted per the skip rule.

### 4.6 Job store (`job-store.service.ts`)

An in-memory `Map<string, ImportJob>` backing the background-job endpoints:

- `createJob` / `getJob` / `updateJob` are the only entry points.
- Jobs carry `status` (`pending | processing | completed | failed`), progress counters, and, once finished, the full `ImportResult` or an error message.
- A TTL sweep (30 minutes) removes stale jobs on each `createJob` call.

### 4.7 Middleware

- `upload-limits.ts` — Multer configured with in-memory storage, a 10MB file size cap, and a combined MIME-type/extension filter for `.csv`.
- `error-handler.ts` — the single place that maps thrown errors (`CsvParseError`, Multer's file-type error, `AiExtractionError` by `kind`, anything else) to HTTP status codes and a uniform `{ error: string }` response body. Registered last in `app.ts` so it catches errors from every route.

## 5. Data model

```ts
type RawCsvRow = Record<string, string>;   // arbitrary CSV columns, all values as strings

interface CrmRecord {
  created_at?: string;
  name?: string;
  email?: string;
  country_code?: string;
  mobile_without_country_code?: string;
  company?: string;
  city?: string;
  state?: string;
  country?: string;
  lead_owner?: string;
  crm_status?: "GOOD_LEAD_FOLLOW_UP" | "DID_NOT_CONNECT" | "BAD_LEAD" | "SALE_DONE";
  crm_note?: string;
  data_source?: "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots";
  possession_time?: string;
  description?: string;
}

interface SkippedRow {
  originalRow: RawCsvRow;
  reason: string;
}

interface ImportResult {
  imported: CrmRecord[];
  skipped: SkippedRow[];
  totalImported: number;
  totalSkipped: number;
  batchesProcessed: number;
  batchesFailed: number;
}
```

`crm_status` and `data_source` are closed vocabularies enforced both at the TypeScript type level and at runtime via Zod — any value outside the list is stripped by the validation layer, regardless of what the AI returns.

## 6. State and persistence

The system holds no database and no disk-persisted state:

- Uploaded files are held in memory for the duration of a request (Multer `memoryStorage`) and never written to disk.
- Background job state lives only in the backend process's memory (`job-store.service.ts`) and does not survive a server restart.
- All CRM data (imported and skipped rows) is returned directly to the client in the API response — the frontend is the only place results are displayed or exported from.

## 7. Cross-cutting concerns

- **Logging:** a single `logger` utility (`utils/logger.ts`) used throughout the backend for structured info/warn/error logs (CSV parsing outcomes, batch progress, Gemini errors, pipeline completion).
- **CORS:** configured in `app.ts` via the `FRONTEND_URL` environment variable, restricting which origin can call the API.
- **Error handling:** centralized in `error-handler.ts`, so controllers and services can simply throw typed errors and never need to construct HTTP responses themselves.