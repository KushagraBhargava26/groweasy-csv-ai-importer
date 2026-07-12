# GrowEasy CSV/Excel AI Importer

An AI-powered importer that takes an arbitrary lead-export file — CSV or Excel, from Facebook Lead Ads, Google Ads, a real-estate CRM, a manually built spreadsheet, whatever — and maps it into the GrowEasy CRM schema using Google's Gemini model, with a full upload → preview → AI mapping → review → import → results flow.

- **Frontend:** Next.js 16 (React 19, TypeScript, Tailwind CSS 4)
- **Backend:** Express (TypeScript), Google Gemini via `@google/genai`

For a deeper look at how the system is put together, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Table of contents

- [Features](#features)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting a Gemini API key](#getting-a-gemini-api-key)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the app](#running-the-app)
- [Running with Docker](#running-with-docker)
- [Using the importer](#using-the-importer)
- [API reference](#api-reference)
- [Notable engineering decisions](#notable-engineering-decisions)
- [Running tests](#running-tests)
- [Building for production](#building-for-production)
- [Sample data](#sample-data)
- [Known limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Useful links](#useful-links)

---

## Features

- **Header-agnostic mapping** — column names can be anything; the AI infers meaning from both header and cell value.
- **CSV and Excel (.xlsx) support** — including multi-sheet workbooks, where the user picks which sheet to import.
- **Multi-step guided flow** — Upload → Preview → AI Mapping Preview → Review & Confirm → Processing → Results.
- **Background job processing** — large files are processed as a background job on the server; the client polls for progress instead of holding a request open.
- **Live progress tracking** — real batch-by-batch progress and running imported/skipped counts while the import runs (not simulated — see [Notable engineering decisions](#notable-engineering-decisions)).
- **Sample mapping preview** — runs the real AI pipeline on the first 5 rows so you can sanity-check the mapping before committing to the full file.
- **Validation & guardrails** — schema-validated AI output, controlled vocabularies for `crm_status` and `data_source`, and a mandatory "must have email or mobile" rule enforced in code (not just prompted).
- **Skipped-row reporting** — every row that couldn't be imported is reported back with a reason.
- **Export options** — download imported records or skipped records (with reasons) as CSV, plus an example schema CSV.
- **Light/dark theme** toggle in the UI.
- **Dockerized** — both frontend and backend ship with multi-stage Dockerfiles.

---

## Project structure

```
groweasy-csv-ai-importer/
├── frontend/                      # Next.js app (upload + preview UI)
│   ├── Dockerfile, .dockerignore
│   ├── src/
│   │   ├── app/                   # App Router entry (page.tsx, layout.tsx)
│   │   ├── components/
│   │   │   ├── upload/            # File picker / drag-drop, incl. Excel sheet picker
│   │   │   ├── preview/           # Raw CSV preview + processing view
│   │   │   ├── mapping/           # AI mapping preview + review/confirm
│   │   │   ├── results/           # Final import results view
│   │   │   ├── layout/            # Topbar, step indicator, theme toggle
│   │   │   └── shared/            # Import summary panel (shared by Processing + Results)
│   │   ├── contexts/               # ThemeContext
│   │   ├── lib/                    # api-client.ts, csv-parser.ts, sample-csv.ts
│   │   └── types/                  # Shared TS types (mirrors backend types)
│   └── package.json
├── backend/                        # Express API + AI extraction pipeline
│   ├── Dockerfile, .dockerignore
│   ├── src/
│   │   ├── server.ts                # Process entry point
│   │   ├── app.ts                   # Express app factory (middleware, routes)
│   │   ├── routes/                  # /api/import routes
│   │   ├── controllers/             # Request handlers
│   │   ├── services/
│   │   │   ├── csv-parser.service.ts     # CSV → row objects (PapaParse)
│   │   │   ├── xlsx-parser.service.ts    # Excel → row objects (exceljs)
│   │   │   ├── batching.service.ts       # Splits rows into batches
│   │   │   ├── ai-extraction.service.ts  # Calls Gemini per batch
│   │   │   ├── crm-mapper.service.ts     # Orchestrates the full pipeline (format-agnostic)
│   │   │   ├── validation.service.ts     # Zod validation + business rules
│   │   │   └── job-store.service.ts      # In-memory background job store
│   │   ├── prompts/                 # Gemini system prompt
│   │   ├── middleware/               # Upload limits (CSV + xlsx), error handler
│   │   ├── types/                    # Shared TS types
│   │   └── utils/                    # Logger
│   ├── .env.example
│   └── package.json
├── test-data/                       # Sample CSVs for manual testing
└── README.md
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | **≥ 18.0.0** | Required by the backend (`engines` in `package.json`). Node 20 LTS recommended. |
| npm | bundled with Node | Yarn/pnpm also work, but examples below use npm. |
| A Google Gemini API key | — | Free tier available. See below. |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | — | Optional — only needed if you want to run via containers instead of `npm run dev`. |

---

## Getting a Gemini API key

The backend calls the Gemini API (`gemini-3.1-flash-lite` model) to do the actual field extraction, so you'll need an API key before the backend will start.

1. Go to **[Google AI Studio](https://aistudio.google.com/apikey)**.
2. Sign in with a Google account.
3. Click **"Create API key"** (create a new Google Cloud project if prompted).
4. Copy the generated key — you'll paste it into `backend/.env` in the next section.

Additional reference: [Gemini API documentation](https://ai.google.dev/gemini-api/docs) and [`@google/genai` SDK on npm](https://www.npmjs.com/package/@google/genai).

> **Free tier note:** The free tier caps requests at 15/minute. The backend is already tuned to stay under this (see `ARCHITECTURE.md`), so no extra configuration is needed to use a free-tier key.

---

## Installation

Clone or unzip the project, then install dependencies for **both** the frontend and backend — they are separate npm projects with separate `package.json` files.

```bash
# from the project root
cd backend
npm install

cd ../frontend
npm install
```

---

## Configuration

### Backend (`backend/.env`)

Copy the example file and fill in your values:

```bash
cd backend
cp .env.example .env
```

`backend/.env`:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
FRONTEND_URL=http://localhost:3000
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Port the Express server listens on. |
| `GEMINI_API_KEY` | **Yes** | — | Your Gemini API key from Google AI Studio. The server **will fail to start** without it. |
| `FRONTEND_URL` | No | `http://localhost:3000` | Used to configure CORS — must match wherever the frontend is actually served from. |

### Frontend (`frontend/.env.local`)

Only needed if your backend isn't running on the default `http://localhost:5000` (e.g. a different port, or a deployed backend URL).

```bash
cd frontend
touch .env.local
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | No | `http://localhost:5000` | Base URL the frontend uses to call the backend API. **Note:** for Docker builds this is inlined at build time — see [Running with Docker](#running-with-docker). |

---

## Running the app

You need **two terminals** — one for the backend, one for the frontend.

**Terminal 1 — backend:**

```bash
cd backend
npm run dev
```

The API will start on `http://localhost:5000` (or whatever `PORT` you set). Verify it's healthy:

```bash
curl http://localhost:5000/health
# {"status":"ok"}
```

**Terminal 2 — frontend:**

```bash
cd frontend
npm run dev
```

The UI will be available at **[http://localhost:3000](http://localhost:3000)**.

---

## Running with Docker

Both services have multi-stage Dockerfiles (a build stage compiles/bundles everything, a slim final stage ships only what's needed at runtime — no source, no dev dependencies).

### Backend

```bash
cd backend
docker build -t groweasy-backend .
docker run -d -p 5000:5000 --env-file .env groweasy-backend
curl http://localhost:5000/health
```

### Frontend

Next.js inlines `NEXT_PUBLIC_*` environment variables into the client bundle **at build time**, so the backend URL must be passed as a **build argument**, not just a runtime env var — passing it to `docker run` alone has no effect:

```bash
cd frontend
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-backend-url -t groweasy-frontend .
docker run -d -p 3000:3000 groweasy-frontend
```

Both images run as a non-root user (Alpine's built-in `node` user) rather than root.

If a port is already in use locally (e.g. you also have `npm run dev` running), map to a different host port: `-p 3001:3000` for the frontend, `-p 5001:5000` for the backend.

---

## Using the importer

The UI walks through six steps:

1. **Upload** — choose or drag-drop a `.csv` or `.xlsx` file (max 10MB). For Excel workbooks with more than one sheet, you'll be asked which sheet to import.
2. **Preview** — for CSV, see the raw parsed rows before anything is sent to the AI, with column visibility controls. (Excel files skip this step and go straight to AI Mapping — see [Known limitations](#known-limitations).)
3. **AI Mapping Preview** — the backend runs the real Gemini extraction pipeline on the first 5 rows so you can check mapping quality on a small sample.
4. **Review & Confirm** — a checkpoint before committing to processing the entire file.
5. **Processing** — the full file is processed as a background job; the UI polls for live progress (batches completed, real running imported/skipped counts).
6. **Results** — final counts of imported vs. skipped records with skip reasons, plus CSV downloads for both.

You can use any of the files in [`test-data/`](./test-data) to try it out (see [Sample data](#sample-data) below).

---

## API reference

Base URL: `http://localhost:5000` (or your configured `PORT`).

### `GET /health`

```
200 OK
{ "status": "ok" }
```

### `POST /api/import/xlsx-sheets`

Cheap, sheet-names-only endpoint for Excel files — returns the sheet names in a workbook without parsing any row data. Used to power the sheet picker before the user commits to a specific sheet.

- **Body:** `multipart/form-data` with a `file` field (`.xlsx`).
- **Response:** `200 OK`
```json
  { "sheetNames": ["Sheet1", "Q3 Leads"] }
```

### `POST /api/import/process`

Starts a background import job for the full file. Returns immediately with a `jobId` — the client is expected to poll `GET /api/import/status/:jobId` for progress and the final result.

- **Body:** `multipart/form-data` with:
  - `file` — the `.csv` or `.xlsx` file
  - `sheetName` — **required for `.xlsx` files**, the name of the sheet to import (omit for CSV)
- **Response:** `202 Accepted`
```json
  { "jobId": "c1b2a3d4-..." }
```

### `GET /api/import/status/:jobId`

- **Response:** `200 OK`
```json
  {
    "status": "processing",
    "totalRows": 1000,
    "totalBatches": 100,
    "batchesCompleted": 42,
    "importedSoFar": 390,
    "skippedSoFar": 30,
    "result": null,
    "error": null
  }
```
  `status` is one of `pending | processing | completed | failed`. `importedSoFar`/`skippedSoFar` are real running totals updated after every batch, not an estimate. When `completed`, `result` contains the full `ImportResult` (see below). When `failed`, `error` contains a message.
- **404** if the `jobId` is unknown or has expired (jobs are kept in memory for 30 minutes).

### `POST /api/import/preview-mapping`

Runs the real AI extraction pipeline synchronously on just the first 5 rows of the uploaded file.

- **Body:** `multipart/form-data` with `file`, and `sheetName` (required for `.xlsx`, same as above).
- **Response:** `200 OK`
```json
  {
    "totalRows": 1000,
    "sampleResult": { "imported": [...], "skipped": [...], "totalImported": 5, "totalSkipped": 0, "batchesProcessed": 1, "batchesFailed": 0 }
  }
```

### `ImportResult` shape

```ts
interface ImportResult {
  imported: CrmRecord[];
  skipped: SkippedRow[];
  totalImported: number;
  totalSkipped: number;
  batchesProcessed: number;
  batchesFailed: number;
}
```

### Error responses

All errors follow the shape `{ "error": "message" }` with an appropriate HTTP status:

| Status | Meaning |
|---|---|
| `400` | Bad request — missing/empty file, unsupported file type, unparseable file, or a missing `sheetName` on an Excel upload |
| `404` | Job not found or expired |
| `429` | Gemini rate limit hit (after retries exhausted) |
| `502` | Gemini API/response error |
| `500` | Unexpected server error |

---

## Notable engineering decisions

A few things that weren't obvious going in and took real debugging to get right:

- **Matching AI output back to source rows by a stable `_row_id`, never by array position.** The AI is instructed to omit skipped rows from its output entirely rather than mark them, so the output array can be shorter than the input at any point — index-based matching would silently misattribute every row after the first skip.
- **Batch size is capped at 10.** Batches of 20 combined with the schema's 16 required fields per object triggered a deterministic `400` from Gemini — an undocumented schema-complexity ceiling. 10 works reliably; this number is empirical, not arbitrary.
- **The Gemini response schema marks all fields `required` and sets `maxItems` to the batch's row count.** Without both, the model would occasionally return incomplete/duplicated records, or leak reasoning text directly into a field's value.
- **Background job architecture, not one synchronous request.** An early version awaited all batches concurrently in a single request — this blew past Gemini's free-tier rate limit (15 req/min) and the platform's request timeout on large files. The fix: return a `jobId` immediately, process sequentially with a fixed delay between batches (~14.3 req/min), and let the frontend poll for status.
- **`exceljs` was chosen over the more common npm `xlsx` (SheetJS) package for Excel parsing, on security grounds.** `npm audit` on `xlsx` showed a high-severity prototype pollution vulnerability with no available fix on npm (SheetJS's patched builds are only distributed via their own CDN, not npm). Since this is a real file-upload feature accepting untrusted binary input, that tradeoff wasn't accepted — `exceljs` was used instead, which carries only a minor, unreachable transitive advisory.
- **The live "imported/skipped so far" counts on the Processing screen are real**, not simulated — the backend's batch loop reports its actual running totals after every batch via the job store, not just a batch-completion count.

---

## Running tests

Backend tests use [Vitest](https://vitest.dev/):

```bash
cd backend
npm run test        # single run
npm run test:watch  # watch mode
```

Test coverage includes CSV parsing, batching, AI extraction error handling, validation (including the skip rule and enum whitelisting), and job-store state transitions (see `backend/src/services/*.test.ts`).

The frontend does not currently have a test script beyond linting:

```bash
cd frontend
npm run lint
```

---

## Building for production

**Backend:**

```bash
cd backend
npm run build   # compiles TypeScript to dist/
npm start       # runs dist/server.js
```

**Frontend:**

```bash
cd frontend
npm run build
npm start
```

Remember to set `GEMINI_API_KEY`, `FRONTEND_URL` (backend) and `NEXT_PUBLIC_API_BASE_URL` (frontend, at build time) appropriately for your production environment. See [Running with Docker](#running-with-docker) for the containerized equivalent.

---

## Sample data

The [`test-data/`](./test-data) directory contains ready-to-use CSVs for trying out the importer:

| File | Purpose |
|---|---|
| `sample1.csv` | Small, quick smoke-test file |
| `test-dataset-50.csv` | 50-row dataset |
| `sample_leads_1000.csv` | 1000-row dataset, useful for exercising the background job/polling flow |
| `test-multi-batch.csv` | Sized to span multiple AI batches |

Additional edge-case files at the project root: `empty-test.csv` (empty file), `all-invalid-test.csv` (no rows with email/mobile), `adult.csv`, `test-multi-contact.csv` (rows with multiple emails/phones).

---

## Known limitations

- **No database** — fully stateless by design, per the assignment's explicit allowance.
- **In-memory job store** — safe only because the backend runs as a single persistent process; would need a real external store (e.g. Redis) if ever deployed multi-instance or serverless.
- **No `jobId` persistence across a page refresh** — reloading mid-import loses the ability to reconnect to a still-running job (the job itself keeps running server-side).
- **No client-side row preview for Excel files** — CSV gets a full virtualized preview table; Excel currently goes straight from the sheet picker into AI Mapping. This is a deliberate scope cut, not an oversight.
- **Large files are slow but correct** — a deliberate reliability-over-speed tradeoff to stay on Gemini's free tier.
- **Render's free tier cold-starts** — the first request after inactivity can take 30–60 seconds (if deployed there).

---

## Troubleshooting

**Backend fails to start with `GEMINI_API_KEY is not set in the environment (.env)`**
→ You haven't created `backend/.env` or it's missing the key. See [Configuration](#configuration).

**Frontend shows network errors calling the API**
→ Check that the backend is running and that `NEXT_PUBLIC_API_BASE_URL` (frontend) matches the backend's actual `PORT`, and that `FRONTEND_URL` (backend) matches the frontend's actual origin (CORS). If you're running via Docker, remember the frontend's API URL is baked in at build time — rebuild the image if it changes.

**Import job status returns 404**
→ Jobs are kept in memory only and expire after 30 minutes, and are lost on server restart. Start a new import.

**Getting `429` / rate limit errors**
→ You're on the Gemini free tier (15 requests/minute) and processing a very large file, or making many imports back to back. The backend already retries with backoff, but persistent errors mean you may need to wait longer between imports or use a paid Gemini tier.

**Uploaded file is rejected**
→ Only `.csv` and `.xlsx` files up to 10MB are accepted. For Excel, make sure a `sheetName` was actually selected before confirming import.

**`docker build` fails with a TLS handshake timeout pulling `node:20-alpine`**
→ This is a Docker Desktop networking issue, not a Dockerfile problem. Restart Docker Desktop completely (quit from the tray icon, reopen, wait for "Docker Desktop is running") and retry.

**`docker run` fails with "ports are not available"**
→ Something else (often your own `npm run dev`) is already using that port. Map to a different host port, e.g. `-p 3001:3000`.

---

## Useful links

- **Live demo (frontend):** https://groweasy-frontend-beta.vercel.app
- **Live backend health check:** https://groweasy-backend-8p8t.onrender.com/health
- **Repo:** https://github.com/KushagraBhargava26/groweasy-csv-ai-importer
- **Architecture doc:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Google AI Studio (get a Gemini API key):** https://aistudio.google.com/apikey
- **Gemini API docs:** https://ai.google.dev/gemini-api/docs
- **`@google/genai` SDK on npm:** https://www.npmjs.com/package/@google/genai
- **exceljs on npm:** https://www.npmjs.com/package/exceljs
- **PapaParse docs:** https://www.papaparse.com/docs
- **Vitest docs:** https://vitest.dev/