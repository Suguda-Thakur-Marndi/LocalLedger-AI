# LocalLedger AI

<p align="center">
  <strong>Private, Local-First Receipt & Expense Management</strong><br>
  <em>Manage receipts, invoices, and transactions on your own computer. Keep your financial documents under your control.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(64--bit)-0078D6?style=flat-square&logo=windows" alt="Windows 64-bit" />
  <img src="https://img.shields.io/badge/Privacy-100%25%20Local-success?style=flat-square&logo=shield" alt="100% Local" />
  <img src="https://img.shields.io/badge/Release-v1.0.0-blue?style=flat-square" alt="Version 1.0.0" />
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Electron-33.x-47848F?style=flat-square&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
</p>

---

LocalLedger AI is a privacy-focused desktop application for organizing receipts and invoices, extracting transaction information, reviewing financial records, and tracking expenses. It combines a modern React interface with a locally running Python backend and SQLite database.

**No Python or Node.js installation is required for users of the packaged Windows application.**

---

## Download LocalLedger AI

- **Current release**: `v1.0.0`
- **Platform**: Windows 10 / Windows 11, 64-bit
- **Installer**: `LocalLedger AI-Setup-1.0.0.exe`
- **Download size**: Approximately 116 MB (~121 MB)
- **SHA-256 Checksum**: `1019e11d57e91349b7821a037cd0871e7968df67851b23fcbdfff80d36ba131a`
- **Installation**: Download the Windows installer from the [Releases page](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/releases/latest), run the `.exe`, follow the setup wizard, and launch LocalLedger AI from the desktop or Start Menu shortcut.

> [!NOTE]
> **Release setup required:** Replace `YOUR_USERNAME/YOUR_REPOSITORY` with your actual GitHub username and repository name. Upload the installer to a GitHub Release before sharing this download link publicly.

---

## Why LocalLedger AI?

Receipts and invoices contain sensitive financial information. LocalLedger AI is designed to keep document management and financial records on the user's computer instead of requiring a cloud-based accounting service.

- **Local-first storage**: Transactions, documents, and application data are stored locally on your machine.
- **Receipt and invoice organization**: Import supported documents and manage their extracted information.
- **OCR and extraction**: Extract text from supported receipts and invoices without third-party cloud APIs.
- **Expense tracking**: Organize transactions and review spending with customizable categories.
- **Financial reports**: View summaries and trends derived exclusively from your actual records.
- **Local AI integration**: Optionally connect to Ollama for local model-assisted extraction.
- **Windows desktop experience**: Use a dedicated application with native menus, keyboard shortcuts, and desktop integration.
- **Persistent data**: Your records remain available when you close and reopen the application.

---

## Features

### 1. Receipt and invoice management
- Import PDF documents and supported image formats (PNG, JPEG, WebP).
- Upload documents through the file picker or drag-and-drop interface.
- Detect duplicate documents using SHA-256 cryptographic hashing.
- Organize imported files in a secure local document vault.
- Review extracted information before using it in your ledger.
- Receive immediate validation errors for unsupported or oversized files.

### 2. OCR and intelligent extraction
- Extract text from supported digital PDF invoices using PyMuPDF.
- Use Tesseract OCR when configured for supported scanned receipts and images.
- Optionally integrate Ollama with a compatible local model for AI-assisted field extraction.
- Use a rule-based extraction fallback when the optional local AI service is unavailable.
- Extraction results should be reviewed for accuracy before relying on them for financial decisions.

### 3. Transaction management
- Create and manage financial transactions.
- Review transaction details, taxes, subtotals, and total amounts.
- Search and filter transaction records by merchant, category, date, and review status.
- Maintain a persistent local ledger backed by SQLite.
- View financial summaries based on actual stored data with zero mock records.

### 4. Dashboard and reports
- View transaction and receipt summaries with strict multi-currency isolation.
- Track expenses and category distributions.
- Review available monthly and weekly spending trends.
- Access dedicated report and analytics pages with CSV export.
- Display meaningful empty states when a new vault has no records.

### 5. Native Windows desktop features
- Windows installer with desktop and Start Menu shortcuts.
- Native File, Edit, View, Window, and Help menus.
- Standard keyboard shortcuts (Ctrl+O, Ctrl+K, Ctrl+,, Ctrl+R) and text-editing actions.
- Local data-folder access via native file explorer bridge.
- Persistent user storage preserved across application restarts and updates.

