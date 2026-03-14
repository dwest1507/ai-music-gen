import pytest
from unittest.mock import MagicMock
from httpx import Response

@pytest.mark.asyncio
async def test_integration_workflow(async_client, mock_acestep_client):
    """
    Test the complete workflow: submit job -> poll status -> download audio.
    This simulates the E2E flow using a mocked ACE-Step API to avoid costs.
    """
    task_id = "mock-integration-task"
    audio_path = "output/music.mp3"
    
    # Setup mock for submission
    mock_acestep_client.submit_task.return_value = {
        "task_id": task_id,
        "queue_position": 1
    }
    
    # 1. Submit generation job
    submit_response = await async_client.post(
        "/api/generate",
        json={
            "prompt": "Test integration prompt",
            "duration": 10,
            "genre": "test"
        }
    )
    
    assert submit_response.status_code == 202
    job_data = submit_response.json()
    assert job_data["task_id"] == task_id
    assert job_data["status"] == "queued"
    
    # 2. Poll for completion
    # We'll simulate 1 processing response, then 1 completed response
    mock_acestep_client.query_result.side_effect = [
        [{"status": 0}], # processing
        [{"status": 1, "file": [audio_path], "prompt": "Test integration prompt", "audio_duration": 10}] # completed
    ]
    
    # First poll: Processing
    poll_1 = await async_client.get(f"/api/jobs/{task_id}")
    assert poll_1.status_code == 200
    poll_1_data = poll_1.json()
    assert poll_1_data["status"] == "processing"
    
    # Second poll: Completed
    poll_2 = await async_client.get(f"/api/jobs/{task_id}")
    assert poll_2.status_code == 200
    poll_2_data = poll_2.json()
    assert poll_2_data["status"] == "completed"
    assert "audio_url" in poll_2_data
    
    # Extract relative audio URL path
    audio_url = poll_2_data["audio_url"]
    
    # 3. Download audio
    # Setup mock for audio download
    mock_audio_response = MagicMock(spec=Response)
    mock_audio_response.content = b"fake-audio-content"
    mock_audio_response.headers = {"content-type": "audio/mpeg"}
    mock_acestep_client.download_audio.return_value = mock_audio_response
    
    download_response = await async_client.get(audio_url)
    assert download_response.status_code == 200
    assert download_response.content == b"fake-audio-content"
    assert "audio/mpeg" in download_response.headers["content-type"]
