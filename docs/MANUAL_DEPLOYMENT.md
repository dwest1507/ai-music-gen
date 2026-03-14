# Manual Deployment Guide

This guide covers deploying the AI Music Generation frontend and backend. 

*Note: The core ACE-Step model runs separately on Modal. You must deploy it from the `ACE-Step-1.5` repository first.*

## 1. Prerequisites

- A Vercel account (for the Next.js frontend).
- A Railway account (for the FastAPI backend).
- The URL of your deployed ACE-Step Modal API (e.g., `https://<YOUR_WORKSPACE>--acestep-api-fastapi-app.modal.run`).

## 2. Deploy the Backend (Railway)

1. Connect your Railway account to this GitHub repository.
2. Create a new Railway project and select "Deploy from GitHub repo".
3. Choose the `backend` directory or root directory (depending on your setup) so Railway detects the `Dockerfile`.
4. Configure the environment variables in Railway:
   - `ACESTEP_API_URL`: Your Modal API URL (Required)
   - `ACESTEP_API_KEY`: Your Modal API Key (Optional, if configured)
   - `SESSION_SECRET`: A secure random string (Generate with `openssl rand -hex 32`)
   - `FRONTEND_URL`: The URL where your frontend will be deployed (e.g., `https://your-frontend-domain.vercel.app`)
5. Deploy the backend and copy its generated public URL (e.g., `https://backend-production.up.railway.app`).

> **Important**: The previous architecture required a Redis add-on and a separate worker service. These are **no longer required**. 

## 3. Deploy the Frontend (Vercel)

1. Connect your Vercel account to the GitHub repository.
2. Import the project, ensuring the framework preset is set to **Next.js**.
3. Set the Root Directory to `frontend` (if applicable).
4. Configure the environment variables in Vercel:
   - `NEXT_PUBLIC_API_URL`: The URL of your deployed Railway backend (from Step 2).
5. Deploy the application.

## 4. Verification

1. Navigate to your frontend URL.
2. Try generating a track.
3. The frontend should contact your Railway backend, which proxies the request to the ACE-Step Modal API. Audio is streamed back seamlessly.
