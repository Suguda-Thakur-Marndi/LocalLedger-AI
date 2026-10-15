# LocalLedger AI - Windows Desktop Application Guide

This guide covers building, running, and packaging **LocalLedger AI** as a sovereign, production-grade Windows desktop application with an installable `.exe` (NSIS installer).

---

## 1. Desktop Architecture

The desktop application combines:
- **Electron Desktop Shell (`electron/main.ts`)**:
  - Secure main process with `contextIsolation: true`, `nodeIntegration: false`, and strict navigation filters.
  - Dynamically assigns an open local loopback port on `127.0.0.1` (checking 8000 first, or requesting an ephemeral port from the OS kernel).
  - Manages the lifecycle of the local FastAPI backend with process tree tracking (`taskkill /T /F` on Windows) to prevent orphaned processes.
  - Polls `/api/v1/health` until the backend is fully healthy before displaying the UI.
- **Typed Preload Bridge (`electron/preload.ts`)**:
  - Injects `window.desktopBridge` into the renderer, exposing `getApiBaseUrl()`, `getBackendPort()`, `isDesktopApp()`, and lifecycle event listeners without leaking Node.js or Electron internals.
- **Packaged FastAPI Backend (`dist/backend/localledger-backend/localledger-backend.exe`)**:
  - Standalone Windows binary packaged with PyInstaller, bundling the Python runtime, FastAPI, Uvicorn, SQLAlchemy, PyMuPDF, and Pillow.
  - End users do **not** require a system Python installation to run the packaged desktop app.
- **React 19 Renderer (`frontend/dist`)**:
  - Loaded locally with `HashRouter` for robust file-system routing and dynamic loopback API resolution.

---

## 2. Persistent Storage Architecture

All user financial data and receipts are stored strictly on the local machine in a dedicated, per-user application data directory:

- **Database Path**: `%APPDATA%\LocalLedger AI\data\db\localledger.db`
- **Receipt Uploads**: `%APPDATA%\LocalLedger AI\data\uploads`

### Automatic Data Migration
On first launch, if the `%APPDATA%\LocalLedger AI\data` directory does not yet contain a database, the desktop entrypoint automatically migrates existing development databases and uploaded files from the repository's `data/` directory so no existing ledger history or receipts are lost.

---

## 3. External Dependencies & Discovery

### Tesseract OCR
- Optical character recognition runs 100% locally on your computer.
- The desktop backend automatically discovers standard Tesseract installations:
  - `%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe` (standard per-user installer)
  - `C:\Program Files\Tesseract-OCR\tesseract.exe`
  - `C:\Program Files (x86)\Tesseract-OCR\tesseract.exe`
  - User's `PATH`
  - `TESSERACT_CMD` environment variable
- If Tesseract is not installed, LocalLedger AI operates in **Graceful Fallback Mode**: digital PDF receipts are still extracted natively via PyMuPDF text layers and deterministic heuristic regex rules without crashing.
- To install Tesseract on Windows: download the installer from [UB-Mannheim Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki).

### Ollama Neural Extraction
- Ollama runs locally on `http://127.0.0.1:11434`.
- The backend checks `/api/tags` on startup to detect Ollama daemon connectivity and model availability (default: `qwen2.5:1.5b`).
- If Ollama is offline or the model is not loaded, LocalLedger AI transparently falls back to heuristic rule extraction.
- To start Ollama:
  ```powershell
  ollama serve
  ollama pull qwen2.5:1.5b
  ```

---

## 4. Development & Running Desktop App

To run the desktop application in development mode with live hot reloading:

```powershell
# One-command desktop development launch:
npm run desktop:dev
```

### What happens automatically under the hood:
1. **Compiles Electron TypeScript**: Compiles `electron/main.ts` and `electron/preload.ts` into `dist-electron/`.
2. **Safe Loopback Port Discovery**: Tests `127.0.0.1:8000`. If occupied by another application, requests an available ephemeral loopback port from the OS kernel so no port conflicts occur.
3. **Backend Service Launch**: Spawns FastAPI using the backend virtual environment's Python executable (`backend\.venv\Scripts\python.exe`) with `backend/desktop_entry.py` bound strictly to `127.0.0.1`.
4. **Health Verification**: Polls `/api/v1/health` until the backend returns HTTP 200 before creating and displaying the application window. If startup fails, diagnostic error boxes display the exact captured Python/stderr traceback.
5. **Vite Dev Server Integration**: Probes `http://127.0.0.1:5173/`. If not already running, Electron automatically launches `npm --prefix frontend run dev` and awaits readiness.
6. **Secure Dynamic Bridge**: Electron injects the active loopback port and URL into `window.desktopBridge` so React connects seamlessly to the backend with zero hardcoding.
7. **Clean Process Lifecycle**: When the Electron window is closed, Electron terminates all child processes (backend and Vite dev server) using deterministic tree termination (`taskkill /pid <PID> /T /F`) without affecting any pre-existing or unrelated processes.

