import pytest
from httpx import Response, TimeoutException, ConnectError
from unittest.mock import AsyncMock
from app.services.acestep_client import ACEStepClient, ACEStepError


@pytest.fixture
def mock_httpx_client():
    client = AsyncMock()
    return client


@pytest.fixture
def acestep_client(mock_httpx_client):
    from app.core.config import settings
    settings.ACESTEP_API_URL = "http://fake-api"
    settings.ACESTEP_API_KEY = "test-key"
    client = ACEStepClient(mock_httpx_client)
    # Re-init to use patched settings just in case
    client.base_url = "http://fake-api"
    client.api_key = "test-key"
    return client


@pytest.mark.asyncio
async def test_submit_task_success(acestep_client, mock_httpx_client):
    mock_httpx_client.post.return_value = Response(
        200, json={"code": 200, "data": {"task_id": "test-task", "queue_position": 1}}
    )
    
    result = await acestep_client.submit_task({"prompt": "test"})
    assert result["task_id"] == "test-task"
    assert result["queue_position"] == 1
    
    mock_httpx_client.post.assert_called_once()
    assert "Authorization" in mock_httpx_client.post.call_args.kwargs["headers"]


@pytest.mark.asyncio
async def test_error_handling_429(acestep_client, mock_httpx_client):
    mock_httpx_client.post.return_value = Response(429)
    
    with pytest.raises(ACEStepError) as exc_info:
        await acestep_client.submit_task({})
        
    assert exc_info.value.status_code == 503
    assert "busy" in exc_info.value.message


@pytest.mark.asyncio
async def test_error_handling_timeout(acestep_client, mock_httpx_client):
    mock_httpx_client.post.side_effect = TimeoutException("timed out")
    
    with pytest.raises(ACEStepError) as exc_info:
        await acestep_client.submit_task({})
        
    assert exc_info.value.status_code == 504


@pytest.mark.asyncio
async def test_download_audio_success(acestep_client, mock_httpx_client):
    mock_httpx_client.get.return_value = Response(200, content=b"audio-data")
    
    resp = await acestep_client.download_audio("path/to/file.mp3")
    assert resp.status_code == 200
    assert resp.content == b"audio-data"
