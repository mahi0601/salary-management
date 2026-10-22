.PHONY: setup seed api web test coverage build

setup:
	python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements-dev.txt
	cd frontend && npm ci

seed:
	cd backend && .venv/bin/python -m app.seed --reset

api:
	cd backend && .venv/bin/uvicorn app.main:create_app --factory --reload --port 8000

web:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/python -m pytest
	cd frontend && npm test

coverage:
	cd backend && .venv/bin/python -m pytest --cov=app --cov-report=term-missing:skip-covered
	cd frontend && npx vitest run --coverage

build:
	cd frontend && npm run build
