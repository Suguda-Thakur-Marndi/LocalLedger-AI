# LocalLedger AI

<p align="center">
  <strong>Your receipts. Your data. Your AI. Your computer.</strong><br>
  <em>A 100% sovereign, local-first invoice and expense management system with zero cloud dependencies.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Privacy-100%25%20Local-success?style=flat-square&logo=shield" alt="100% Local" />
  <img src="https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-blue?style=flat-square&logo=python" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Ollama-qwen2.5-black?style=flat-square&logo=ollama" alt="Ollama" />
  <img src="https://img.shields.io/badge/OCR-Tesseract%20%2B%20PyMuPDF-orange?style=flat-square" alt="Tesseract OCR" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
</p>

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. The Sovereign Privacy Manifesto](#2-the-sovereign-privacy-manifesto)
- [3. Target Audience & Use Cases](#3-target-audience--use-cases)
- [4. Core Features & Capabilities](#4-core-features--capabilities)
- [5. System Architecture & Processing Pipeline](#5-system-architecture--processing-pipeline)
- [6. Technology Stack](#6-technology-stack)
- [7. Repository Structure](#7-repository-structure)
- [8. Hardware & Software Prerequisites](#8-hardware--software-prerequisites)
- [9. Quick Start & Installation](#9-quick-start--installation)
  - [Windows Installation](#windows-installation)
  - [Linux & macOS Installation](#linux--macos-installation)
  - [Docker & Docker Compose](#docker--docker-compose)
- [10. Local AI (Ollama) Setup & Model Selection](#10-local-ai-ollama-setup--model-selection)
- [11. Local OCR (Tesseract) Installation](#11-local-ocr-tesseract-installation)
- [12. Environment Configuration Reference](#12-environment-configuration-reference)
- [13. REST API Specification](#13-rest-api-specification)
- [14. Development & Operation Workflow](#14-development--operation-workflow)
- [15. Database Migrations (Alembic)](#15-database-migrations-alembic)
- [16. Testing & Quality Assurance](#16-testing--quality-assurance)
- [17. Security & Threat Model](#17-security--threat-model)
- [18. Troubleshooting & FAQ](#18-troubleshooting--faq)
- [19. Roadmap](#19-roadmap)
- [20. Contributing & License](#20-contributing--license)

---

## 1. Executive Summary

**LocalLedger AI** is a production-grade, local-first invoice and receipt processing platform designed for freelancers, solopreneurs, students, and independent contractors. It provides the intelligent receipt parsing, field extraction, and financial reporting typically found in high-end SaaS accounting software, but runs **100% locally on your own machine**.

- **Zero Cloud AI Egress**: Documents, vendor records, tax identifiers, and spending amounts are never transmitted to OpenAI, Anthropic, Google, or any remote server.
- **Zero Cloud OCR**: Document vision and optical character recognition run exclusively via local binaries (`Tesseract OCR` and `PyMuPDF`).
- **Zero Third-Party Telemetry**: No trackers, cookies, external analytics beacons, or remote logging.
- **True Offline Capability**: Once dependencies and model weights are installed, the entire system operates seamlessly without an active internet connection.

---

## 2. The Sovereign Privacy Manifesto

> *"Your receipts. Your data. Your AI. Your computer."*

Modern cloud expense platforms turn your sensitive financial documents into training fodder and telemetry streams. Invoices contain:
- Personal home addresses and client business names
- Government tax registration numbers (GST, VAT, EIN, SSN)
- Proprietary project names, line-item descriptions, and hourly rates
- Bank account details, transaction routing hints, and private expenditure habits

**LocalLedger AI rejects multi-tenant cloud storage for personal finances.** All processing is constrained to your hardware loopback adapter (`127.0.0.1`), backed by local SQLite storage, deterministic file deduplication, and open-weight LLMs hosted locally via Ollama.

---

## 3. Target Audience & Use Cases

| Persona | Primary Benefit |
|---|---|
| **Freelancers & Solopreneurs** | Rapidly digitize receipts into IRS/HMRC-compliant expense categories with instant CSV exports for tax season. |
| **Students & Side Hustlers** | Track project tools, software subscriptions, and hardware purchases on everyday laptop hardware without recurring SaaS bills. |
| **Independent Contractors** | Maintain an audit-ready, tamper-evident ledger of client billables with cryptographic deduplication. |
| **Privacy-Conscious Professionals** | Prevent vendor agreements and private billing records from leaking to third-party commercial AI model trainers. |

---

## 4. Core Features & Capabilities

### Document Ingestion & Validation
- **Drag-and-Drop Ingestion**: Instant batch uploading for PDF, PNG, JPEG, and WebP receipts.
- **Magic-Byte Signature Inspection**: Enforces true binary signatures (`%PDF-`, `\x89PNG`, `\xff\xd8\xff`, `RIFF...WEBP`) to block spoofed file extensions.
- **SHA-256 Deduplication**: Generates deterministic cryptographic hashes of every file upon upload. Duplicate uploads display advisory banners with direct links to existing transactions.
- **File System Hardening**: Incoming files are sanitized and renamed with UUIDs within a restricted upload directory to prevent path traversal attacks.

### Dual-Engine Text & OCR Pipeline
- **Native PDF Text Extraction**: Extracts crisp digital text layers directly with PyMuPDF before invoking OCR.
- **High-DPI Page Rendering & OCR**: Scanned documents and image receipts are rendered locally and parsed via Tesseract OCR.
- **Graceful Engine Fallback**: If Tesseract is not installed or the binary is missing, the backend catches degradation gracefully, relying on native PDF text and heuristic rules rather than crashing.

### Local AI Extraction & Heuristics
- **Neural Extraction via Ollama**: Connects to your local Ollama daemon to parse unstructured text into structured financial JSON using open-weight models (`qwen2.5:3b` or `qwen2.5:1.5b`).
- **Prompt Injection Defense**: Untrusted receipt text is wrapped inside strict `<RECEIPT_TEXT>` boundary tags; system prompts explicitly instruct the model to treat text as inert data.
- **Deterministic Heuristic Fallback**: When Ollama is offline or the model is not loaded, the application transparently falls back to regex-based heuristic extraction without interrupting workflow.

### Split-Screen Review Workspace
- **Side-by-Side Inspection**: Review original document previews (with 50%–200% zoom, 90° rotation, and fullscreen inspection) alongside an interactive financial form.
- **Provenance & Confidence Indicators**: Visual badges indicate whether each field was detected via Local AI or Heuristic Rules, accompanied by confidence scores.
- **Mathematical Integrity Validation**: Flags discrepancies when $\text{Subtotal} + \text{Tax} \neq \text{Total}$, taking discounts, tips, and rounding into account.
- **On-Demand Re-Extraction**: Click a single button to re-trigger OCR and local LLM interpretation if document settings change.

### Precision Accounting & Multi-Currency Ledger
- **Decimal-Safe Financial Arithmetic**: Eliminates IEEE 754 floating-point rounding errors by utilizing Python `Decimal` and SQLite `Numeric(12, 2)`.
- **Multi-Currency Segregation**: Strict isolation across currencies (USD, EUR, GBP, CAD, AUD, JPY, MYR, INR, etc.). Prevents erroneous summation of distinct currencies.
- **Full Ledger Controls**: Paginated ledger with full-text search across merchants, notes, and file names, alongside filters for category, currency, review status, and date range.
- **Transaction Life-Cycle**: Complete manual transaction creation, inline editing modal, and cascading deletions that automatically remove associated files from disk.

### Analytics, Reporting & Sovereignty
- **Interactive Visualizations**: Spending trend charts (AreaChart) and category breakdown distributions powered by Recharts.
- **Streaming CSV Export**: Filter by date range, category, or currency and export standard CSV files ready for accountant handoff.
- **Complete JSON Backup**: One-click download of all transactions and document metadata in portable JSON format.
- **Irreversible Sovereign Wipe**: Nuclear database wipe requiring explicit confirmation (`DELETE LOCAL DATA`) to delete all database rows and uploaded files.

---

## 5. System Architecture & Processing Pipeline

```mermaid
flowchart TD
    subgraph Client ["Client Browser (React 19 + TypeScript + Vite)"]
        UI_Dash["Dashboard & Visual Analytics"]
        UI_Upload["Multi-File Ingestion Queue"]
        UI_Review["Split-Screen Review Workspace"]
        UI_Ledger["Transactions Ledger & Filters"]
        UI_Reports["Reports & Streaming CSV Export"]
        UI_Settings["Settings, Health & Sovereign Wipe"]
    end

    subgraph BackendAPI ["FastAPI Service (127.0.0.1:8000)"]
        Router["Versioned Router (/api/v1)"]
        Security["File Signature, UUID Sanitizer & SHA-256"]
        PDFParser["PyMuPDF Native Text Parser"]
        OCRService["Tesseract OCR Engine"]
        RuleExtractor["Deterministic Regex Fallback"]
        DecValidator["Decimal Monetary Validator"]
    end

    subgraph LocalInference ["Local Inference Daemon"]
        Ollama["Ollama Loopback (127.0.0.1:11434)"]
        Model["qwen2.5:3b / qwen2.5:1.5b"]
    end

    subgraph LocalDisk ["Local Sovereign Storage"]
        SQLite[("SQLite DB: data/db/localledger.db")]
        Uploads[("Filesystem: data/uploads/")]
    end

    UI_Upload -->|Multipart File Stream| Router
    Router --> Security
    Security -->|Sanitized UUID File| Uploads
    Security --> PDFParser
    PDFParser -->|Scanned Pixmap| OCRService
    PDFParser -->|Extracted Text| Ollama
    OCRService -->|Text Stream| Ollama
    Ollama -.->|JSON Structured Output| DecValidator
    OCRService -->|Text Stream (If Ollama Offline)| RuleExtractor
    RuleExtractor -.->|Fallback Fields| DecValidator
    DecValidator --> UI_Review
    UI_Review -->|Confirm & Save Receipt| Router
    Router -->|ACID Transaction| SQLite
    Router -->|Stream CSV / JSON| UI_Reports
    UI_Dash <-->|Query Metrics| Router
    UI_Ledger <-->|Paginated CRUD| Router
    UI_Settings -->|Health / Wipe Trigger| Router
```

### Document Ingestion Flow
1. **Upload & Verification**: The client uploads a receipt. The backend validates file magic bytes and computes the SHA-256 digest.
2. **Text Extraction**: PyMuPDF attempts digital text extraction. If the document is an image or scanned PDF, it falls back to Tesseract OCR after pre-processing.
3. **Structured Extraction**: Extracted text is dispatched to the local Ollama instance (`/api/generate`) with temperature 0.1 for deterministic JSON extraction.
4. **Heuristic Fallback**: If Ollama is unreachable or returns unparseable output, regex rules extract monetary amounts, dates, and vendor names.
5. **Review & Reconcile**: The user inspects the document in the split-screen workspace, adjusts fields if necessary, and confirms.
6. **Commit**: The transaction is committed with exact `Decimal` precision to SQLite.

---

## 6. Technology Stack

### Frontend Architecture
- **Core Framework**: React 19 (`19.2.8`) with TypeScript in strict mode
- **Build Tool**: Vite (`8.3.0`) with Hot Module Replacement (HMR)
- **Styling & Design System**: Tailwind CSS (`3.4.17`), custom fintech color tokens, and Google Material Symbols
- **State Management & Data Fetching**: TanStack Query v5 (`@tanstack/react-query 5.104.2`)
- **Routing**: React Router v7 (`react-router-dom 7.18.4`)
- **Charts & Data Visualization**: Recharts (`3.10.1`)
- **Testing**: Vitest (`5.0.4`), React Testing Library, and `jsdom`
- **Linting**: Oxlint (`1.81.0`)

### Backend Architecture
- **Language & Runtime**: Python 3.11, 3.12, or 3.13
- **Web Framework**: FastAPI (`0.115.0+`) with ASGI server Uvicorn (`uvicorn[standard] 0.32.0+`)
- **Database & ORM**: SQLAlchemy 2.0 (`2.0.36+`) configured with `PRAGMA foreign_keys=ON`
- **Schema Migrations**: Alembic (`1.14.0+`)
- **Data Validation & Settings**: Pydantic v2 (`2.9.0+`) & Pydantic Settings (`2.6.0+`)
- **HTTP Client**: HTTPX (`0.27.2+`)
- **Document Processing**: PyMuPDF (`pymupdf 1.24.11+`), Pillow (`10.4.0+`), pytesseract (`0.3.13+`), python-multipart
- **Code Quality & Testing**: pytest (`8.3.3+`), pytest-asyncio (`0.24.0+`), Ruff (`0.7.0+`)

---

## 7. Repository Structure

```text
LocalLedger AI/
├── .env.example             # Complete environment configuration template
├── alembic.ini              # Alembic database migration configuration
├── docker-compose.yml       # Production-ready dual-container deployment
├── Makefile                 # Convenient developer automation targets
├── LICENSE                  # MIT License
├── README.md                # Project documentation (this file)
├── CONTRIBUTING.md          # Contribution standards and coding guidelines
│
├── backend/                 # FastAPI Python backend service
│   ├── Dockerfile           # Backend container build specification
│   ├── requirements.txt     # Python production and development dependencies
│   ├── pyproject.toml       # Ruff linter and tool configurations
│   ├── alembic/             # Database migration versions and environment
│   │   └── versions/        # Migration revision scripts
│   ├── app/
│   │   ├── main.py          # FastAPI application entrypoint, CORS & middleware
│   │   ├── api/v1/          # Versioned API endpoints
│   │   │   ├── endpoints/   # Modular route controllers
│   │   │   │   ├── documents.py    # Document upload, view, review, reextract
│   │   │   │   ├── health.py       # System health & engine checks
│   │   │   │   ├── receipts.py     # Receipt confirmation endpoint
│   │   │   │   ├── reports.py      # Dashboard summary & streaming CSV export
│   │   │   │   ├── settings.py     # System telemetry, backup, sovereign wipe
│   │   │   │   └── transactions.py # Paginated transactions CRUD
│   │   │   └── router.py    # Consolidated v1 API router
│   │   ├── core/            # Configuration, logging, errors, and security
│   │   ├── db/              # SQLAlchemy engine, session, and declarative base
│   │   ├── models/          # ORM data models (Document, Transaction)
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   └── services/        # Domain service layer
│   │       ├── ai/          # Ollama client, prompt templates, neural extractor
│   │       ├── ocr/         # Tesseract OCR, PyMuPDF parser, image preprocessor
│   │       ├── receipts/    # Regex heuristic parser and monetary validation
│   │       ├── reports/     # Financial summary metrics & CSV generator
│   │       └── transactions/# Transaction persistence and query operations
│   ├── scripts/             # Verification and test automation scripts
│   └── tests/               # Pytest test suite (19 test suites)
│
├── frontend/                # React 19 + TypeScript + Vite frontend
│   ├── Dockerfile           # Multi-stage production container build
│   ├── package.json         # NPM scripts and frontend dependencies
│   ├── vite.config.ts       # Vite build and proxy configuration
│   ├── tailwind.config.js   # Tailored fintech design tokens and palette
│   └── src/
│       ├── App.tsx          # Application router and QueryClient setup
│       ├── components/      # Reusable layout and UI components
│       ├── features/        # Feature modules
│       │   ├── dashboard/   # DashboardPage.tsx (Charts, summary cards)
│       │   ├── receipts/    # UploadPage, ReceiptReviewPage, ReceiptsPage
│       │   ├── transactions/# TransactionsPage.tsx (Ledger, filter drawer)
│       │   ├── reports/     # ReportsPage.tsx (Date filter, CSV exporter)
│       │   └── settings/    # SettingsPage.tsx (Health check, data wipe)
│       ├── lib/             # API client, formatting utilities, helpers
│       ├── test/            # Vitest unit and integration tests
│       └── types/           # TypeScript domain interfaces
│
├── data/                    # Local persistent storage (gitignored)
│   ├── db/                  # SQLite database file (localledger.db)
│   └── uploads/             # Sanitized local receipt files and documents
│
└── docs/                    # Architectural and security documentation
    ├── architecture.md      # Detailed system design
    ├── development.md       # Developer quickstart and workflows
    └── privacy.md           # The Sovereign Financial Threat Model
```

---

## 8. Hardware & Software Prerequisites

- **Operating System**: Windows 10/11, macOS (Apple Silicon or Intel), or Linux (Ubuntu, Debian, Fedora, Arch).
- **Python**: Version 3.11, 3.12, or 3.13.
- **Node.js**: Version 20.x, 22.x, or 24.x with `npm`.
- **Git**: For version control.
- **RAM**:
  - Minimum: 8 GB RAM (runs comfortably with `qwen2.5:1.5b` or in OCR Heuristic mode).
  - Recommended: 16 GB RAM (allows running `qwen2.5:3b` or `qwen2.5:7b` alongside other apps).
- **Disk Space**: ~3 GB free disk space for dependencies and local LLM weights.

---

## 9. Quick Start & Installation

### Windows Installation

1. **Clone the repository**:
   ```powershell
   git clone https://github.com/your-username/localledger-ai.git
   cd localledger-ai
   ```

2. **Initialize Environment Configuration**:
   ```powershell
   Copy-Item .env.example .env
   ```

3. **Configure Python Backend**:
   ```powershell
   python -m venv backend\.venv
   backend\.venv\Scripts\pip install -r backend\requirements.txt
   backend\.venv\Scripts\alembic upgrade head
   ```

4. **Install Frontend Dependencies**:
   ```powershell
   cd frontend
   npm install
   cd ..
   ```

5. **Start Services**:
   - **Terminal 1 (Backend - via PowerShell script)**:
     ```powershell
     cd backend
     .\scripts\start_backend.ps1
     ```
     *Alternatively, direct Python command:*
     ```powershell
     cd backend
     .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
     ```
     *Or from the repository root:*
     ```powershell
     .\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
     ```
   - **Terminal 2 (Frontend)**:
     ```powershell
     cd frontend
     npm run dev
     ```
   - Access the web interface at **[http://127.0.0.1:5173](http://127.0.0.1:5173)** and backend API docs at **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**.

---

### Linux & macOS Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/localledger-ai.git
   cd localledger-ai
   ```

2. **Initialize Environment Configuration**:
   ```bash
   cp .env.example .env
   ```

3. **Configure Python Backend**:
   ```bash
   python3 -m venv backend/.venv
   source backend/.venv/bin/activate
   pip install -r backend/requirements.txt
   alembic upgrade head
   ```

4. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

5. **Start Services**:
   - **Terminal 1 (Backend)**:
     ```bash
     source backend/.venv/bin/activate
     uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
     ```
   - **Terminal 2 (Frontend)**:
     ```bash
     cd frontend
     npm run dev
     ```

---

### Docker & Docker Compose

Deploy the complete frontend and backend services in an isolated local container network:

```bash
docker-compose up --build
```

- **Frontend**: Accessible at `http://127.0.0.1:5173`
- **Backend**: Accessible at `http://127.0.0.1:8000`
- **Ollama Integration**: Configured to communicate with host Ollama via `host.docker.internal:11434`.

---

## 10. Local AI (Ollama) Setup & Model Selection

LocalLedger AI communicates with Ollama over loopback (`http://127.0.0.1:11434`).

1. **Install Ollama**:
   Download and install from **[ollama.com](https://ollama.com)**.

2. **Pull the Recommended Model**:
   ```bash
   # Balanced choice: exceptional extraction accuracy on receipts (~2.0 GB VRAM)
   ollama pull qwen2.5:3b

   # Lightweight alternative for 8 GB RAM systems (~1.0 GB VRAM)
   ollama pull qwen2.5:1.5b
   ```

3. **Verify Daemon**:
   ```bash
   ollama list
   ```

4. **Automatic Detection**:
   When Ollama is running, LocalLedger AI automatically detects the model, displaying an **Ollama AI: Online** status indicator in the top navigation bar.

> [!TIP]
> **No Ollama? No Problem!** If Ollama is not installed or the daemon is paused, LocalLedger AI switches to **Heuristic OCR Mode**. Receipts continue to be parsed accurately using regex extraction.

---

## 11. Local OCR (Tesseract) Installation

Tesseract OCR is recommended for processing photographed or scanned paper receipts.

### Windows
1. Download the installer from the [UB-Mannheim Tesseract Wiki](https://github.com/UB-Mannheim/tesseract/wiki).
2. Install to the default directory: `C:\Program Files\Tesseract-OCR\tesseract.exe`.
3. If installed to a custom directory, set `TESSERACT_CMD` in your `.env` file:
   ```env
   TESSERACT_CMD=D:\CustomApps\Tesseract-OCR\tesseract.exe
   ```

### Ubuntu / Debian
```bash
sudo apt-get update && sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
```

### macOS
```bash
brew install tesseract
```

---

## 12. Environment Configuration Reference

The application reads configurations from `.env` in the repository root. All settings have secure, local-first defaults:

| Variable | Default Value | Description |
|---|---|---|
| `APP_ENV` | `development` | Environment mode (`development`, `production`, `test`). |
| `BACKEND_HOST` | `127.0.0.1` | Loopback IP address for backend server. |
| `BACKEND_PORT` | `8000` | Port for the FastAPI backend service. |
| `FRONTEND_PORT` | `5173` | Port for the Vite frontend development server. |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000/api/v1` | Backend API URL accessed by the frontend client. |
| `DATA_DIR` | `data` | Base directory for local persistence. |
| `DB_PATH` | `data/db/localledger.db` | Relative or absolute path to SQLite database. |
| `UPLOAD_DIR` | `data/uploads` | Directory where uploaded receipts are securely stored. |
| `MAX_UPLOAD_SIZE_MB` | `25` | Maximum allowed file upload size in megabytes. |
| `MAX_PDF_PAGES` | `15` | Maximum pages extracted from a single PDF invoice. |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Loopback address for Ollama daemon (must be loopback). |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Target Ollama model name (e.g., `qwen2.5:3b`, `qwen2.5:1.5b`). |
| `OLLAMA_TIMEOUT_SECONDS` | `60` | Request timeout before falling back to heuristic parsing. |
| `TESSERACT_CMD` | `""` | Path to `tesseract.exe` (empty to auto-detect from PATH). |
| `ALLOWED_ORIGINS` | `http://localhost:5173,...` | Comma-delimited list of permitted CORS origins. |
| `LOG_LEVEL` | `INFO` | Console logging verbosity (`DEBUG`, `INFO`, `WARNING`). |

---

## 13. REST API Specification

Interactive OpenAPI documentation is hosted at `http://127.0.0.1:8000/docs`.

### Health & Telemetry
- `GET /api/v1/health`
  - Returns backend health, SQLite connection state, OCR engine status, and connected Ollama models.

### Document Management
- `POST /api/v1/documents/upload`
  - Multipart file upload. Validates magic bytes, calculates SHA-256 hash, runs extraction, and stores the file.
  - Returns document ID, duplicate status, and existing transaction ID if duplicate.
- `GET /api/v1/documents/{document_id}/file`
  - Serves original receipt file locally with safe canonical path verification.
- `GET /api/v1/documents/{document_id}/review`
  - Retrieves review payload including extracted fields, confidence metrics, warnings, and OCR text preview.
- `POST /api/v1/documents/{document_id}/reextract`
  - Forces a complete re-run of OCR and local Ollama inference on an existing uploaded document.

### Receipts & Transactions
- `POST /api/v1/receipts/confirm`
  - Commits verified receipt review data as an immutable transaction.
- `GET /api/v1/transactions`
  - Paginated list of transactions with support for full-text search, filtering (category, currency, review status, date range), and sorting.
- `POST /api/v1/transactions`
  - Manually create a transaction without uploading a physical document.
- `GET /api/v1/transactions/{id}`
  - Retrieve details for a specific transaction.
- `PUT /api/v1/transactions/{id}`
  - Update merchant, date, amounts, category, or notes.
- `DELETE /api/v1/transactions/{id}`
  - Delete a transaction and automatically clean up associated files from disk.

### Reports & Analytics
- `GET /api/v1/reports/dashboard`
  - Aggregated multi-currency financial metrics, category breakdowns, and monthly spending trends.
- `GET /api/v1/reports/export`
  - Streams filtered transaction data directly as an RFC 4180-compliant CSV download.

### Settings & Sovereign Controls
- `GET /api/v1/settings/status`
  - System storage footprint, total documents, total transactions, and engine readiness.
- `POST /api/v1/settings/check-ollama`
  - Triggers an instant probe of the local Ollama daemon.
- `GET /api/v1/settings/export-backup`
  - Exports a verified ZIP archive containing a consistent SQLite database snapshot, all receipt and invoice assets, and a machine-readable `manifest.json` with SHA-256 hashes. Also supports `?format=json` for legacy JSON metadata. See [Disaster Recovery Guide](docs/disaster-recovery.md) for restoration procedures.
- `POST /api/v1/settings/delete-all`
  - Permanently erases all database tables and uploaded files. Requires payload `{"confirm_text": "DELETE LOCAL DATA"}`.

---

## 14. Development & Operation Workflow

### Using the Project Makefile
For environments with `make` installed:

```bash
# Setup both backend virtualenv and frontend dependencies
make setup

# Run backend development server
make dev-backend

# Run frontend development server
make dev-frontend

# Run all test suites
make test

# Run code formatters and linters
make lint
make format
```

### Manual Verification Script
Run the end-to-end verification script to test pipeline ingestion, duplicate detection, and fallback modes:

```powershell
backend\.venv\Scripts\python backend\scripts\verify_complete_workflow.py
```

---

## 15. Database Migrations (Alembic)

Database schema migrations are managed via Alembic in `backend/alembic/`.

- **Apply all migrations**:
  ```bash
  cd backend
  alembic upgrade head
  ```
- **Create a new migration revision**:
  ```bash
  cd backend
  alembic revision --autogenerate -m "add_field_name"
  ```
- **Roll back to previous revision**:
  ```bash
  cd backend
  alembic downgrade -1
  ```

---

## 16. Testing & Quality Assurance

LocalLedger AI maintains robust test coverage across both backend and frontend.

### Backend Test Suite (pytest)
```powershell
# Windows
backend\.venv\Scripts\pytest -v

# Linux / macOS
cd backend && pytest -v
```
- **Coverage**: 19 tests validating health checks, file upload restrictions, magic byte validation, PDF text extraction, OCR degradation, Ollama mocking, transaction CRUD, reports, and settings.

### Frontend Test Suite (Vitest)
```bash
cd frontend
npm run test
```
- **Coverage**: 4 test suites (7 tests) covering Dashboard states, upload dropzone validation, Split-Screen Review rendering, and Transactions ledger interactions.

### Code Quality & Static Analysis
```bash
# Backend linting & format check
backend\.venv\Scripts\ruff check .
backend\.venv\Scripts\ruff format --check .

# Frontend TypeScript strict check
cd frontend
npm run build
```

---

## 17. Security & Threat Model

| Threat Vector | Mitigation Strategy | Limitation / Note |
|---|---|---|
| **Cloud AI Data Leaks** | Zero external LLM API keys or endpoints. Only loopback Ollama (`127.0.0.1:11434`) is permitted. | Host machine must remain free of unauthorized network monitors. |
| **Server-Side Request Forgery (SSRF)** | Pydantic validator strictly rejects `OLLAMA_BASE_URL` if hostname is not `127.0.0.1`, `localhost`, or `host.docker.internal`. | Prevents attackers from redirecting inference to external networks. |
| **Malicious File Uploads** | True file magic bytes are verified. Client-supplied MIME types and file extensions are distrusted. | OS-level document viewer zero-days remain dependent on host operating system updates. |
| **Path Traversal Attacks** | UUID storage names and canonical directory resolution prevent escaping `data/uploads/`. | None. |
| **Prompt Injection** | OCR text is enclosed in inert XML `<RECEIPT_TEXT>` tags with strict system instructions prohibiting instruction execution. | Open-weight models are instructed to extract data only, not execute instructions. |
| **Physical At-Rest Theft** | SQLite and upload files reside locally on disk in unencrypted form. | Users should enable OS-level full disk encryption (BitLocker, FileVault, LUKS) for at-rest physical protection. |
| **Multi-Tenant Networks** | Servers bind to `127.0.0.1` by default. | Do not bind to `0.0.0.0` on public Wi-Fi without an authenticating reverse proxy (e.g., Tailscale or Caddy). |

See [docs/privacy.md](docs/privacy.md) for the complete threat model and sovereign manifesto.

---

## 18. Troubleshooting & FAQ

### 1. Ollama status shows "Offline" in the UI
- Check if Ollama is running in your terminal: `ollama list`.
- Test access in your browser or with curl: `curl http://127.0.0.1:11434/api/tags`.
- Navigate to the **Settings** page in LocalLedger AI and click **"Test Connection"**.

### 2. Tesseract is installed but backend reports OCR unavailable
- On Windows, verify if Tesseract is located at `C:\Program Files\Tesseract-OCR\tesseract.exe`.
- If installed elsewhere, add the absolute path to your `.env`:
  ```env
  TESSERACT_CMD=D:\CustomPath\Tesseract-OCR\tesseract.exe
  ```
- Restart the backend server.

### 3. Port 8000 or 5173 is already in use
- Change `BACKEND_PORT=8001` or `FRONTEND_PORT=5174` in `.env`.
- Ensure `VITE_API_BASE_URL` in `.env` matches your new backend port.

### 4. "Database locked" or SQLite errors during heavy testing
- LocalLedger AI configures SQLite with `check_same_thread=False` and timeout locks. Ensure only one instance of the backend process is running against the database file.

### 5. Document text is empty after uploading an image
- Ensure Tesseract is installed for image files (JPEG, PNG, WebP).
- For PDFs, digital text is extracted automatically via PyMuPDF even without Tesseract.

---

## 19. Roadmap

- [ ] **Multi-Page Receipt Stitcher**: Automated alignment and stitching for multi-page or folded receipts.
- [ ] **Tax Season Exporters**: Export directly to QIF, OFX, and TurboTax-compatible formats.
- [ ] **Visual Bounding Box Highlighting**: Interactive bounding boxes over the receipt preview image during field editing.
- [ ] **Encrypted Backup Vaults**: Password-protected AES-256 zip backups of the SQLite database and upload assets.
- [ ] **Category Auto-Rules**: User-definable regex and merchant matching rules for automated custom categorization.

---

## 20. Contributing & License

### Contributing
Contributions from the open-source community are welcome!
1. Fork the repository and create your feature branch: `git checkout -b feature/my-new-feature`.
2. Follow code standards: run `ruff check` on Python code and ensure `npm run build` passes on the frontend.
3. Open a Pull Request with a clear description of your changes.
4. See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### License
- **LocalLedger AI** is open-source software licensed under the [MIT License](LICENSE).
- **Default AI Models**: `qwen2.5:3b` and `qwen2.5:1.5b` are licensed under the Apache 2.0 license by the Qwen Team.
