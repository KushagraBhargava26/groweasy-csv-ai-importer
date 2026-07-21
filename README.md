# GrowEasy CSV/Excel AI Importer

A full-stack application that imports CSV and Excel files, uses Google Gemini to map extracted data into a predefined CRM schema, validates the generated records, and provides a guided import workflow.

---

## Table of Contents

- [Overview](#overview)
- [Live Demo](#live-demo)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Docker](#docker)
- [API Overview](#api-overview)
- [Implementation Notes](#implementation-notes)
- [Documentation](#documentation)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## Overview

This project was built as part of the GrowEasy AI CSV Importer assignment.

The goal is to simplify importing lead data from spreadsheets into a CRM. Since exported CSV and Excel files often use different column names and structures, the backend uses the Google Gemini API to infer field mappings and convert the uploaded data into a predefined CRM schema.

The application provides a guided workflow that allows users to preview uploaded data, review AI-generated mappings, monitor import progress, and download the final results.

---

## Live Demo

| Service | Link |
|----------|------|
| Frontend | https://groweasy-frontend-beta.vercel.app |
| Backend Health | https://groweasy-backend-8p8t.onrender.com/health |

> [!NOTE]
> The backend is hosted on Render's free tier. If the service has been idle, the first request may take around 30–60 seconds while it starts.

---

## Features

- Import CSV and Excel (`.xlsx`) files
- Multi-sheet Excel workbook support
- Preview uploaded data before import
- AI-assisted field mapping using Google Gemini
- Review generated mappings before processing
- Background job processing for large imports
- Real-time progress updates
- Record validation using Zod
- Export imported and skipped records
- Responsive interface with light and dark mode
- Docker support for frontend and backend

---

## Screenshots

> Screenshots will be added here.

```text
docs/images/upload.png
docs/images/mapping.png
docs/images/results.png
```

---

## Tech Stack

| Category | Technologies |
|-----------|--------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Backend | Express.js, Node.js |
| AI | Google Gemini API (`@google/genai`) |
| Validation | Zod |
| File Processing | PapaParse, ExcelJS |
| Testing | Vitest |
| Deployment | Vercel, Render |
| Containerization | Docker |

---

## Architecture

```text
             CSV / Excel
                  │
                  ▼
          Next.js Frontend
                  │
                  ▼
          Express Backend
                  │
                  ▼
      Google Gemini API
                  │
                  ▼
      Validation Pipeline
                  │
                  ▼
          CRM Data Mapping
                  │
                  ▼
          Import Results
```

A more detailed explanation is available in **ARCHITECTURE.md**.

---

## Project Structure

```text
groweasy-csv-ai-importer/
│
├── frontend/
├── backend/
├── test-data/
│
├── README.md
├── ARCHITECTURE.md
├── ENGINEERING.md
└── API.md
```

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm
- Google Gemini API Key

Clone the repository.

```bash
git clone https://github.com/KushagraBhargava26/groweasy-csv-ai-importer.git

cd groweasy-csv-ai-importer
```

Install backend dependencies.

```bash
cd backend
npm install
```

Install frontend dependencies.

```bash
cd ../frontend
npm install
```

---

## Configuration

Backend (`backend/.env`)

```env
PORT=5000
GEMINI_API_KEY=your_api_key
FRONTEND_URL=http://localhost:3000
```

Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

---

## Running the Application

Start the backend.

```bash
cd backend
npm run dev
```

Start the frontend.

```bash
cd frontend
npm run dev
```

The application will be available at:

Frontend

```
http://localhost:3000
```

Backend

```
http://localhost:5000
```

---

## Docker

Both frontend and backend include Dockerfiles.

Backend

```bash
cd backend

docker build -t groweasy-backend .

docker run \
  --env-file .env \
  -p 5000:5000 \
  groweasy-backend
```

Frontend

```bash
cd frontend

docker build \
  -t groweasy-frontend .

docker run \
  -p 3000:3000 \
  groweasy-frontend
```

---

## API Overview

| Endpoint | Description |
|----------|-------------|
| GET `/health` | Backend health check |
| POST `/api/import/xlsx-sheets` | List Excel worksheet names |
| POST `/api/import/preview-mapping` | Preview AI-generated mappings |
| POST `/api/import/process` | Start an import job |
| GET `/api/import/status/:jobId` | Retrieve job status |

Complete request and response examples are available in **API.md**.

---

## Implementation Notes

Some implementation details worth noting:

- Import jobs are processed asynchronously.
- The frontend polls the backend for job status while processing is running.
- AI responses are validated before records are accepted.
- Uploaded files are processed in batches.
- Jobs are stored in memory for this implementation.

Additional design decisions and trade-offs are documented in **ENGINEERING.md**.

---

## Documentation

Additional documentation is available in the following files:

- 📘 [Architecture](ARCHITECTURE.md)
- ⚙️ [Engineering Notes](ENGINEERING.md)
- 🔌 [API Reference](API.md)

---

## Future Improvements

Some possible improvements include:

- Persist import jobs in a database
- Resume jobs after page refresh
- WebSocket-based progress updates
- User authentication
- Import history
- Support additional spreadsheet formats

---

## License

This project is licensed under the MIT License.