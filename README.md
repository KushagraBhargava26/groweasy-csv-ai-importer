# 🌱 GrowEasy AI CSV Importer

<div align="center">

![Next.js](https://img.shields.io/badge/Frontend-Next.js-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript)
![Express](https://img.shields.io/badge/Backend-Express-000000?style=for-the-badge&logo=express)
![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-4285F4?style=for-the-badge&logo=google)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**AI-powered CSV Importer that automatically transforms messy spreadsheets into structured CRM-ready records using Google Gemini AI.**

</div>

---

# 📖 Overview

GrowEasy AI CSV Importer enables users to upload CSV files from virtually any source and intelligently extract CRM lead information without requiring predefined templates or manual column mapping.

The system understands inconsistent column names, different layouts, and varied data formats, then converts them into a standardized CRM schema using Google Gemini AI.

---

# ✨ Features

- 📤 Drag & Drop CSV Upload
- 👀 Instant CSV Preview
- 🤖 AI-powered Field Mapping
- 📊 Automatic CRM Record Extraction
- ⚠ Confidence Indicators
- ✅ Validation of Records
- 🚫 Skip Invalid Records
- 📱 Responsive Interface
- ⚡ Batch Processing
- 🔄 Supports Different CSV Formats

---

# 🛠 Tech Stack

## Frontend

- Next.js
- React
- TypeScript
- PapaParse
- Lucide React

## Backend

- Express.js
- TypeScript
- Google Gemini API
- Multer
- Zod

---

# 📂 Project Structure

```
groweasy-csv-ai-importer

├── frontend
│   ├── app
│   ├── components
│   ├── lib
│   ├── public
│   └── package.json
│
├── backend
│   ├── src
│   │   ├── controllers
│   │   ├── middleware
│   │   ├── prompts
│   │   ├── routes
│   │   ├── services
│   │   ├── types
│   │   └── utils
│   ├── package.json
│   └── .env.example
│
├── README.md
├── ARCHITECTURE.md
└── Sample CSV Files
```

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone https://github.com/KushagraBhargava26/groweasy-csv-ai-importer.git

cd groweasy-csv-ai-importer
```

---

# 📦 Backend Installation

```bash
cd backend

npm install
```

Create environment file

```bash
cp .env.example .env
```

Add your Gemini API key

```env
GOOGLE_API_KEY=YOUR_API_KEY
```

Run development server

```bash
npm run dev
```

Build

```bash
npm run build
```

Run production

```bash
npm start
```

Default backend URL

```
http://localhost:8080
```

---

# 💻 Frontend Installation

```bash
cd frontend

npm install
```

Run development server

```bash
npm run dev
```

Build

```bash
npm run build
```

Run production

```bash
npm start
```

Frontend URL

```
http://localhost:3000
```

---

# ⚙ Environment Variables

Backend

```
GOOGLE_API_KEY=
PORT=8080
```

Frontend

Configure the backend API URL if required.

---

# 📋 CRM Fields

The AI extracts the following fields.

| Field | Required |
|--------|----------|
| Full Name | ✅ |
| Email | Optional |
| Phone | Optional |
| Company | Optional |
| Job Role | Optional |
| City | Optional |
| Remarks | Optional |

A record must contain at least **Email** or **Phone** to be considered valid.

---

# 📤 Usage

1. Launch the frontend.
2. Upload a CSV file.
3. Preview the parsed rows.
4. Start AI Import.
5. Wait for processing.
6. Review extracted CRM records.
7. Confirm import.

---

# 📄 Sample CSV

```csv
Candidate Name,Mail ID,Cell Number,Company,Designation,Location

John Doe,john@gmail.com,9876543210,Google,SDE,Bangalore
```

---

# 📡 API

## Import CSV

```
POST /api/import
```

Returns normalized CRM records.

---

# 🧪 Running Tests

Backend tests

```bash
cd backend

npm test
```

Watch mode

```bash
npm run test:watch
```

---

# 🚀 Deployment

## Frontend

```bash
npm run build
npm start
```

Deploy on

- Vercel

---

## Backend

```bash
npm run build
npm start
```

Deploy on

- Render
- Railway
- Any Node.js hosting

---

# 🔒 Validation

The application validates

- CSV format
- Empty rows
- Invalid emails
- Missing phone numbers
- Required CRM fields

---

# 📁 Sample Test Files

The repository includes several sample CSV files for testing different scenarios.

- Valid CSV
- Empty CSV
- Invalid Records
- Adult Dataset

---

# 📚 Documentation

- `README.md` — Project documentation
- `ARCHITECTURE.md` — System architecture

---

# 🛣 Future Improvements

- Excel (.xlsx) support
- Import history
- Duplicate detection
- Authentication
- Background jobs
- Progress tracking

---

# 🤝 Contributing

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push to your fork.
5. Open a Pull Request.

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

**Kushagra Bhargava**

GitHub:
https://github.com/KushagraBhargava26

Repository:
https://github.com/KushagraBhargava26/groweasy-csv-ai-importer

---

⭐ If you found this project useful, consider giving it a star.