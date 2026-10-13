# LocalLedger AI — Privacy & Threat Model

## The Sovereign Financial Manifesto

> "Your receipts. Your data. Your AI. Your computer."

Most modern expense management tools upload sensitive tax receipts, home addresses, customer names, vendor bank details, and personal spending habits to multi-tenant cloud servers and commercial third-party LLM APIs.

**LocalLedger AI was engineered from day one to reject this paradigm.**

---

## Technical Privacy Guarantees

1. **Zero Cloud AI Egress**:
   - The application does not communicate with OpenAI, Anthropic, Google Gemini, or any hosted inference endpoint.
   - All AI inference occurs through a locally running Ollama instance on `127.0.0.1:11434`.

2. **Zero Hosted OCR Services**:
   - Document scanning and character recognition run entirely via local Tesseract and PyMuPDF binaries. No images or PDF pages are uploaded to third-party vision APIs.

3. **Zero Third-Party Analytics & Telemetry**:
   - No Google Analytics, Mixpanel, Sentry, or tracking beacons are embedded in either frontend or backend.

4. **Strict Loopback Default Binding**:
   - Both backend (`127.0.0.1:8000`) and frontend development servers (`127.0.0.1:5173`) bind strictly to loopback interfaces by default.

5. **Exclusion of Financial Data from Git**:
   - The root `.gitignore` excludes SQLite database files (`*.sqlite`, `*.db`, `data/db/*`) and uploaded files (`data/uploads/*`).

---

## Security & Threat Considerations

While LocalLedger AI eliminates cloud leaks, users must recognize the limitations of a single-user local application:

| Threat Vector | Mitigation Strategy | Limitation / Note |
|---|---|---|
| **Malicious Document Injection** | File magic bytes checked before parsing. OCR text wrapped in unexecutable boundary tags. | Operating system PDF viewer zero-days remain dependent on host patching. |
| **Path Traversal Attacks** | Canonical path resolution ensures documents cannot escape `data/uploads/`. | None. |
| **Server-Side Request Forgery (SSRF)** | Settings validator restricts Ollama URLs to `localhost`, `127.0.0.1`, and `host.docker.internal`. | Prevents attackers from redirecting AI requests to external networks. |
| **Physical / Host OS Access** | Local SQLite files reside in unencrypted form on the host filesystem. | If another user has root/administrative access to the machine, they can read the SQLite file. Use OS-level full-disk encryption (BitLocker, FileVault, LUKS) for at-rest protection. |
| **Multi-Tenant Networks** | Bound to 127.0.0.1. | Do not expose the service to `0.0.0.0` on untrusted Wi-Fi networks without an authenticating reverse proxy (e.g., Caddy, Tailscale, WireGuard). |