---

## Screenshots

Add screenshots of the actual application here.

**Suggested screenshots:**
- Dashboard
- Upload Receipts
- Transactions Ledger
- Review Queue
- Reports & Analytics
- Settings & Local Companion

```markdown
![LocalLedger AI Dashboard](docs/screenshots/dashboard.png)
![Upload Receipts](docs/screenshots/upload-receipts.png)
![Transactions Ledger](docs/screenshots/transactions.png)
![Receipt Review Queue](docs/screenshots/review-queue.png)
```

*(Place screenshot images into `docs/screenshots/` and update these paths when committed to your repository).*

---

## Installation

### Windows installer — recommended

1. Open the [latest GitHub Release](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/releases/latest).
2. Download `LocalLedger AI-Setup-1.0.0.exe`.
3. Run the installer.
4. Follow the installation wizard.
5. Launch LocalLedger AI from the desktop or Start Menu shortcut.

The packaged application includes its Electron frontend and standalone Python backend. Users do not need to install Python, Node.js, npm, or Git.

> [!IMPORTANT]
> The installer is currently unsigned. Windows SmartScreen may display an unknown-publisher warning. Click **More info** &rarr; **Run anyway** only after verifying that the installer was downloaded from your official release.

### Optional integrations

- **Tesseract OCR**: May be required for some scanned image receipts. Availability and supported OCR behavior depend on the installed OCR engine and application configuration.
- **Ollama**: Optional integration for local model-assisted extraction. Install Ollama and download a compatible model (e.g. `ollama run qwen2.5:1.5b` or `llama3.2`) if you want this feature. Core receipt management remains fully functional without Ollama using deterministic rule-based parsing.

---

## Data storage and privacy

LocalLedger AI is designed around local processing and storage:

- The SQLite database and uploaded documents are stored exclusively in the user's application data directory.
- The packaged desktop backend binds only to the local loopback interface (`127.0.0.1`).
- The application does not require a remote database or cloud service for core ledger functionality.
- Optional integrations should be configured explicitly by the user.
- Users should review the implementation and integration settings before making absolute privacy or offline-use assumptions.

**Typical Windows data location:**
```text
%APPDATA%\LocalLedger AI\data
```

Inside this directory:
- `db/localledger.db`: Your personal SQLite database containing all transactions and metadata.
- `uploads/`: Your original uploaded receipts and invoices stored with content-addressed filenames.

Your data is separate from the application installation directory. Uninstalling the application is configured to preserve user data (`deleteAppDataOnUninstall: false`), but you should still maintain regular backups of your `%APPDATA%\LocalLedger AI\data` directory for disaster recovery.

---

## Technology stack

| Layer | Technology | Description |
|:---|:---|:---|
| **Desktop shell** | Electron 33 | Native window frame, menus, preload sandbox, and backend process lifecycle |
| **Frontend** | React 19, TypeScript, Vite | Modern sovereign client UI with Tailwind CSS and TanStack Query |
| **Styling** | Tailwind CSS | Clean, responsive design system with dark/light surface tokens |
| **Backend API** | Python 3.13, FastAPI, Uvicorn | High-throughput asynchronous REST API bound to `127.0.0.1` |
| **Database** | SQLite | Single-file zero-config relational database engine |
| **ORM & Migrations** | SQLAlchemy, Alembic | Type-safe query building and automated database migrations |
| **PDF Extraction** | PyMuPDF (fitz) | Fast vector text extraction from native digital invoices |
| **Image OCR** | Tesseract OCR | Optional optical character recognition for scanned receipts |
| **Optional Local AI** | Ollama | Local model field extraction (Qwen2.5, LLaMA 3.2) |
| **Backend Packaging** | PyInstaller | Compiles Python backend into a standalone Windows binary |
| **Windows Installer** | electron-builder, NSIS | Distributable Windows installer (`.exe`) with desktop & Start Menu shortcuts |

---

## Architecture overview

```text
Windows Desktop Application
       │
       ▼
Electron + React Frontend (Renderer)
       │
       ▼  Context Isolation & IPC Bridge
Secure Preload / IPC Bridge
       │
       ▼  Loopback HTTP (127.0.0.1)
Local FastAPI Backend Service
       │
       ├──── SQLite Database (%APPDATA%\LocalLedger AI\data\db\localledger.db)
       ├──── Local Document Vault (%APPDATA%\LocalLedger AI\data\uploads)
       ├──── PDF Text Extraction (PyMuPDF)
       └──── Optional OCR (Tesseract) / Local AI (Ollama)
```

