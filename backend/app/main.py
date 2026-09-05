import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.core.warm_state import WarmState
from app.api.routes import generation
from app.services.acestep_client import ACEStepClient

# Ensure app-level loggers are visible (uvicorn only configures its own loggers)
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the lifecycle of the shared httpx client and ACE-Step client."""
    # The default keepalive expiry of 5s is shorter than our own polling
    # intervals, so connections to Modal were being torn down and re-handshaked
    # between consecutive polls of the same Task.
    limits = httpx.Limits(keepalive_expiry=60.0)
    async with httpx.AsyncClient(http2=True, limits=limits) as http_client:
        app.state.acestep_client = ACEStepClient(http_client)
        app.state.warm_state = WarmState()
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
    """Liveness of this service only — deliberately does not touch the GPU.

    Pinging upstream from here would turn every uptime probe and platform deploy
    check into a GPU wake, and would stall this endpoint for the length of a cold
    start while doing it. Upstream reachability lives at /health/upstream.
    """
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/health/upstream")
@limiter.limit("10/minute")
async def upstream_health_check(request: Request):
    """Reachability of the ACE-Step API.

    Rate limited because calling this **wakes the GPU** when it has scaled to
    zero. It is a diagnostic, not something to point a monitor at.
    """
    try:
        upstream = await app.state.acestep_client.health_check()
        return {"upstream": "healthy", "upstream_detail": upstream}
    except Exception:
        return {"upstream": "unreachable"}
