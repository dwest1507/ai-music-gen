"""
Pytest configuration for deployment tests.

These tests run against the actual deployed API (not mocked).
"""
import pytest
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env.test if it exists
load_dotenv(".env.test")

# Disable pytest-asyncio for these tests (we don't use async)
pytest_plugins = []


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "fast: Fast tests that don't use GPU")
    config.addinivalue_line("markers", "slow: Slow tests that may take minutes")
    config.addinivalue_line("markers", "expensive: Tests that consume Modal credits")
    config.addinivalue_line("markers", "smoke: Critical smoke tests")
    config.addinivalue_line("markers", "integration: Full integration tests")
    config.addinivalue_line("markers", "security: Security-focused tests")


@pytest.fixture(scope="session")
def api_url():
    """Get the API URL from environment."""
    url = os.getenv("API_URL", "https://my-app-production.up.railway.app")
    
    # Remove trailing slash if present
    return url.rstrip("/")


@pytest.fixture(scope="session")
def verify_api_accessible(api_url):
    """Verify the API is accessible before running tests."""
    try:
        response = requests.get(f"{api_url}/health", timeout=10)
        if response.status_code != 200:
            pytest.exit(f"API health check failed with status {response.status_code}")
    except requests.exceptions.RequestException as e:
        pytest.exit(f"Cannot reach API at {api_url}: {e}")
    
    return True


@pytest.fixture
def session():
    """Create a requests session for tests."""
    return requests.Session()


@pytest.fixture
def test_prompt():
    """Standard test prompt to use across tests."""
    return "Simple piano melody for testing"


@pytest.fixture
def test_duration():
    """Standard test duration (30s to minimize costs)."""
    return 30


@pytest.fixture
def cleanup_jobs():
    """Track jobs created during tests for cleanup."""
    jobs = []
    
    yield jobs
    
    # Cleanup logic could go here if needed
    # For now, jobs will naturally expire from the queue
