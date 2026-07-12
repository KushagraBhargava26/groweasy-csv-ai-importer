# GrowEasy CSV AI Importer

An AI-powered importer that takes an arbitrary lead-export CSV — from Facebook Lead Ads, Google Ads, a real-estate CRM, a manually built spreadsheet, whatever — and maps it into the GrowEasy CRM schema using Google's Gemini model, with a full upload → preview → AI mapping → review → import → results flow.

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
- [Using the importer](#using-the-importer)
- [API reference](#api-reference)
- [Running tests](#running-tests)
- [Building for production](#building-for-production)
- [Sample data](#sample-data)
- [Troubleshooting](#troubleshooting)
- [Useful links](#useful-links)

---

## Features

- **Header-agnostic CSV mapping** — column names can be anything; the AI infers meaning from both header and cell value.
- **Multi-step guided flow** — Upload → Preview → AI Mapping Preview → Review & Confirm → Processing → Results.
- **Background job processing** — large files are processed as a background job on the server; the client polls for progress instead of holding a request open.
- **Live progress tracking** — batch-by-batch progress, imported/skipped counts, while the import runs.
- **Sample mapping preview** — runs the real AI pipeline on the first 5 rows so you can sanity-check the mapping before committing to the full file.
- **Validation & guardrails** — schema-validated AI output, controlled vocabularies for `crm_status` and `data_source`, and a mandatory "must have email or mobile" rule enforced in code (not just prompted).
- **Skipped-row reporting** — every row that couldn't be imported is reported back with a reason.
- **Light/dark theme** toggle in the UI.

---

## Project structure

```
groweasy-csv-ai-importer/
├── frontend/                      # Next.js app (upload + preview UI)
│   ├── src/
│   │   ├── app/                   # App Router entry (page.tsx, layout.tsx)
│   │   ├── components/
│   │   │   ├── upload/            # CSV file picker / drag-drop
│   │   │   ├── preview/           # Raw CSV preview + processing view
│   │   │   ├── mapping/           # AI mapping preview + review/confirm
│   │   │   ├── results/           # Final import results view
│   │   │   ├── layout/            # Topbar, step indicator, theme toggle
│   │   │   └── shared/            # Import summary panel
│   │   ├── contexts/               # ThemeContext
│   │   ├── lib/                    # api-client.ts, csv-parser.ts, sample-csv.ts
│   │   └── types/                  # Shared TS types (mirrors backend types)
│   └── package.json
├── backend/                        # Express API + AI extraction pipeline
│   ├── src/
│   │   ├── server.ts                # Process entry point
│   │   ├── app.ts                   # Express app factory (middleware, routes)
│   │   ├── routes/                  # /api/import routes
│   │   ├── controllers/             # Request handlers
│   │   ├── services/
│   │   │   ├── csv-parser.service.ts     # CSV → row objects (PapaParse)
│   │   │   ├── batching.service.ts       # Splits rows into batches
│   │   │   ├── ai-extraction.service.ts  # Calls Gemini per batch
│   │   │   ├── crm-mapper.service.ts     # Orchestrates the full pipeline
│   │   │   ├── validation.service.ts     # Zod validation + business rules
│   │   │   └── job-store.service.ts      # In-memory background job store
│   │   ├── prompts/                 # Gemini system prompt
│   │   ├── middleware/               # Upload limits, error handler
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

---

## Getting a Gemini API key

The backend calls the Gemini API (`gemini-3.1-flash-lite` model) to do the actual CSV → CRM field extraction, so you'll need an API key before the backend will start.

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
| `NEXT_PUBLIC_API_BASE_URL` | No | `http://localhost:5000` | Base URL the frontend uses to call the backend API. |

---

## Running the app

You need **two terminals** — one for the backend, one for the frontend.

**Terminal 1 — backend:**

```bash
cd backend
npm run dev
```

The API will start on `http://localhost:5000` (or whatever `PORT` you set). You should see a `Server running on port 5000` log line. Verify it's healthy:

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

Open that URL in your browser to use the importer.

---

## Using the importer

The UI walks through six steps:

1. **Upload** — choose or drag-drop a `.csv` file (max 10MB).
2. **Preview** — see the raw parsed CSV rows before anything is sent to the AI.
3. **AI Mapping Preview** — the backend runs the real Gemini extraction pipeline on the first 5 rows so you can check mapping quality on a small sample.
4. **Review & Confirm** — a checkpoint before committing to processing the entire file.
5. **Processing** — the full file is processed as a background job; the UI polls for live progress (batches completed, imported/skipped counts).
6. **Results** — final counts of imported vs. skipped records, with skip reasons, once the job completes.

You can use any of the files in [`test-data/`](./test-data) to try it out (see [Sample data](#sample-data) below).

---

## API reference

Base URL: `http://localhost:5000` (or your configured `PORT`).

### `GET /health`

Health check.

```
200 OK
{ "status": "ok" }
```

### `POST /api/import/process`

Starts a background import job for the full CSV file. Returns immediately with a `jobId` — the client is expected to poll `GET /api/import/status/:jobId` for progress and the final result.

- **Body:** `multipart/form-data` with a `file` field containing the `.csv` file.
- **Response:** `202 Accepted`
  ```json
  { "jobId": "c1b2a3d4-..." }
  ```

### `GET /api/import/status/:jobId`

Returns the current state of a background job.

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
  `status` is one of `pending | processing | completed | failed`. When `completed`, `result` contains the full `ImportResult` (see below). When `failed`, `error` contains a message.
- **404** if the `jobId` is unknown or has expired (jobs are kept in memory for 30 minutes).

### `POST /api/import/preview-mapping`

Runs the real AI extraction pipeline synchronously on just the first 5 rows of the uploaded file — used to power the "AI Mapping" preview step.

- **Body:** `multipart/form-data` with a `file` field.
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
| `400` | Bad request — missing/empty file, non-CSV file, unparseable CSV |
| `404` | Job not found or expired |
| `429` | Gemini rate limit hit (after retries exhausted) |
| `502` | Gemini API/response error |
| `500` | Unexpected server error |

---

## Running tests

Backend tests use [Vitest](https://vitest.dev/):

```bash
cd backend
npm run test        # single run
npm run test:watch  # watch mode
```

Test coverage includes the CRM mapper, job store, and validation service (see `backend/src/services/*.test.ts`).

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

Remember to set `GEMINI_API_KEY`, `FRONTEND_URL` (backend) and `NEXT_PUBLIC_API_BASE_URL` (frontend) appropriately for your production environment.

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

## Troubleshooting

**Backend fails to start with `GEMINI_API_KEY is not set in the environment (.env)`**
→ You haven't created `backend/.env` or it's missing the key. See [Configuration](#configuration).

**Frontend shows network errors calling the API**
→ Check that the backend is running and that `NEXT_PUBLIC_API_BASE_URL` (frontend) matches the backend's actual `PORT`, and that `FRONTEND_URL` (backend) matches the frontend's actual origin (CORS).

**Import job status returns 404**
→ Jobs are kept in memory only and expire after 30 minutes, and are lost on server restart. Start a new import.

**Getting `429` / rate limit errors**
→ You're on the Gemini free tier (15 requests/minute) and processing a very large file, or making many imports back to back. The backend already retries with backoff, but persistent errors mean you may need to wait longer between imports or use a paid Gemini tier.

**Uploaded file is rejected**
→ Only `.csv` files up to 10MB are accepted. Check the file extension and size.

---

## Useful links

- [Next.js documentation](https://nextjs.org/docs)
- [Express documentation](https://expressjs.com/)
- [Google AI Studio](https://aistudio.google.com/apikey) — get a Gemini API key
- [Gemini API documentation](https://ai.google.dev/gemini-api/docs)
- [`@google/genai` SDK](https://www.npmjs.com/package/@google/genai)
- [Zod documentation](https://zod.dev/)
- [PapaParse documentation](https://www.papaparse.com/docs)
- [Vitest documentation](https://vitest.dev/)
- [Tailwind CSS documentation](https://tailwindcss.com/docs)