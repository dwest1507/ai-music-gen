from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.api.routes import generation
from app.services.acestep_client import ACEStepClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the lifecycle of the shared httpx client and ACE-Step client."""
    async with httpx.AsyncClient(http2=True) as http_client:
        app.state.acestep_client = ACEStepClient(http_client)
        yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS
if settings.FRONTEND_URL:
    origins = [str(origin).strip() for origin in settings.FRONTEND_URL.split(",")]
else:
    origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Routes
app.include_router(
    generation.router, prefix=f"{settings.API_V1_STR}", tags=["generation"]
)


@app.get("/health")
async def health_check():
    """Health check — reports local status and optionally pings upstream."""
    result = {"status": "healthy", "version": "1.0.0"}
    try:
        upstream = await app.state.acestep_client.health_check()
        result["upstream"] = "healthy"
        result["upstream_detail"] = upstream
    except Exception:
        result["upstream"] = "unreachable"
    return result
