import pytest
import sys
import os
from unittest.mock import MagicMock, patch
from httpx import AsyncClient, ASGITransport

# Add the backend directory to sys.path to ensure imports work correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock redis and rq before importing app to prevent connection attempts
# We use a session-scoped autouse fixture to patch these for all tests
@pytest.fixture(scope="session", autouse=True)
def mock_external_services():
    with patch("redis.from_url") as mock_redis, \
         patch("rq.Queue") as mock_queue:
        
        # Configure mocks to return useful objects
        mock_redis_instance = MagicMock()
        mock_redis.return_value = mock_redis_instance
        
        mock_queue_instance = MagicMock()
        mock_queue.return_value = mock_queue_instance
        
        # Yield to let tests run
        yield
        
import pytest_asyncio

@pytest_asyncio.fixture
async def async_client():
    # delayed import to ensure mocks are active
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.fixture
def mock_job_queue():
    # Patch the global 'job_queue' object in generation.py
    # or better, patch the methods of the JobQueueService instance
    from app.services.job_queue import job_queue
    
    # We can mock the methods directly on the existing instance
    # since the instance was created during import (with mocked redis/queue from above)
    job_queue.enqueue_job = MagicMock()
    job_queue.get_job = MagicMock()
    job_queue.cancel_job = MagicMock()
    
    return job_queue