The desktop frontend communicates with the backend running on the local machine via loopback HTTP with dynamic port negotiation. User records are persisted in `%APPDATA%`, completely separate from the application binaries in `%LOCALAPPDATA%\Programs`.

---

## Development setup

These instructions are for contributors and developers, not normal installer users.

### Prerequisites

- Node.js 20+ and npm
- Python 3.11, 3.12, or 3.13
- Git
- Windows 10/11 x64 (for compiling the Windows installer)

### Run the development application

1. Clone your repository:
   ```powershell
   git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   cd YOUR_REPOSITORY
   ```

2. Install root and frontend dependencies:
   ```powershell
   npm install
   npm --prefix frontend install
   ```

3. Set up the Python virtual environment and dependencies:
   ```powershell
   python -m venv backend/.venv
   .\backend\.venv\Scripts\pip install -r backend/requirements.txt
   ```

4. Start the development desktop application:
   ```powershell
   npm run desktop:dev
   ```

### Build the Windows installer

From the project root:
```powershell
npm run desktop:dist
```

This command executes:
1. `npm --prefix frontend run build` &mdash; compiles the production React frontend bundle into `frontend/dist/`.
2. `tsc -p tsconfig.electron.json` &mdash; compiles Electron main and preload TypeScript scripts into `dist-electron/`.
3. `.\backend\.venv\Scripts\python.exe .\scripts\build_backend.py` &mdash; packages the FastAPI backend using PyInstaller into `dist/backend/localledger-backend/`.
4. `electron-builder --win nsis` &mdash; packages the final installer executable.

The expected installer output is:
```text
dist/installer/LocalLedger AI-Setup-1.0.0.exe
```

---

## Testing and quality

The project includes comprehensive automated test suites covering frontend, backend, and desktop integration:

- **Backend tests**:
  ```powershell
  .\backend\.venv\Scripts\python.exe -m pytest backend/tests
  ```
  *(53 passed &mdash; covers transactions, upload validation, OCR fallback, backup/restore, clean vault startup, and user data preservation)*

- **Frontend tests**:
  ```powershell
  npm --prefix frontend test
  ```
  *(66 passed &mdash; covers UI rendering, empty state handling, desktop menu dispatch, companion modes, and error recovery)*

- **Frontend linting**:
  ```powershell
  npm --prefix frontend run lint
  ```
  *(0 errors, 0 warnings across all 38 files)*

- **Desktop production regression**:
  ```powershell
  .\backend\.venv\Scripts\python.exe scripts/test_desktop_production_regression.py
  ```
  *(13/13 criteria verified &mdash; validates packaged Electron startup, preload bridge, loopback port assignment, DOM rendering, package purity, zero-data fresh start, and live user data preservation)*

### Release checklist

Before publishing a release, verify:
- [x] The installer launches correctly and completes installation.
- [x] The dashboard, menus, and navigation render without blank screens.
- [x] Receipt imports, duplicate hashing, and transaction creation work.
- [x] Data persists across application restarts.
- [x] New installations start with a clean, empty vault (0 transactions, 0 receipts, 0 totals).
- [x] Existing user databases (`%APPDATA%\LocalLedger AI\data`) are preserved during upgrades.
- [x] The installed application works on a separate clean Windows machine without Python or Node.js.

---

## Roadmap

Potential future improvements include:
- Code-signed Windows binaries and EV certification.
- Automated delta updates via GitHub Releases.
- Multi-page receipt stitching and split invoice line-item extraction.
- Expanded multi-currency analytics and automated FX rate conversion.
- One-click encrypted vault backups and cloud storage sync bridges (WebDAV/Nextcloud).
- macOS and Linux native desktop packaging.

---

## Contributing

Contributions, bug reports, and suggestions are welcome!

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Ensure all tests pass (`pytest` and `npm test`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request describing your changes.

> [!CAUTION]
> Please do not submit real receipts, invoices, bank statements, API keys, or personal database files in issues or pull requests.

---

## License

This project is licensed under the MIT License &mdash; see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

LocalLedger AI combines open-source desktop, frontend, backend, database, document-processing, and optional local AI technologies to make local-first financial organization accessible to individual users.

**LocalLedger AI &mdash; Your receipts. Your data. Your computer.**
