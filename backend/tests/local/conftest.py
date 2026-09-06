import sys
import os
from datetime import datetime, timedelta, timezone
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

    The limiter keys on the client IP, and every test in the suite arrives from
    the same one, so without this they share a budget and the suite's behaviour
    depends on ordering.
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
    # Default to a caption-less response so enrichment falls back to the original
    # prompt; tests that exercise enrichment set their own return_value.
    client.format_input = AsyncMock(return_value={})
    return client


class FakeClock:
    """A hand-wound clock, so warm-window tests need no sleeping.

    Winds an elapsed-time reading and a wall-clock reading together, because
    WarmState reads both: the dedupe window is a duration, while the budget
    period is a calendar month.
    """

    def __init__(
        self,
        now: float = 1_000.0,
        wall: datetime = datetime(2026, 1, 1, tzinfo=timezone.utc),
    ):
        self.now = now
        self.wall = wall

    def __call__(self) -> float:
        return self.now

    def calendar(self) -> datetime:
        return self.wall

    def advance(self, seconds: float) -> None:
        self.now += seconds
        self.wall += timedelta(seconds=seconds)


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
    app.state.warm_state = WarmState(
        clock=fake_clock, calendar_clock=fake_clock.calendar
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
