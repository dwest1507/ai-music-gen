import pytest
from unittest.mock import MagicMock
from app.services.job_queue import JobQueueService

@pytest.mark.asyncio
async def test_health_check(async_client):
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "version": "1.0.0"}

@pytest.mark.asyncio
async def test_submit_generation_job(async_client, mock_job_queue):
    # Setup mock return value
    mock_job = MagicMock()
    mock_job.id = "test-job-id"
    mock_job.meta = {}
    mock_job_queue.enqueue_job.return_value = mock_job
    
    payload = {
        "prompt": "An epic orchestral soundtrack",
        "duration": 60,
        "genre": "Cinematic"
    }
    
    response = await async_client.post("/api/generate", json=payload)
    
    # Verify response
    assert response.status_code == 202
    data = response.json()
    assert data["job_id"] == "test-job-id"
    assert data["status"] == "queued"
    
    # Verify queue interaction
    mock_job_queue.enqueue_job.assert_called_once()
    # Check that session_id was set in response cookie
    assert "session_id" in response.cookies

@pytest.mark.asyncio
async def test_get_job_status(async_client, mock_job_queue):
    # Mock a job
    job_id = "test-job-id"
    mock_job = MagicMock()
    mock_job.id = job_id
    mock_job.get_status.return_value = "processing"
    # Important: The API checks session_id match
    mock_job.meta = {"session_id": "test-session-id"}
    mock_job.created_at = "2023-01-01T00:00:00"
    mock_job.enqueued_at = "2023-01-01T00:00:00"
    mock_job.exc_info = None
    mock_job.is_finished = False
    
    mock_job_queue.get_job.return_value = mock_job
    
    # We need to set the session cookie in the request to match the job
    cookies = {"session_id": "test-session-id"}
    
    response = await async_client.get(f"/api/jobs/{job_id}", cookies=cookies)
    
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == job_id
    assert data["status"] == "processing"

@pytest.mark.asyncio
async def test_get_job_status_unauthorized(async_client, mock_job_queue):
    # Mock a job belonging to someone else
    job_id = "other-job-id"
    mock_job = MagicMock()
    mock_job.id = job_id
    mock_job.meta = {"session_id": "other-session-id"}
    mock_job_queue.get_job.return_value = mock_job
    
    cookies = {"session_id": "my-session-id"}
    
    response = await async_client.get(f"/api/jobs/{job_id}", cookies=cookies)
    
    # Should be 403 Forbidden
    assert response.status_code == 403
