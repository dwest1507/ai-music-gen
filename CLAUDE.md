# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Spec-Driven Development

This repository follows **spec-driven development**. `SPEC.md` is the single source of truth for all requirements, architecture decisions, and API contracts.

**Rules:**
1. **New requirement → update `SPEC.md` first**, then implement. Never implement a feature that isn't reflected in the spec.
2. **Every code change must keep `SPEC.md` in sync.** If an implementation deviates from or extends what the spec describes, update the spec in the same commit/PR.
3. `SPEC.md` takes precedence over any other documentation (README, comments, etc.) when there is a conflict.

## Project Overview

AI Music Gen is a web application for generating music via the ACE-Step API (hosted on Modal GPU infrastructure). The architecture is a **stateless proxy**: the FastAPI backend handles CORS, rate limiting, session management, and validation, then proxies requests to the Modal API. No persistent state is stored in the backend.

**Deployment:** Frontend → Vercel, Backend → Railway, Inference → Modal (GPU)

## Commands

All common tasks are automated via `make`:

```bash
make install        # Install all dependencies (uv sync + npm install)
make dev            # Run frontend + backend concurrently (local dev)
make dev-frontend   # Frontend only on port 3000
make dev-backend    # Backend only on port 8000
make dev-docker     # Full stack via Docker Compose
make test           # Run all tests (pytest + vitest)
make lint           # Lint all code (ruff + eslint)
make clean          # Remove build caches
make stop           # Kill servers and Docker containers
```

**Run a single backend test:**
```bash
cd backend && uv run pytest tests/local/test_api.py::test_name -v
```

**Run a single frontend test:**
```bash
cd frontend && npx vitest run __tests__/specific.test.ts
```

## Environment Setup

Copy `.env.example` to `.env` and populate:
- `ACESTEP_API_URL` — Modal deployment URL (required)
- `SESSION_SECRET` — Generate with `openssl rand -hex 32`
- `FRONTEND_URL` — CORS allowed origin (default: `http://localhost:3000`)
- `NEXT_PUBLIC_API_URL` — Backend URL visible to browser (default: `http://localhost:8000`)
- `GROQ_API_KEY` — Groq API key for lyrics auto-generation (optional; falls back to ACE-Step's own generation)

## Architecture

```
Browser → Next.js (Vercel, port 3000)
            ↓ fetch to NEXT_PUBLIC_API_URL
          FastAPI (Railway, port 8000)
            ↓ httpx HTTP/2
          ACE-Step REST API (Modal GPU)
```

### Backend (`/backend`)

- **Entry:** `app/main.py` — FastAPI app, CORS middleware, lifespan management
- **Config:** `app/core/config.py` — Pydantic Settings, reads from env
- **Rate limiting:** `app/core/limiter.py` — slowapi, key = session cookie → IP fallback
- **Service:** `app/services/acestep_client.py` — all Modal API calls (httpx AsyncClient, HTTP/2, shared lifecycle)
- **Service:** `app/services/lyrics_generator.py` — Groq lyrics auto-generation (`openai/gpt-oss-120b`); called before task submission when no user lyrics provided
- **Routes:** `app/api/routes/generation.py` — all `/api/*` endpoints

Key endpoints and their rate limits:
| Endpoint | Limit |
|---|---|
| `POST /api/generate` | 5/min |
| `GET /api/jobs/{task_id}` | 60/min |
| `GET /api/audio/{task_id}` | 20/min |
| `GET /api/examples/random` | 10/min |

The `ACEStepClient` is instantiated once at startup (lifespan), shared across requests, and closed on shutdown.

**Examples:** `backend/examples/simple_mode/` and `backend/examples/text2music/` contain 170+ JSON files used by `GET /api/examples/random`.

### Frontend (`/frontend`)

- **Tech:** Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Entry:** `src/app/page.tsx` — home page, switches between form and job status views
- **Form:** `src/components/MusicGeneratorForm.tsx` — simple/advanced mode toggle, "Try an Example" button
- **Job polling:** `src/components/JobStatus.tsx` — polls `/api/jobs/{task_id}`, shows progress and audio
- **Audio:** `src/components/AudioPlayer.tsx` — wavesurfer.js waveform + playback
- **API client:** `src/lib/api.ts` — typed fetch wrapper with Zod validation and `ApiError` class

### Versioning

Release Please manages unified versioning across `package.json`, `frontend/package.json`, `backend/pyproject.toml`, and `CHANGELOG.md`. Use conventional commits (`feat:`, `fix:`, etc.) to trigger automated releases.

## Testing Structure

- `backend/tests/local/` — unit + integration tests, run in CI
- `backend/tests/deployment/` — smoke/security tests for deployed environments (not run in CI by default)
- `frontend/__tests__/` — Vitest tests

## Testing Policy

**This repository requires 100% test coverage.** Every new feature, endpoint, or component must include corresponding tests before it can be merged.

- Backend: all new routes, service methods, and business logic must have pytest coverage
- Frontend: all new components and API client functions must have Vitest coverage
- Never merge a change that reduces coverage below 100%
