.PHONY: help install dev dev-frontend dev-backend dev-docker test lint clean

help:
	@echo "Available commands:"
	@echo "  make install      - Install frontend and backend dependencies"
	@echo "  make dev          - Run both frontend and backend locally"
	@echo "  make dev-docker   - Run the full stack using docker-compose"
	@echo "  make test         - Run frontend and backend tests"
	@echo "  make lint         - Run frontend and backend linters"
	@echo "  make clean        - Remove caches and build artifacts"

install:
	@echo "Installing backend dependencies..."
	cd backend && uv sync
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

dev:
	@echo "Starting full stack... (Press Ctrl+C to stop)"
	@$(MAKE) -j2 dev-frontend dev-backend

dev-docker:
	docker-compose up --build

test:
	@echo "Running backend tests..."
	cd backend && uv run pytest tests/local/ -v
	@echo "Running frontend tests..."
	cd frontend && npm run test -- --run

lint:
	@echo "Running backend linting..."
	cd backend && uv run ruff check .
	@echo "Running frontend linting..."
	cd frontend && npm run lint

clean:
	@echo "Cleaning up..."
	cd backend && rm -rf .pytest_cache .ruff_cache __pycache__
	cd frontend && rm -rf .next node_modules
