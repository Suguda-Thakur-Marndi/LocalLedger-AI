# LocalLedger AI — Development Guide

## Prerequisites

- **Python**: 3.11 or newer (Python 3.13 tested)
- **Node.js**: v20 or newer (Node v24 tested) with npm
- **Tesseract OCR** (optional, recommended for scanned paper receipts):
  - Windows: Download installer from [UB-Mannheim Tesseract](https://github.com/UB-Mannheim/tesseract/wiki).
  - Ubuntu/Debian: `sudo apt-get install tesseract-ocr`
  - macOS: `brew install tesseract`
- **Ollama** (optional, recommended for structured LLM reasoning):
  - Download installer from [ollama.com](https://ollama.com).
  - Pull initial model candidate: `ollama run qwen2.5:3b`

---

## Quickstart

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\alembic upgrade head
.venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# On Linux/macOS:
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173` in your browser.

---

## Running Tests

### Backend Tests (pytest)

```bash
cd backend
.venv\Scripts\pytest -v
```

### Frontend Tests (Vitest & Testing Library)

```bash
cd frontend
npm run test
```

### Code Quality & Linting

```bash
# Python Linting & Formatting
cd backend
.venv\Scripts\ruff check .
.venv\Scripts\ruff format .

# Frontend Production TypeScript Compilation
cd frontend
npm run build
```

---

## Database Migrations

When altering SQLAlchemy models in `backend/app/models/`:

```bash
cd backend
.venv\Scripts\alembic revision --autogenerate -m "describe_change"
.venv\Scripts\alembic upgrade head
```