### Automated Verification Script:
To run the automated verification test for the desktop development launch:
```powershell
.\backend\.venv\Scripts\python.exe .\scripts\test_desktop_dev_launch.py
```

---

## 5. Building the Standalone Executable & Installer

### Step 1: Build the Standalone Python Backend
```powershell
npm run desktop:build-backend
```
*Compiles the FastAPI service using PyInstaller into `dist/backend/localledger-backend/localledger-backend.exe`.*

### Step 2: Build the React Frontend
```powershell
npm run desktop:build-frontend
```
*Compiles the React 19 + TypeScript frontend with Vite into `frontend/dist`.*

### Step 3: Build Electron TypeScript
```powershell
npm run desktop:build-electron
```
*Compiles `electron/main.ts` and `electron/preload.ts` into `dist-electron/`.*

### Step 4: Generate the Windows NSIS Installer
```powershell
npm run desktop:dist
```
*Creates the standalone Windows installer executable in `dist/installer/`:*
- **`dist/installer/LocalLedger AI-Setup-1.0.0.exe`**
- Also creates the unpacked application in `dist/installer/win-unpacked/`.

---

## 6. Testing & Quality Assurance

Run the comprehensive test suites across both desktop and web layers:

```powershell
# Frontend unit & desktop bridge tests (57 tests)
npm --prefix frontend test

# Frontend linter
npm --prefix frontend run lint

# Backend pytest suite (48 tests)
.\backend\.venv\Scripts\python.exe -m pytest backend/tests

# Backend Ruff linter
.\backend\.venv\Scripts\ruff.exe check backend

# Standalone packaged backend integration & persistence test
.\backend\.venv\Scripts\python.exe .\scripts\verify_desktop_backend.py

# Standalone packaged Electron + PyInstaller end-to-end integration test
.\backend\.venv\Scripts\python.exe .\scripts\test_packaged_desktop_app.py
```

---

## 7. Installing and Running on Another Windows Computer

To distribute and run LocalLedger AI on any modern 64-bit Windows computer (Windows 10 / Windows 11):

### 1. Distribute the Installer
Copy the standalone installer to the target computer:
- `dist/installer/LocalLedger AI-Setup-1.0.0.exe` (~115 MB)

### 2. Run the Installer
1. Double-click `LocalLedger AI-Setup-1.0.0.exe`.
2. Follow the NSIS setup wizard:
   - Select the target installation directory (defaults to `%LOCALAPPDATA%\Programs\LocalLedger AI`).
   - Choose whether to create a Desktop shortcut and Start Menu shortcut.
   - Click **Install**.
3. Launch **LocalLedger AI** from the Start Menu, desktop shortcut, or directly from the installation folder.

### 3. Machine Prerequisites on Target Computer
- **No Python Required**: The application bundles a standalone Python 3.13 runtime with all compiled wheels (Uvicorn, FastAPI, SQLAlchemy, PyMuPDF, Pillow).
- **No Node.js Required**: The application runs completely compiled as an Electron binary with optimized static web assets.
- **Tesseract OCR (Optional for scanned image receipts)**:
  - If scanning PNG/JPG receipts, install Tesseract OCR on the target computer via `winget install UB-Mannheim.TesseractOCR` or from [UB-Mannheim Tesseract GitHub](https://github.com/UB-Mannheim/tesseract/wiki).
  - Digital PDF receipts process natively without Tesseract via PyMuPDF.
- **Ollama (Optional for local LLM extraction)**:
  - Download and install Ollama from [ollama.com](https://ollama.com).
  - Run `ollama run qwen2.5:1.5b`.
  - When Ollama is offline, LocalLedger AI automatically falls back to deterministic rule-based heuristic extraction with 100% functionality.

### 4. Data Safety & Uninstalling
- All user ledger transactions and receipt images reside in:
  `%APPDATA%\LocalLedger AI\data`
- The uninstaller (`Uninstall LocalLedger AI.exe` in Windows Settings > Installed Apps) removes application binaries but **preserves all user financial records and receipt data by default**.
