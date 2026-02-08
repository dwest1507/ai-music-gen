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

6.  **Deploy Worker Service**:
    -   In the Railway project view, click "New" -> "GitHub Repo" (select same repo `ai-music-gen`).
    -   Go to **Settings** -> Change name to "worker".
    -   **Root Directory**: Set effectively to `/backend` (service watch paths).
    -   **Start Command**: `sh -c 'rq worker --url "$REDIS_URL"'`
    -   **Variables**:
        -   Copy the SAME variables from the Backend Service (`REDIS_URL`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `SESSION_SECRET`).
        -   Ensure `REDIS_URL` matches the Redis service internal URL.
    -   **⚠️ Note**: The Worker and API run in separate containers with separate filesystems. For audio file sharing to work in production, you MUST implement Object Storage (see `docs/OBJECT_STORAGE_PLAN.md`).

7.  **Deploy**:
    -   Railway usually triggers a deployment on creation. If not, click "Deploy" for both services.

---

## 4. Cloudflare R2 Setup (Object Storage)

**Required** for sharing generated audio files between the Worker (Modal/Railway) and API (Railway).

1.  **Create Bucket**:
    -   Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
    -   Go to **R2** from the sidebar.
    -   Click **Create bucket**.
    -   Name it.
    -   Click **Create bucket**.

2.  **Configure CORS**:
    -   Go to the bucket settings -> **CORS**.
    -   Add a policy to allow your frontend URL (and localhost for testing).
    ```json
    [
      {
        "AllowedOrigins": [
          "https://your-frontend-url.vercel.app"
        ],
        "AllowedMethods": [
          "GET",
          "HEAD"
        ],
        "AllowedHeaders": [
          "*"
        ]
      }
    ]
    ```

3.  **Generate API Token**:
    -   Go back to the main R2 page.
    -   Click **Manage R2 API Tokens** (right sidebar).
    -   Click **Create API token**.
    -   **Permissions**: `Object Read & Write`.
    -   **Bucket**: Select your specific bucket (`your-bucket-name`).
    -   Click **Create API Token**.
    -   **Copy the following**:
        -   `Access Key ID`
        -   `Secret Access Key`
        -   `Endpoint` (Use the S3 API endpoint for your bucket, distinct from the account-level endpoint). It usually looks like `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

4.  **Update Railway Variables**:
    -   Go to your **Railway Project**.
    -   For **BOTH** the `Backend` and `Worker` services, add these variables:
        -   `STORAGE_ENDPOINT_URL`: The S3 API Endpoint you copied (e.g. `https://<id>.r2.cloudflarestorage.com`).
        -   `STORAGE_ACCESS_KEY_ID`: Your R2 Access Key ID.
        -   `STORAGE_SECRET_ACCESS_KEY`: Your R2 Secret Access Key.
        -   `STORAGE_BUCKET_NAME`: `your-bucket-name`.
        -   `STORAGE_REGION`: `auto`.
    -   Redeploy both services.

---

## 5. Deploy Frontend (Vercel)

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

## 6. Verification

1.  Open your Vercel deployment URL.
2.  Enter a prompt and click "Generate".
3.  Check the following:
    -   **Frontend**: Loading state appears.
    -   **Backend**: Logs in Railway should show `Starting generation for job...`.
    -   **Modal**: Logs in Modal dashboard should show function execution.
    -   **Result**: Audio player appears and plays/downloads the generated file.

---
