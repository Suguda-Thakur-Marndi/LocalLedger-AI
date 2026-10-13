# Contributing to LocalLedger AI

Thank you for your interest in contributing to LocalLedger AI! This project is open-source under the MIT License and built for Hacktoberfest Week 2: Side Hustle.

## Guiding Principles

1. **Privacy First**: Never add cloud fallback LLMs, hosted OCR APIs, remote tracking, or external telemetry.
2. **Data Integrity**: Never perform floating-point arithmetic on currency values. Use `Decimal` and database constraints.
3. **Graceful Degradation**: Always maintain full offline operation, including an OCR/heuristic fallback mode when local Ollama is offline.
4. **Tested Changes**: All contributions must include unit tests and pass linters (`ruff check .` for Python, `vitest run` and `npm run build` for React/TypeScript).

## Development Workflow

1. Fork the repository and create your feature branch: `git checkout -b feature/my-feature`
2. Run test suites locally before submitting a PR:
   - Backend: `pytest`
   - Frontend: `npm run test && npm run build`
3. Commit your changes with clear, descriptive commit messages.
4. Open a Pull Request referencing the related issue or feature description.
