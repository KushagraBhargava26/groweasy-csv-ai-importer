# GrowEasy AI CSV Importer Architecture

## System Overview

GrowEasy follows a client-server architecture where the frontend parses user-selected CSV files and sends them to the backend for AI-powered extraction and CRM normalization.

---

# High-Level Architecture

```
                User

                  │

                  ▼

        Next.js Frontend

                  │

          Upload CSV

                  │

                  ▼

      PapaParse CSV Parser

                  │

       Parsed CSV Records

                  │

                  ▼

      Express Backend API

                  │

      Validation Layer

                  │

                  ▼

     Google Gemini API

                  │

 AI Structured CRM Extraction

                  │

                  ▼

   CRM Mapping & Validation

                  │

                  ▼

        JSON Response

                  │

                  ▼

       Next.js Frontend
```

---

# Frontend Architecture

```
App

│

├── Upload Component

├── CSV Preview

├── AI Import Action

├── Result Table

└── Status Components
```

---

# Backend Architecture

```
Server

↓

Routes

↓

Controller

↓

Services

↓

Validation

↓

Gemini AI

↓

CRM Mapper

↓

Response
```

---

# Request Lifecycle

```
Upload CSV

↓

PapaParse

↓

Preview

↓

POST /api/import

↓

Validation

↓

Gemini AI

↓

CRM Mapping

↓

Validation

↓

Frontend Response
```

---

# AI Processing Flow

```
CSV Headers

+

CSV Rows

↓

Prompt Generation

↓

Gemini API

↓

Structured Output

↓

CRM Mapping

↓

Validation

↓

Confidence Assignment

↓

Frontend
```

---

# Core Components

## Frontend

Responsible for

- Uploading files
- Previewing CSV data
- Calling backend APIs
- Displaying AI results

---

## Backend

Responsible for

- File handling
- Request validation
- AI communication
- CRM normalization
- Returning structured JSON

---

## Gemini AI

Responsible for

- Understanding CSV headers
- Interpreting row values
- Mapping fields
- Returning structured CRM records

---

# Deployment Architecture

```
Browser

↓

Next.js Frontend

↓

HTTPS

↓

Express Backend

↓

Google Gemini API
```

---

# Security

- Environment variables
- API key protection
- Request validation
- File size limits
- Input sanitization
- CORS configuration

---

# Scalability

The architecture supports future enhancements such as:

- Queue-based processing
- Parallel batch imports
- Database persistence
- Import history
- Authentication
- Background workers

---

# Supported Workflow

```
Upload CSV

↓

Preview Data

↓

AI Processing

↓

CRM Extraction

↓

Review Results

↓

Ready for Import
```