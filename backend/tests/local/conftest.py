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


@pytest_asyncio.fixture
async def async_client(mock_acestep_client):
    """Create a test client with the mocked ACE-Step client injected."""
    from app.main import app

    # Override the lifespan-managed client
    app.state.acestep_client = mock_acestep_client

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
