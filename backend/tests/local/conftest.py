import sys
import os
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

# Add the backend directory to sys.path
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

import pytest
import pytest_asyncio
from app.core.limiter import limiter
from app.services.acestep_client import ACEStepClient


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear rate-limit counters between tests.

    The limiter keys on the session cookie and falls back to the client IP, so
    without this every test that omits a cookie shares one budget and the
    suite's behaviour depends on test ordering.
    """
    limiter.reset()
    yield
    limiter.reset()


@pytest_asyncio.fixture
async def mock_acestep_client():
    """Create a fully-mocked ACEStepClient."""
    client = MagicMock(spec=ACEStepClient)
    client.submit_task = AsyncMock()
    client.query_result = AsyncMock()
    client.download_audio = AsyncMock()
    client.health_check = AsyncMock(return_value={"status": "ok"})
    client.list_models = AsyncMock()
    client.get_random_sample = AsyncMock()
    client.format_input = AsyncMock()
    return client


class FakeClock:
    """A hand-wound clock, so warm-window tests need no sleeping."""

    def __init__(self, now: float = 1_000.0):
        self.now = now

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def fake_clock():
    return FakeClock()


@pytest_asyncio.fixture
async def async_client(mock_acestep_client, fake_clock):
    """Create a test client with the mocked ACE-Step client injected."""
    from app.main import app
    from app.core.warm_state import WarmState

    # Override the lifespan-managed client
    app.state.acestep_client = mock_acestep_client

    # Rebuilt per test. Warm state is process-global in production (see ADR 0001),
    # so leaving one test's wakes visible to the next would make results depend on
    # ordering — the same hazard reset_rate_limiter guards against.
    app.state.warm_state = WarmState(clock=fake_clock)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
