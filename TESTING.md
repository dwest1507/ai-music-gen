# Testing and Debugging Guide

This guide describes how to run tests and debug the AI Music Generator locally.

## 1. Unit & Integration Tests

### Backend
Run Python tests using `pytest`:
```bash
cd backend
# Create/Activate virtual environment if needed
# python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest
```

### Frontend
Run TypeScript tests using `vitest`:
```bash
cd frontend
npm install
npm test
```

## 2. End-to-End Local Testing (Docker Compose)

The expected workflow for local testing involves running the full stack (Backend, Worker, Frontend, Redis) using Docker Compose.

### Prerequisites
- Docker & Docker Compose installed
- Valid Modal API credentials in `.env` (for real generation) OR empty credentials (for mock generation, *if configured*)
- **Note**: The current implementation uses real Modal credentials if found in your environment.

### Steps
1. **Configure Environment**:
   Ensure your `.env` file in the project root has the necessary variables (or empty values).
   ```bash
   MODAL_TOKEN_ID=...
   MODAL_TOKEN_SECRET=...
   ```

2. **Start Services**:
   ```bash
   docker-compose up --build
   ```
   This starts:
   - `frontend`: http://localhost:3000
   - `backend`: http://localhost:8000
   - `worker`: Background job processor
   - `redis`: Job queue

3. **Verify**:
   - Open http://localhost:3000 in your browser.
   - Enter a prompt and generate music.
   - Check CLI logs for progress.

## 3. Debugging Tips

- **Check Logs**:
  ```bash
  docker-compose logs -f backend
  docker-compose logs -f worker
  ```
- **Redis Inspection**:
  If jobs are stuck, check Redis:
  ```bash
  docker-compose exec redis redis-cli keys *
  ```
- **Manual Worker**:
  If the worker service fails, you can run a worker manually in the backend container:
  ```bash
  docker-compose exec backend rq worker
  ```

## 4. Common Issues

- **Modal `Function.lookup` Error**:
  Ensure you are using the patched `modal_client.py` which uses `modal.Function.from_name` for compatibility with newer Modal versions.
- **Job Stuck in Queued**:
  Ensure the `worker` service is running. Check logs with `docker-compose logs worker`.
