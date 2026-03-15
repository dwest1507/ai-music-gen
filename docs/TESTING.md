# Testing Strategy

With the system acting as a stateless HTTP proxy over the ACE-Step Modal API, testing focuses on integration, serialization, proxy behavior, and UI components, rather than complex background job state management.

## 1. Backend Testing

The backend is built with FastAPI and utilizes `httpx` to communicate with the ACE-Step Modal API.

### Running Backend Tests

Navigate to the `backend` directory (if separate) or the project root:

```bash
# Using uv and pytest (recommended)
uv run pytest backend/tests

# Or using unittest (if configured that way)
uv run python -m unittest discover -s backend/tests -p "*_test.py"
```

### Test Coverage Focus
- **`acestep_client.py`:** Use mocked HTTP responses (e.g., via `respx` or `unittest.mock`) to verify `submit_task()`, `query_result()`, and `download_audio()` functions map inputs to the upstream correctly, handle timeouts, and manage authentication.
- **Route Validation (`generation.py`):** Assert that the FastAPI endpoints correctly validate incoming JSON bodies (checking Pydantic models for prompt limits, durations, etc.) and accurately return 400 schemas on failure.
- **Security & Rate Limiting:** Verify that session-based limits return HTTP 429 when max requests are exceeded and session cookies are set correctly.

*Note: You do not need to mock Redis or RQ jobs anymore.*

## 2. Frontend Testing

The Next.js frontend relies on mockable API endpoints to ensure components render state transitions smoothly.

### Running Frontend Tests

Navigate to the `frontend` directory:

```bash
npm run test
```

### Test Coverage Focus
- **`MusicGeneratorForm.tsx`:** Verify conditional rendering between Simple and Advanced modes, validation of inputs (e.g., BPM bounds), and submission transitions.
- **`JobStatus.tsx`:** Use mocked API responses to fast-forward through `queued -> processing -> completed` states.
- **`AudioPlayer.tsx`:** Verify playback controls, metadata display, and download proxy behaviors trigger correctly.

## 3. Integration Testing

End-to-end functionality can be simulated by running both frontend and backend against a mock ACE-Step server, preventing expensive GPU spin-ups during automated integration suites. Mocks should strictly adhere to the unified JSON envelope shape (`{"data": {...}, "code": 200, "error": null, "timestamp": 123456789}`).
