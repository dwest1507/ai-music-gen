import pytest
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

# Add the backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pytest_asyncio
from app.services.acestep_client import ACEStepClient


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

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
