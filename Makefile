.PHONY: setup install test test-backend test-frontend dev lint format

setup:
	python -m venv backend/.venv
	cd backend && .venv/Scripts/pip install -r requirements.txt
	cd frontend && npm install

dev-backend:
	cd backend && .venv/Scripts/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

dev-frontend:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && .venv/Scripts/pytest

test-frontend:
	cd frontend && npm run test -- --run

lint:
	cd backend && .venv/Scripts/ruff check .
	cd frontend && npm run lint

format:
	cd backend && .venv/Scripts/ruff format .
	cd frontend && npm run format
