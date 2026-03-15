# CI/CD and PR Preview Workflow

This document outlines the Continuous Integration and Deployment (CI/CD) workflow for the `ai-music-gen` project, heavily utilizing **Preview Environments** tied to Pull Requests (PRs).

## Environments and Philosophy

We do not maintain long-running "Development" or "Staging" environments. Instead, we follow a feature-branch workflow:

1. **Local**: Developers run the application locally (e.g., `make dev` for local processes, or `make dev-docker` for containers).
2. **Preview (PR)**: Automatic, isolated deployments are spun up by our providers for every Pull Request.
3. **Production (main)**: The live site, updated only upon a successful merge to `main` passing all CI checks.

This approach saves money, guarantees clean test environments that match feature scope, and prevents configuration drift.

## Component Deployment

### 1. Frontend (Vercel)
- Vercel automatically creates preview deployments for Pull Requests.
- For public repositories, Vercel requires maintainer approval to trigger a deployment from a fork's PR to prevent bad actors from executing malicious code.
- Pushes to `main` instantly trigger production deployments.

### 2. Backend (Railway)
- Railway's "PR Pipeline" is configured to automatically provision isolated backend services for Pull Requests.
- Forked PR deployments are disabled by default for security, requiring manual review.
- Merges to `main` are automatically built into Docker images and deployed to the production environment.

---

## Automated Releases

We use **Release Please** to automate the versioning and release process via GitHub Pull Requests.

### The Release Flow
1. **Develop**: Push changes directly to `main` (or merge PRs) using [Conventional Commits](https://www.conventionalcommits.org/).
2. **Release PR**: On every push to `main`, the `Release Please` workflow runs. It analyzes the commits and:
   - If new version-bumping commits are found, it opens or updates a special "Release PR".
   - This PR includes updated versions in `frontend/package.json` and `backend/pyproject.toml`, plus an updated `CHANGELOG.md`.
3. **Review & Merge**: When you are ready to release, simply merge that Release PR.
4. **Tagging**: Merging the Release PR automatically creates a GitHub Tag and GitHub Release.

---

## Continuous Security Scanning

We have implemented a multi-layered automated security scanning pipeline to ensure our monorepo stays vulnerability-free.

### 1. Pre-commit Hooks (Shift-Left)
We use `pre-commit` to catch security and code quality issues on the developer's local machine:
- **detect-secrets**: Prevents accidental commits of API keys or secrets.
- **Bandit/Semgrep**: Runs lightweight SAST scans before every commit.
- **Ruff**: Enforces backend code quality and formatting.

### 2. CI Security Pipeline (`security.yml`)
Every PR and push to `main` triggers an exhaustive security workflow:
- **Secrets Detection**: `Gitleaks` scans entire git history for leaked credentials.
- **Backend SAST**: `Bandit` and `Semgrep` (Python ruleset) find insecure code patterns in FastAPI.
- **Frontend SAST**: `Semgrep` (JS/TS rulesets) find vulnerabilities in Next.js.
- **Dependency Auditing**: `pip-audit` and `npm audit` scan for known CVEs.
- **Container Scanning**: `Trivy` scans root and frontend Dockerfiles for misconfigurations and insecure base images.

### 3. Automated Dependency Updates
**Dependabot** is enabled for the entire monorepo:
- **Backend**: Weekly scans of `backend/requirements.txt`.
- **Frontend**: Weekly scans of `frontend/package.json`.
- **GitHub Actions**: Automated updates for all CI workflows.

---

## ⚠️ The Decoupled Environment Variable Challenge

When Vercel builds a frontend PR and Railway builds a backend PR simultaneously, they both generate dynamic, unpredictable URLs (e.g., `ai-music-gen-git-feature.vercel.app` and `backend-pr-12.up.railway.app`).

This creates a chicken-and-egg problem:
- The backend needs to know the frontend's PR URL to configure CORS (`FRONTEND_URL`).
- The frontend needs to know the backend's PR URL to make API calls (`NEXT_PUBLIC_API_URL`).

### How to link them in Preview Environments

Because the frontend and backend live on separate providers, wiring them up automatically requires advanced scripting. Here are the three ways to handle this, ranging from manual to fully automated.

#### Option A: Manual Wiring (The Default)
When you open a PR and both services finish their initial preview deployments:
1. Copy the Vercel PR URL.
2. Go to your Railway PR Environment settings, and temporarily set `FRONTEND_URL` to your Vercel PR URL.
3. Copy the Railway PR URL.
4. Go to your Vercel project, add a temporary environment variable `NEXT_PUBLIC_API_URL` matching the Railway URL, targeted specifically at that feature branch.
5. Redeploy both.

#### Option B: Permissive CORS + Predictable Domains (Semi-Automated)
1. **Backend CORS**: Configure your FastAPI application to conditionally accept any `https://*.vercel.app` origin if it detects it's running in a non-production Railway environment. This removes the need for the Railway backend to know the exact Vercel URL.
2. **Predictable API URLs**: In Railway, map a custom domain wildcard for your PRs, structured like `api-pr-${PR_NUMBER}.yourdomain.com`.
3. In your frontend's `next.config.ts`, write logic to check if a specific Vercel environment variable like `VERCEL_GIT_PULL_REQUEST_ID` is present. If it is, dynamically construct the `NEXT_PUBLIC_API_URL` to match the expected Railway domain structure.

#### Option C: Consolidate on Railway (Fully Automated)
If wiring temporary URLs across providers becomes too painful, you can migrate the Next.js frontend hosting from Vercel to Railway.
- In Railway, the frontend and backend would live in the *same* project.
- Railway's PR Pipeline spins up *both* the Next.js and FastAPI services together in one isolated network.
- You can reference the backend dynamically using Railway's internal private networking variables (e.g., `NEXT_PUBLIC_API_URL=http://${BACKEND_INTERNAL_URL}:${PORT}`). The manual wiring is eliminated securely and permanently.
