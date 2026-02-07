# Manual Deployment Guide

This guide details the step-by-step process to manually deploy the AI Music Generator project components:
1.  **GPU Inference**: Modal
2.  **Backend API**: Railway
3.  **Frontend**: Vercel

---

## Prerequisites

Ensure you have accounts and CLI tools installed for:
-   [GitHub](https://github.com/) (Service integration)
-   [Modal](https://modal.com/) (GPU Cloud)
-   [Railway](https://railway.app/) (Backend Hosting)
-   [Vercel](https://vercel.com/) (Frontend Hosting)

Install necessary CLIs:
```bash
pip install modal
npm i -g vercel
```

---

## 1. Deploy GPU Inference (Modal)

The backend relies on a Modal app for music generation.

1.  **Authenticate with Modal**:
    ```bash
    modal token new
    ```
    Follow the browser prompt to authenticate.

2.  **Deploy the App**:
    Navigate to the project root and deploy the backend Modal app:
    ```bash
    modal deploy backend/modal_app.py
    ```

3.  **Verify Deployment**:
    -   Go to the [Modal Dashboard](https://modal.com/apps).
    -   Ensure `music-gen-app` is listed and the `generate` function is available.
    -   **Note**: You will need your Modal Token ID and Secret for the next step. You can create a new token in `Settings` -> `API Tokens`.

---

## 2. Deploy Backend & Redis (Railway)

We will use Railway to host the FastAPI backend and the Redis instance required for the job queue.

1.  **Create a New Project**:
    -   Go to [Railway Dashboard](https://railway.app/dashboard).
    -   Click "New Project" -> "Deploy from GitHub repo".
    -   Select your repository (`ai-music-gen`).

2.  **Configure Backend Service**:
    -   Railway will detect the `Dockerfile` in `backend/`.
    -   **Root Directory**: Set this to `/backend` in the service settings -> "Watch Paths" or "Root Directory".
    -   **Build Command**: Validated automatically (Docker).
    -   **Start Command**: Validated automatically (`uvicorn app.main:app ...`).

3.  **Add Redis Database**:
    -   In the Railway project view, click "New" -> "Database" -> "Redis".
    -   This will add a Redis service to your project.

4.  **Configure Environment Variables**:
    -   Go to the **Backend Service** -> "Variables".
    -   Add the following variables:
        -   `PORT`: `8000`
        -   `REDIS_URL`: `redis://default:PASSWORD@REDIS_HOST:REDIS_PORT` (Use the railway-provided variable reference format, usually `${{Redis.REDIS_URL}}`).
        -   `MODAL_TOKEN_ID`: Your Modal Token ID.
        -   `MODAL_TOKEN_SECRET`: Your Modal Token Secret.
        -   `SESSION_SECRET`: A long random string (e.g., generated via `openssl rand -hex 32`).
        -   `FRONTEND_URL`: `https://your-frontend-url.vercel.app` (You will update this *after* deploying the frontend, initially you can set it to `*` or a placeholder).

5.  **Expose Public Domain**:
    -   Go to **Backend Service** -> "Settings" -> "Networking".
    -   Click "Generate Domain" to get a public URL (e.g., `web-production-1234.up.railway.app`).
    -   **Copy this URL** for the frontend deployment.

6.  **Deploy**:
    -   Railway usually triggers a deployment on creation. If not, click "Deploy".

---

## 3. Deploy Frontend (Vercel)

1.  **Import Project**:
    -   Go to [Vercel Dashboard](https://vercel.com/dashboard).
    -   Click "Add New..." -> "Project".
    -   Import the `ai-music-gen` repository.

2.  **Configure Project**:
    -   **Framework Preset**: Next.js
    -   **Root Directory**: Click "Edit" and select `frontend`.

3.  **Environment Variables**:
    -   Add the following environment variable:
        -   `NEXT_PUBLIC_API_URL`: The **Railway Backend URL** you copied in the previous step (e.g., `https://web-production-1234.up.railway.app`).
            -   *Note: Ensure NO trailing slash.*

4.  **Deploy**:
    -   Click "Deploy".
    -   Wait for the build to complete.

5.  **Update Backend CORS**:
    -   Once deployed, copy the **Vercel Deployment URL** (e.g., `https://ai-music-gen.vercel.app`).
    -   Go back to **Railway** -> Backend Service -> Variables.
    -   Update `FRONTEND_URL` to match this Vercel domain.
    -   Railway will automatically redeploy the backend with the new configuration.

---

## 4. Verification

1.  Open your Vercel deployment URL.
2.  Enter a prompt and click "Generate".
3.  Check the following:
    -   **Frontend**: Loading state appears.
    -   **Backend**: Logs in Railway should show `Starting generation for job...`.
    -   **Modal**: Logs in Modal dashboard should show function execution.
    -   **Result**: Audio player appears and plays/downloads the generated file.

---
