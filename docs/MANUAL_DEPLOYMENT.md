# Manual Deployment Guide

This guide covers deploying all three layers of the AI Music Generation stack: the ACE-Step Modal API, the FastAPI backend, and the Next.js frontend.

---

## Step 0: Deploy the ACE-Step Modal API

The GPU inference layer runs separately on Modal and must be deployed first. It is sourced from the ACE-Step 1.5 fork that adds Modal serverless deployment support via `modal_app.py`.

**Follow the deployment guide in the fork:**
`docs/en/MODAL_GUIDE.md` in the [ACE-Step-1.5-modal fork](https://github.com/ACE-Step/ACE-Step-1.5).

The key steps are:
1. Create a [Modal account](https://modal.com/) and authenticate (`uv run modal setup`).
2. Configure your `.env` (LM model size, optional Hugging Face token).
3. Upload secrets: `uv run modal secret create ace-step-api-secrets --from-dotenv .env --force`  # pragma: allowlist secret
4. Deploy: `uv run modal deploy modal_app.py`

Once deployed, Modal will print your API URL:
```
https://<YOUR_WORKSPACE>--acestep-api-fastapi-app.modal.run
```
Keep this URL — you will need it for the backend configuration below.

> **GPU / cost note:** The default configuration uses the `1.7B` LM model on an A10G GPU. Refer to Modal's [pricing page](https://modal.com/pricing) before deploying. The app scales to zero when idle so you are only billed for active inference time.

---

## Step 1: Deploy the Backend (Railway)

1. Connect your Railway account to this GitHub repository.
2. Create a new Railway project and select "Deploy from GitHub repo".
3. Point Railway at the `backend` directory so it detects the `Dockerfile`.
4. Configure the environment variables in Railway:
   - `ACESTEP_API_URL`: Your Modal API URL from Step 0 (Required)
   - `ACESTEP_API_KEY`: Your Modal API Key (Optional, if configured)
   - `SESSION_SECRET`: A secure random string — generate with `openssl rand -hex 32`
   - `FRONTEND_URL`: The URL where your frontend will be deployed (e.g., `https://your-app.vercel.app`)
5. Deploy the backend and copy its generated public URL (e.g., `https://backend-production.up.railway.app`).

> **Note:** No Redis add-on or separate worker service is required. The backend is fully stateless.

---

## Step 2: Deploy the Frontend (Vercel)

1. Connect your Vercel account to this GitHub repository.
2. Import the project, ensuring the framework preset is set to **Next.js**.
3. Set the Root Directory to `frontend`.
4. Configure the environment variables in Vercel:
   - `NEXT_PUBLIC_API_URL`: The Railway backend URL from Step 1.
5. Deploy the application.

---

## Step 3: Verification

1. Navigate to your Vercel frontend URL.
2. Generate a track with a simple prompt.
3. The frontend contacts the Railway backend, which proxies the request to the ACE-Step Modal API. Audio is streamed back seamlessly.

For further details on the CI/CD pipeline and PR preview environments, see `docs/CI_CD_WORKFLOW.md`.
