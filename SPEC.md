# AI Music Generation Web Application — Specification

A portfolio project demonstrating full-stack AI engineering: a web-based music generation service powered by the [ACE-Step v1.5](https://github.com/ACE-Step/ACE-Step-1.5) model deployed on [Modal](https://modal.com/).

---

## 1. Background & Motivation

The ACE-Step v1.5 model is deployed to Modal as a standalone REST API (repo: `ACE-Step-1.5-modal`). This API provides its own asynchronous task queue, audio storage, and download endpoints — everything needed to run inference at scale.

This specification documents the architecture of the `ai-music-gen` backend and frontend, which act as a thin orchestration layer on top of the ACE-Step Modal API. This approach provides a resilient and simple architecture by avoiding redundant message queues or storage.

---

## 2. System Architecture

```mermaid
flowchart LR
    Browser --> NextJS["Next.js Frontend<br/>(Vercel)"]
    NextJS --> FastAPI["FastAPI Backend<br/>(Railway)"]
    FastAPI -- "HTTP (httpx)" --> ACEStepAPI["ACE-Step REST API<br/>(Modal)"]
    ACEStepAPI --> Browser
```

**Key Architecture Features:**
- Backend acts as a **stateless HTTP proxy** to the ACE-Step Modal API.
- All heavy lifting (job queues, storage) is delegated to the ACE-Step API.
- Backend proxies audio downloads from Modal to avoid CORS issues and keep the internal Modal URL private.
- Session-based rate limiting and input validation are performed at the backend layer.

---

## 3. ACE-Step Modal API Reference

> The deployed ACE-Step API lives at a URL like:
> `https://<WORKSPACE>--acestep-api-fastapi-app.modal.run`

### 3.1 Core Workflow

1. **Submit task** → `POST /release_task` → returns `task_id`
2. **Poll status** → `POST /query_result` with `task_id_list` → returns status + result
3. **Download audio** → `GET /v1/audio?path=<path>` → returns audio binary

### 3.2 Key Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/release_task` | POST | Submit a music generation task |
| `/query_result` | POST | Batch query task status/results |
| `/v1/audio` | GET | Download generated audio files |
| `/health` | GET | Health check |
| `/v1/models` | GET | List available DiT models |
| `/v1/stats` | GET | Server runtime statistics |
| `/format_input` | POST | LM-enhanced prompt/lyrics formatting |
| `/create_random_sample` | POST | Get random example parameters |

### 3.3 Task Status Codes

| Code | Meaning |
|------|---------|
| `0` | Queued / Running |
| `1` | Succeeded |
| `2` | Failed |

### 3.4 Response Envelope

All API responses use a unified wrapper:

```json
{
  "data": { ... },
  "code": 200,
  "error": null,
  "timestamp": 1700000000000,
  "extra": null
}
```

### 3.5 Authentication

Supports optional API key via:
- `ai_token` field in request body, or
- `Authorization: Bearer <key>` header

### 3.6 Generation Parameters (for `/release_task`)

**Essential parameters the backend should expose:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | `""` | Music description (alias: `caption`) |
| `lyrics` | string | `""` | Lyrics content |
| `audio_duration` | float | null | Duration in seconds (10–600) |
| `thinking` | bool | `false` | Use LM for enhanced generation |
| `vocal_language` | string | `"en"` | Lyrics language |
| `audio_format` | string | `"mp3"` | Output format (mp3, wav, flac) |
| `sample_mode` | bool | `false` | Auto-generate via LM from description |
| `sample_query` | string | `""` | Natural language description for sample mode |
| `use_format` | bool | `false` | LM-enhance provided caption/lyrics |
| `bpm` | int | null | Tempo (30–300) |
| `key_scale` | string | `""` | Key/scale (e.g., "C Major") |
| `time_signature` | string | `""` | Time signature |
| `inference_steps` | int | `8` | Inference steps (turbo: 1–20) |
| `batch_size` | int | `1` | Number of variations to generate |

---

## 4. Requirements

### 4.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | User can enter a text prompt describing the music they want | Must |
| FR-2 | User can select audio duration (30s, 60s, 120s, or custom 10–600s) | Must |
| FR-3 | User can optionally select a genre | Must |
| FR-4 | User can optionally provide lyrics | Should |
| FR-5 | System submits generation task to ACE-Step API and returns a task ID | Must |
| FR-6 | System polls the ACE-Step API for task completion | Must |
| FR-7 | User sees real-time status updates (queued → processing → completed/failed) | Must |
| FR-8 | User can play back generated audio in-browser with waveform visualization | Must |
| FR-9 | User can download generated audio files | Must |
| FR-10 | User can cancel pending/queued generations | Should |
| FR-11 | System proxies audio downloads through the backend (not exposing Modal URL) | Must |
| FR-12 | User can select between Simple Mode (prompt-only) and Advanced Mode (full controls) | Should |
| FR-13 | System provides a "random sample" / "inspire me" feature using `/create_random_sample` | Could |
| FR-14 | System supports LM-enhanced generation (`thinking=true`) for higher quality output | Should |

### 4.2 Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-1 | Backend response time < 500ms for proxied requests (excluding Modal inference) | Must |
| NFR-2 | Rate limiting: max 5 generation requests per minute per session | Must |
| NFR-3 | Input validation: prompts max 500 chars, lyrics max 5000 chars | Must |
| NFR-4 | All secrets stored in environment variables, never in code | Must |
| NFR-5 | CORS limited to frontend domain only | Must |
| NFR-6 | Session IDs generated cryptographically (UUID4 or `secrets.token_urlsafe`) | Must |
| NFR-7 | Backend stateless — no filesystem state | Must |
| NFR-8 | Cold start time acceptable with auto-sleep capabilities | Should |
| NFR-9 | Graceful degradation when ACE-Step API is unavailable | Should |
| NFR-10 | HTTPS enforced on all production endpoints | Must |

### 4.3 Security Requirements

| ID | Requirement |
|----|-------------|
| SEC-1 | Pydantic validation on all user inputs |
| SEC-2 | Modal API URL and API key never exposed to the frontend |
| SEC-3 | Session cookies: `httponly`, `secure`, `samesite=lax` |
| SEC-4 | Rate limiting on generation endpoint |
| SEC-5 | Request size limits to prevent DoS |
| SEC-6 | No sensitive data stored client-side |
| SEC-7 | Connection between FastAPI backend and Modal API requires authentication |

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Layer | Technology | Hosting | Cost |
|-------|------------|---------|------|
| Frontend | Next.js 16 + TypeScript + Tailwind v4 | Vercel | Free tier |
| Backend API | Python FastAPI + Docker | Railway | Free tier |
| GPU Inference | ACE-Step v1.5 REST API | Modal | ~$30/mo free credits |
| CI/CD | GitHub Actions | GitHub | Free |

### 5.2 Backend Design

The backend is a **stateless FastAPI application** that:
1. Accepts user requests from the frontend
2. Validates and transforms inputs via Pydantic
3. Forwards requests to the ACE-Step Modal API via `httpx`
4. Returns task IDs and status to the frontend
5. Proxies audio file downloads from Modal

#### 5.2.1 Backend Directory Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, CORS, middleware
│   ├── core/
│   │   ├── config.py              # Settings (env vars)
│   │   └── limiter.py             # Rate limiter
│   ├── api/
│   │   └── routes/
│   │       └── generation.py      # All API routes
│   └── services/
│       └── acestep_client.py      # HTTP client for ACE-Step API
├── tests/
├── requirements.txt
└── Dockerfile
```

#### 5.2.2 Configuration (`config.py`)

| Variable | Description | Required |
|----------|-------------|----------|
| `ACESTEP_API_URL` | Base URL of the deployed ACE-Step Modal API | Yes |
| `ACESTEP_API_KEY` | API key for ACE-Step API authentication (if enabled) | No |
| `FRONTEND_URL` | Frontend origin(s) for CORS | Yes |
| `SESSION_SECRET` | Secret for session management | Yes |

#### 5.2.3 ACE-Step Client Service (`acestep_client.py`)

Takes care of communicating with the model API:

```python
# Responsibilities:
# - HTTP client (httpx.AsyncClient) for ACE-Step API
# - Submit generation tasks (POST /release_task)
# - Query task results (POST /query_result)
# - Proxy audio downloads (GET /v1/audio)
# - Health check (GET /health)
# - List models (GET /v1/models)
# - Get random sample (POST /create_random_sample)
# - Format input (POST /format_input)
# - Error handling and retry logic
```

#### 5.2.4 API Routes (`generation.py`)

| Backend Endpoint | Method | Maps To (ACE-Step) | Description |
|------------------|--------|---------------------|-------------|
| `POST /api/generate` | POST | `POST /release_task` | Submit generation task |
| `GET /api/jobs/{task_id}` | GET | `POST /query_result` | Query task status |
| `GET /api/audio/{task_id}` | GET | `GET /v1/audio` | Proxy audio download |
| `DELETE /api/jobs/{task_id}` | DELETE | (no upstream equivalent) | Cancel / discard locally |
| `GET /api/models` | GET | `GET /v1/models` | List available models |
| `POST /api/random-sample` | POST | `POST /create_random_sample` | Get random sample params |
| `POST /api/format` | POST | `POST /format_input` | LM-format prompt/lyrics |
| `GET /health` | GET | `GET /health` | Health check (local + upstream) |

**Route detail: `POST /api/generate`**

Request body (Pydantic model):

```json
{
  "prompt": "string (required, max 500 chars)",
  "lyrics": "string (optional, max 5000 chars)",
  "duration": "float (optional, 10-600, default 60)",
  "genre": "string (optional)",
  "vocal_language": "string (optional, default 'en')",
  "audio_format": "string (optional, 'mp3'|'wav'|'flac', default 'mp3')",
  "thinking": "bool (optional, default true)",
  "use_format": "bool (optional, default false)",
  "bpm": "int (optional, 30-300)",
  "key_scale": "string (optional)",
  "time_signature": "string (optional)",
  "inference_steps": "int (optional, 1-20, default 8)",
  "batch_size": "int (optional, 1-4, default 1)"
}
```

Response (202 Accepted):

```json
{
  "task_id": "uuid-string",
  "status": "queued",
  "queue_position": 1
}
```

The backend transforms this into the ACE-Step `/release_task` payload:
- `prompt` → `prompt` (prepend genre if provided)
- `lyrics` → `lyrics` (default `"[Instrumental]"` if empty)
- `duration` → `audio_duration`
- `thinking` → `thinking`
- Other fields mapped 1:1

**Route detail: `GET /api/jobs/{task_id}`**

The backend calls `POST /query_result` with `task_id_list: [task_id]` and maps the response:

```json
{
  "task_id": "uuid-string",
  "status": "queued" | "processing" | "completed" | "failed",
  "audio_url": "/api/audio/{task_id}?path=...",
  "metadata": {
    "prompt": "...",
    "lyrics": "...",
    "bpm": 120,
    "duration": 60,
    "key_scale": "C Major",
    "time_signature": "4"
  },
  "error": "string (if failed)"
}
```

Status mapping: ACE-Step `0` → `"processing"`, `1` → `"completed"`, `2` → `"failed"`.

**Route detail: `GET /api/audio/{task_id}`**

The backend uses the `path` query parameter (from the task result's `file` field) to proxy-download audio from the ACE-Step API's `/v1/audio` endpoint. It streams the response back to the frontend with appropriate `Content-Type` and `Content-Disposition` headers.

### 5.3 Frontend Design

#### 5.3.1 Frontend Directory Structure

```
frontend/src/
├── app/
│   ├── page.tsx                   # Main page
│   ├── layout.tsx                 # Root layout
│   └── globals.css                # Global styles
├── components/
│   ├── MusicGeneratorForm.tsx     # Generation form
│   ├── AudioPlayer.tsx            # Audio player
│   ├── JobStatus.tsx              # Status display
│   └── ui/                       # Shared UI primitives
├── lib/
│   ├── api.ts                     # API client
│   ├── session.ts                 # Session management
│   └── utils.ts                   # Utilities
```

#### 5.3.2 Frontend Components

**`api.ts`** — API client mapping to backend API structure. Forms typed requests and parses typed responses.

**`MusicGeneratorForm.tsx`** — Provides:
- Optional lyrics textarea
- Vocal language selector
- "Simple / Advanced" mode toggle
- Advanced mode mapping: BPM, key/scale, time signature, inference steps

**`JobStatus.tsx`** — Maps states:
- Handles polling cycle against backend for task status updates.
- Parses metadata for completed/failed statuses.
- Loads audio from proxy endpoint upon finish.

**`AudioPlayer.tsx`** — Maps audio output:
- Supports MP3/WAV depending on requested config.
- Handles multi-track downloads when `batch_size > 1`.

### 5.4 CI/CD Architecture

The repository utilizes GitHub Actions for Continuous Integration (CI) and native integrations (Vercel, Railway) for Continuous Deployment (CD).

#### 5.4.1 Continuous Integration (CI)
GitHub Actions are configured with path filtering to run workflows independently for the frontend and backend:
- **Backend CI**: Triggered on `backend/**` changes. Runs `uv run ruff check .` for linting, `uv run bandit -r app/` for security scanning, and `uv run pytest tests/` for async testing.
- **Frontend CI**: Triggered on `frontend/**` changes. Runs ESLint, Vitest, and a production build verification step (`npm run build`).

#### 5.4.2 Continuous Deployment (CD)
Deployments pull from the `main` branch upon successful CI checks.
- **Frontend (Vercel)**: Promotes to production upon CI success. Pull requests trigger preview environments. Vercel Authorization restricts fork PR deployments to prevent untrusted code execution.
- **Backend (Railway)**: Railway PR Pipeline provisions isolated backend instances. Preview environments for public repo forks are disabled by default and require manual review before triggering.

#### 5.4.3 GitHub Repository Configuration
Branch protection rules on `main` enforce that no PRs can be merged without passing status checks for both `Backend CI` and `Frontend CI`.

---

## 6. Environment Variables

### `.env.example`

```bash
# ACE-Step Modal API
ACESTEP_API_URL=https://<WORKSPACE>--acestep-api-fastapi-app.modal.run
ACESTEP_API_KEY=                    # Optional, if API key auth is enabled

# Session security (generate with: openssl rand -hex 32)
SESSION_SECRET=your_session_secret_here

# Frontend URL for CORS (update for production)
FRONTEND_URL=http://localhost:3000

# Frontend env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 7. Error Handling

### Backend → ACE-Step API Errors

| ACE-Step Response | Backend Behavior | User-Facing Message |
|-------------------|------------------|---------------------|
| 200 + `code: 200` | Forward data | Success |
| 200 + `error` field | Map to appropriate HTTP status | Descriptive error |
| 400 | Return 400 | "Invalid generation parameters" |
| 401 | Return 500 (config issue) | "Service configuration error" |
| 429 (queue full) | Return 503 | "Service is busy. Please try again later." |
| 500 | Return 502 | "Music generation service unavailable" |
| Network timeout | Return 504 | "Service timed out. Please try again." |
| Connection error | Return 503 | "Cannot reach music generation service" |

### Frontend Error Handling

- **Network errors**: Retry with exponential backoff (3 attempts)
- **Timeout errors**: Show "Taking longer than expected" after 2 minutes
- **Generation failures**: Display error with "Try Again" button
- **Rate limit (429)**: Show cooldown timer

---

## 8. Development Roadmap & Recommended Improvements

### 8.1 System Improvements (Implemented)
These improvements were identified during a system design review and implemented to enhance resilience and scalability:
- **True Audio Streaming**: The `/api/audio/{task_id}` endpoint utilizes FastAPI's `StreamingResponse` alongside `httpx.AsyncClient.stream()` to pipe audio chunks directly from Modal to the frontend, preventing OOM errors from loading entire files into backend memory.
- **Session-based Rate Limiting**: The `slowapi` rate limiter utilizes the cryptographically secure `session_id` cookie rather than IP addresses. This aligns with "per session" rate limiting (NFR-2) and prevents issues on NAT-sharing networks.
- **Frontend Polling Backoff & Timeout**: The `JobStatus` polling mechanism implements an exponential backoff after the first minute and includes an upper-bound timeout to prevent infinite polling.
- **Duplicate Submission Guard**: The frontend generation form includes idempotency and duplicate submission guarding to prevent overlapping expensive inference requests.

### 8.2 Post-MVP Features

These features extend the base architecture with deeper functionality:

- **User Accounts & Persistence**: NextAuth.js + PostgreSQL for saved generations
- **History**: Store task IDs and metadata per user for a generation history view  
- **Reference Audio Upload**: Utilize ACE-Step's `reference_audio` / `src_audio` multipart upload support for cover/repaint tasks
- **Monetization**: Tiered rate limits, Stripe integration
- **Batch Generation UI**: Expose `batch_size > 1` with a comparison view
