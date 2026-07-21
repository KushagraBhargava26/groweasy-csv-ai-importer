> [!NOTE]
> This document focuses on the internal architecture of the application. For setup instructions and project overview, see the main README.

## Table of Contents

- [1. System Overview](#1-system-overview)
- [2. Request Flow](#2-request-flow-end-to-end)
- [3. Frontend Architecture](#3-frontend-architecture)
- [4. Backend Architecture](#4-backend-architecture)
- [5. Data Model](#5-data-model)
- [6. State and Persistence](#6-state-and-persistence)
- [7. Cross-cutting Concerns](#7-cross-cutting-concerns)
- [8. Containerization](#8-containerization)

  **Live deployment:** 
  [Frontend](https://groweasy-frontend-beta.vercel.app) · [Backend health check](https://groweasy-backend-8p8t.onrender.com/health)

## 1. System overview

The system is a two-tier application:

```
┌─────────────────────────┐        HTTP / multipart / JSON        ┌──────────────────────────┐
│  Frontend (Next.js)     │ ──────────────────────────────────────▶│  Backend (Express API)  │
│  localhost:3000         │◀──────────────────────────────────────  │  localhost:5000          │
└─────────────────────────┘                                        └────────────┬─────────────┘
                                                                                  │
                                                                                  │ generateContent()
                                                                                  ▼
                                                                       ┌──────────────────────┐
                                                                       │  Google Gemini API   │
                                                                       │ gemini-3.1-flash-lite│
                                                                       └──────────────────────┘
```

- The **frontend** is a Next.js (App Router) single-page flow that never talks to Gemini directly — it only talks to the backend.
- The **backend** is an Express API that owns all file parsing (CSV or Excel), batching, AI calls, and validation, and holds in-memory state only for tracking background job progress.
- The **AI provider** is Google Gemini, called once per batch of rows via the `@google/genai` SDK, with a structured JSON response schema.
- Both services also ship as Docker images (see §8) — same code, same behavior, just packaged as containers.

<p align="right">(<a href="#table-of-contents">Back to top ↑</a>)</p>

## 2. Request flow (end to end)

**CSV path** (unchanged from earlier versions):

```
 User                 Frontend                     Backend                    Gemini
  │                       │                            │                         │
  │  select .csv file     │                             │                        │
  ├──────────────────────▶│  parse locally for preview  │                        │
  │                       │  (csv-parser.ts, client)    │                        │
  │  confirm mapping step │                             │                        │
  ├──────────────────────▶│ POST /api/import/preview-mapping (file)              │
  │                       ├─────────────────────────────▶│                        │
  │                       │                             │  parseCsv() [server]   │
  │                       │                             │  sample first 5 rows   │
  │                       │                             │  runCrmImportPipeline()│
  │                       │                             ├───────────────────────▶│
  │                       │                             │◀───────────────────────┤
  │                       │◀─────────────────────────────│  200 { sampleResult }  │
  │  review & confirm     │                             │                        │
  ├──────────────────────▶│ POST /api/import/process (file)                     │
  │                       ├─────────────────────────────▶│                        │
  │                       │                             │  parseCsv()            │
  │                       │                             │  createJob()          │
  │                       │◀─────────────────────────────│  202 { jobId }         │
  │                       │  poll GET /status/:jobId     │  (job runs async,      │
  │                       ├─────────────────────────────▶│   not awaited by the   │
  │                       │◀─────────────────────────────│   request handler)     │
  │                       │        ... repeats ...       │  batch 1 ──▶ Gemini    │
  │                       │                             │  batch 2 ──▶ Gemini    │
  │                       │                             │  ... (importedSoFar/   │
  │                       │                             │   skippedSoFar update  │
  │                       │                             │   after every batch)   │
  │                       │◀─────────────────────────────│  { status: completed,  │
  │  view results         │                             │    result }            │
  ├──────────────────────▶│                             │                        │
```

**Excel path** (new — diverges before Preview, since there's no client-side row preview for `.xlsx`):

```
 User                 Frontend                     Backend
  │                       │                            │
  │  select .xlsx file    │                             │
  ├──────────────────────▶│ POST /api/import/xlsx-sheets (file)
  │                       ├─────────────────────────────▶│  listSheetNames() — cheap, no row parsing yet
  │                       │◀─────────────────────────────│  200 { sheetNames }
  │  pick a sheet         │                             │
  ├──────────────────────▶│ POST /api/import/preview-mapping (file, sheetName)
  │                       ├─────────────────────────────▶│  parseXlsxSheet() → runCrmImportPipeline()
  │                       │◀─────────────────────────────│  200 { sampleResult }
  │                       │   (jumps straight to the "AI Mapping" step —
  │                       │    Preview/raw-table step is skipped entirely for Excel)
  │  review & confirm     │                             │
  ├──────────────────────▶│ POST /api/import/process (file, sheetName)
  │                       │        ... same as CSV from here on ...
```

<p align="right">(<a href="#table-of-contents">Back to top ↑</a>)</p>

## 3. Frontend architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.

The UI is a single client-side page (`src/app/page.tsx`) driven by a `step` state machine:

```
upload → preview → mapping → review → processing → results
```

For Excel files, `preview` is skipped entirely — the upload step's sheet picker leads straight into `mapping`.

| Step         | Component                                                                               | Responsibility                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `upload`     | `components/upload/CsvUpload.tsx`                                                       | File picker (CSV or Excel). For CSV: client-side parse (`lib/csv-parser.ts`) for the raw preview. For Excel: fetches sheet names (`listXlsxSheets()`) and shows a sheet picker — no client-side spreadsheet parsing exists |
| `preview`    | `components/preview/CsvPreviewTable.tsx`                                                | Shows the raw parsed CSV rows as a virtualized table, with column visibility toggle and an example-schema CSV download. CSV only — Excel skips this step                                                                   |
| `mapping`    | `components/mapping/AiMappingPreview.tsx`                                               | Displays the AI's mapping of a 5-row sample, fetched via `previewMapping()`                                                                                                                                                |
| `review`     | `components/mapping/ReviewConfirm.tsx`                                                  | Final confirmation checkpoint before the full run                                                                                                                                                                          |
| `processing` | `components/preview/ProcessingView.tsx` + `components/shared/ImportSummaryPanel.tsx`    | Polls job status; shows live batch progress plus real, running imported/skipped counts (not simulated)                                                                                                                     |
| `results`    | `components/results/ImportResultsView.tsx` + `components/shared/ImportSummaryPanel.tsx` | Final imported/skipped summary, plus CSV downloads for both                                                                                                                                                                |

Shared layout pieces live in `components/layout/` (`Topbar` — a single unified top bar, no separate sidebar; `StepIndicator`; `ThemeToggle`), and theme state is provided by `contexts/ThemeContext.tsx`.

All backend communication is centralized in `lib/api-client.ts`, which exposes: `listXlsxSheets`, `startImportJob`, `getImportStatus`, `previewMapping` — the latter three now optionally accept a `sheetName` argument, used only for Excel uploads. Types in `src/types/crm-record.ts` mirror the backend's types (plus one frontend-only addition, `CRM_FIELDS`, used to generate accurate CSV exports) so the two stay structurally compatible.

<p align="right">(<a href="#table-of-contents">Back to top ↑</a>)</p>

## 4. Backend architecture

**Stack:** Express (TypeScript), Multer (file upload), PapaParse (CSV parsing), `exceljs` (Excel parsing), Zod (schema validation), `@google/genai` (Gemini SDK).

### 4.1 Layers

```
routes/          import.route.ts          → maps HTTP verbs+paths to controllers
controllers/     import.controller.ts     → request/response handling, job lifecycle,
                                             branches CSV vs. Excel parsing by file type
services/        csv-parser.service.ts    → CSV text → RawCsvRow[]
                 xlsx-parser.service.ts   → Excel workbook → RawCsvRow[] (same shape as CSV)
                 batching.service.ts      → RawCsvRow[] → Batch[]
                 ai-extraction.service.ts → Batch → Gemini call → parsed JSON
                 crm-mapper.service.ts    → orchestrates the full pipeline end-to-end,
                                             format-agnostic once rows are parsed
                 validation.service.ts    → Zod validation + business rules on AI output
                 job-store.service.ts     → in-memory job tracking for background runs,
                                             including live imported/skipped counters
middleware/      upload-limits.ts         → Multer config (memory storage, size/type limits,
                                             accepts both .csv and .xlsx — exported as
                                             `fileUpload`, not CSV-specific)
                 error-handler.ts         → centralized error → HTTP status mapping
prompts/         crm-extraction.prompt.ts → the Gemini system prompt
types/           crm-record.ts            → shared domain types
utils/           logger.ts                → structured logging
```

### 4.2 Routes

| Method | Path                          | Controller         | Behavior                                                                                                       |
| ------ | ----------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/health`                     | inline in `app.ts` | Liveness check                                                                                                 |
| `POST` | `/api/import/xlsx-sheets`     | `listXlsxSheets`   | Returns sheet names in an uploaded `.xlsx` workbook — no row parsing, no AI                                    |
| `POST` | `/api/import/process`         | `processImport`    | Starts a background job, returns `202` + `jobId`. Accepts an optional `sheetName` field (required for `.xlsx`) |
| `GET`  | `/api/import/status/:jobId`   | `getImportStatus`  | Returns job progress (including live `importedSoFar`/`skippedSoFar`) or the final result                       |
| `POST` | `/api/import/preview-mapping` | `previewMapping`   | Synchronous AI run on a 5-row sample. Also accepts an optional `sheetName`                                     |

### 4.3 The import pipeline (`crm-mapper.service.ts`)

This is the core orchestrator, used by both the background job and the sample-preview endpoint. It is completely agnostic to whether rows originated from CSV or Excel — that distinction is resolved one layer up, in the controller.

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
   └─▶ onBatchComplete(batchesCompleted, totalBatches, importedSoFar, skippedSoFar)
   │      — the running imported/skipped counts are real cumulative totals at this
   │        point in the loop, used to update the job store's live progress fields
   │
   ▼
ImportResult { imported, skipped, totalImported, totalSkipped, batchesProcessed, batchesFailed }
```

### 4.4 File parsing — CSV vs. Excel (`csv-parser.service.ts` / `xlsx-parser.service.ts`)

Both parsers produce the identical `RawCsvRow[]` shape (first row = headers, every cell value coerced to a trimmed string, blank rows filtered out) — this is what lets `crm-mapper.service.ts` stay completely format-agnostic downstream.

- **CSV** (`csv-parser.service.ts`): PapaParse, unchanged from earlier versions.
- **Excel** (`xlsx-parser.service.ts`): uses `exceljs`, not the more commonly used npm `xlsx` (SheetJS) package — `xlsx`'s npm-published build carries a high-severity prototype-pollution advisory with no available fix (SheetJS's patched builds are only distributed via their own CDN, not npm). Given this is a real file-upload feature accepting untrusted binary input, that risk wasn't accepted.
  - `listSheetNames()` — cheap, loads the workbook but only reads sheet names, no row data.
  - `parseXlsxSheet(buffer, sheetName)` — parses one named sheet. Handles exceljs's various cell value shapes (plain values, `Date` objects, formula results, rich text, hyperlinks) by normalizing all of them to plain strings in one place, for the same reason the CSV parser doesn't trust PapaParse's type inference: a phone number or date must not be silently reinterpreted before validation gets to see it.
  - A `sheetName` is always required for Excel processing — there is no silent "just use the first sheet" fallback, since that could quietly import the wrong data on a multi-sheet workbook.

### 4.5 AI extraction (`ai-extraction.service.ts`)

- Model: `gemini-3.1-flash-lite`, called via `ai.models.generateContent()`.
- A fixed `responseSchema` (built by `buildCrmRecordSchema`) forces a JSON array output where every object has all 16 fields present, including the echoed `_row_id`, and sets `maxItems` to the batch's row count.
- The system instruction is built once by `buildCrmExtractionPrompt()` and reused for every batch.
- Errors are normalized into an `AiExtractionError` with a `kind`: `QUOTA_EXCEEDED`, `MALFORMED_RESPONSE`, or `API_ERROR`, which downstream retry logic and the error-handler middleware key off of.
- Batch size is fixed at 10 rows — empirically required; larger batches combined with the schema's required-fields count trigger a deterministic `400` from Gemini.

### 4.6 Validation (`validation.service.ts`)

Runs on every record Gemini returns, independent of what the prompt asked for:

- Parses each record against a Zod schema (`crmRecordInputSchema`).
- Normalizes `created_at` (must be `Date`-parseable, else cleared).
- Whitelists `crm_status` against `CRM_STATUS_VALUES` and `data_source` against `DATA_SOURCE_VALUES` — anything else is dropped, never passed through.
- Enforces the "must have email or mobile" rule in code.
- Reconciles `_row_id`s against the original batch to produce `unmatchedIds` — rows the AI legitimately omitted per the skip rule.

### 4.7 Job store (`job-store.service.ts`)

An in-memory `Map<string, ImportJob>` backing the background-job endpoints:

- `createJob` / `getJob` / `updateJob` are the only entry points.
- Jobs carry `status` (`pending | processing | completed | failed`), progress counters (`batchesCompleted`, `totalBatches`), **live running totals** (`importedSoFar`, `skippedSoFar` — updated after every batch, not just at completion), and, once finished, the full `ImportResult` or an error message.
- A TTL sweep (30 minutes) removes stale jobs on each `createJob` call.

### 4.8 Middleware

- `upload-limits.ts` — Multer configured with in-memory storage, a 10MB file size cap, and a filter accepting both `.csv` and `.xlsx` (by MIME type or extension). Exported as `fileUpload` (not CSV-specific, despite the historical name still showing up in some older comments/docs).
- `error-handler.ts` — the single place that maps thrown errors (`CsvParseError`, `XlsxParseError`, Multer's file-type error, `AiExtractionError` by `kind`, anything else) to HTTP status codes and a uniform `{ error: string }` response body. Registered last in `app.ts` so it catches errors from every route.

<p align="right">(<a href="#table-of-contents">Back to top ↑</a>)</p>

## 5. Data model

```ts
type RawCsvRow = Record<string, string>; // arbitrary columns, all values as strings — same shape whether the source was CSV or Excel

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

<p align="right">(<a href="#table-of-contents">Back to top ↑</a>)</p>

## 6. State and persistence

The system holds no database and no disk-persisted state:

- Uploaded files (CSV or Excel) are held in memory for the duration of a request (Multer `memoryStorage`) and never written to disk.
- Background job state, including live progress counters, lives only in the backend process's memory (`job-store.service.ts`) and does not survive a server restart.
- All CRM data (imported and skipped rows) is returned directly to the client in the API response — the frontend is the only place results are displayed or exported from.

<p align="right">(<a href="#table-of-contents">Back to top ↑</a>)</p>

## 7. Cross-cutting concerns

- **Logging:** a single `logger` utility (`utils/logger.ts`) used throughout the backend for structured info/warn/error logs (file parsing outcomes, batch progress, Gemini errors, pipeline completion).
- **CORS:** configured in `app.ts` via the `FRONTEND_URL` environment variable, restricting which origin can call the API.
- **Error handling:** centralized in `error-handler.ts`, so controllers and services can simply throw typed errors and never need to construct HTTP responses themselves.

<p align="right">(<a href="#table-of-contents">Back to top ↑</a>)</p>

## 8. Containerization

Both services ship with multi-stage Dockerfiles — a build stage that installs full dependencies and compiles/bundles, and a slim final stage that ships only what's needed at runtime (no source, no dev tooling).

- **Backend:** final image runs `dist/server.js` directly, as a non-root user.
- **Frontend:** uses Next.js's `output: "standalone"` build mode to produce a minimal self-contained server, rather than shipping the full `node_modules` tree. Runs as a non-root user.

One nuance specific to the frontend image: `NEXT_PUBLIC_API_BASE_URL` is inlined into the client JavaScript bundle at `next build` time, not read at container-start time — so it must be passed as a Docker **build argument**, not a runtime environment variable, or the built app silently falls back to its `localhost:5000` default regardless of what's passed to `docker run`.

<p align="right">(<a href="#table-of-contents">Back to top ↑</a>)</p>

## Related Documentation

- [README.md](README.md) — Project overview and setup
- [ENGINEERING.md](ENGINEERING.md) — Design decisions and trade-offs
- [API.md](API.md) — REST API reference