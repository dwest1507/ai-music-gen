# AI Music Generation Web Application

A portfolio project demonstrating full-stack AI engineering capabilities with a web-based music generation service using the [ACE-Step v1.5](https://github.com/ACE-Step/ACE-Step-1.5) model deployed on Modal.

## Architecture Overview

The system operates as a stateless HTTP proxy over the ACE-Step Modal REST API:

```mermaid
flowchart LR
    Browser --> NextJS["Next.js Frontend<br/>(Vercel)"]
    NextJS --> FastAPI["FastAPI Backend<br/>(Railway)"]
    FastAPI -- "HTTP (httpx)" --> ACEStepAPI["ACE-Step REST API<br/>(Modal)"]
    ACEStepAPI --> Browser
```

## Technology Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| Frontend | Next.js 16 + TypeScript + Tailwind v4 | Vercel |
| Backend API | Python FastAPI + Docker | Railway |
| GPU Inference | ACE-Step v1.5 REST API | Modal |
| CI/CD | GitHub Actions | GitHub |

## Setup Instructions

### Prerequisites
- Docker and Docker Compose installed
- A deployed instance of the [ACE-Step Modal API](https://github.com/ACE-Step/ACE-Step-1.5)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-music-gen
   ```

2. **Environment Setup**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your ACE-Step API URL (`ACESTEP_API_URL`) and a secure session secret.

3. **Pre-commit Hooks (Recommended)**
   Install `pre-commit` using `uv` to catch security and linting issues locally:
   ```bash
   cd backend
   uv sync
   cd ..
   uv tool install semgrep
   uv tool install pre-commit
   uv run pre-commit install
   ```

4. **Start the Application**
   We provide a Makefile to simplify local development commands.

   To install dependencies:
   ```bash
   make install
   ```

   To run the application locally (starts both frontend and backend):
   ```bash
   make dev
   ```

   *(Alternatively, run with Docker Compose: `make dev-docker`)*

   - Backend API: http://localhost:8000
   - Frontend: http://localhost:3000

## Security

- **Automated Scanning**: Continuous security monitoring via GitHub Actions for SAST (Semgrep, Bandit), Secrets (Gitleaks), Dependencies (pip-audit, npm audit), and Containers (Trivy).
- **Dependency Management**: Automated patching and updates via Dependabot.
- **Input Validation**: All inputs validated with Pydantic (backend) and Zod (frontend).
- **API Security**: CORS, Rate limiting, and secure headers. Modal API URL and API keys are never exposed to the frontend.
- **Session Management**: Secure session handling with cleanup.

## Versioning

This project uses [Release Please](https://github.com/googleapis/release-please) for automated versioning and changelog generation.

### Release Workflow
1.  **Develop:** Push changes to `main` using [Conventional Commits](https://www.conventionalcommits.org/).
2.  **Release PR:** Release Please automatically opens a Pull Request with updated versions and changelog entries.
3.  **Merge:** When you merge the Release PR, it creates a GitHub Release and Git Tag.

All components (Frontend and Backend) share a single synchronized version.
