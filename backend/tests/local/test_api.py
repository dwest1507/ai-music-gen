import pytest
from unittest.mock import MagicMock
import httpx


@pytest.mark.asyncio
async def test_health_check(async_client, mock_acestep_client):
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "1.0.0"
    assert data["upstream"] == "healthy"


@pytest.mark.asyncio
async def test_submit_generation(async_client, mock_acestep_client):
    mock_acestep_client.submit_task.return_value = {
        "task_id": "test-task-123",
        "queue_position": 1,
    }

    payload = {
        "prompt": "An epic orchestral soundtrack",
        "duration": 60,
        "genre": "Cinematic",
    }

    response = await async_client.post("/api/generate", json=payload)

    assert response.status_code == 202
    data = response.json()
    assert data["task_id"] == "test-task-123"
    assert data["status"] == "queued"
    assert data["queue_position"] == 1

    # Verify the client was called with transformed payload
    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert "Cinematic" in call_args["prompt"]
    assert call_args["audio_duration"] == 60
    assert call_args["thinking"] is True
    assert "session_id" in response.cookies


@pytest.mark.asyncio
async def test_submit_generation_with_lyrics(async_client, mock_acestep_client):
    mock_acestep_client.submit_task.return_value = {"task_id": "lyrics-task"}

    payload = {
        "prompt": "A pop ballad",
        "lyrics": "Hello world, this is a song",
        "duration": 30,
        "vocal_language": "en",
        "audio_format": "wav",
    }

    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["lyrics"] == "Hello world, this is a song"
    assert call_args["audio_format"] == "wav"


@pytest.mark.asyncio
async def test_submit_generation_instrumental_default(
    async_client, mock_acestep_client
):
    """When no lyrics provided, default to [Instrumental]."""
    mock_acestep_client.submit_task.return_value = {"task_id": "inst-task"}

    payload = {"prompt": "A jazz melody"}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["lyrics"] == "[Instrumental]"


@pytest.mark.asyncio
async def test_submit_generation_validation_empty_prompt(async_client):
    payload = {"prompt": "   "}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_submit_generation_validation_invalid_format(async_client):
    payload = {"prompt": "test", "audio_format": "ogg"}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_job_status_completed(async_client, mock_acestep_client):
    import json

    result_str = json.dumps(
        [
            {
                "file": "output/test-task.mp3",
                "metas": {
                    "prompt": "epic soundtrack",
                    "duration": 60,
                },
            }
        ]
    )
    mock_acestep_client.query_result.return_value = [
        {
            "status": 1,  # completed
            "result": result_str,
        }
    ]

    response = await async_client.get("/api/jobs/test-task-123")
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "test-task-123"
    assert data["status"] == "completed"
    assert "/api/audio/test-task-123" in data["audio_url"]
    assert data["metadata"]["prompt"] == "epic soundtrack"


@pytest.mark.asyncio
async def test_get_job_status_processing(async_client, mock_acestep_client):
    mock_acestep_client.query_result.return_value = [{"status": 0}]

    response = await async_client.get("/api/jobs/test-task-123")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"


@pytest.mark.asyncio
async def test_get_job_status_failed(async_client, mock_acestep_client):
    mock_acestep_client.query_result.return_value = [
        {"status": 2, "error": "Out of GPU memory"}
    ]

    response = await async_client.get("/api/jobs/test-task-123")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert data["error"] == "Out of GPU memory"


@pytest.mark.asyncio
async def test_download_audio(async_client, mock_acestep_client):
    import json

    result_str = json.dumps([{"file": "output/test.mp3"}])
    mock_acestep_client.query_result.return_value = [
        {"status": 1, "result": result_str}
    ]
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.headers = {"content-type": "audio/mpeg"}

    # We mock the async generator for the chunks
    async def mock_aiter_bytes(*args, **kwargs):
        yield b"fake-audio-data"

    mock_response.aiter_bytes = mock_aiter_bytes
    mock_acestep_client.download_audio_stream.return_value = mock_response

    response = await async_client.get("/api/audio/test-task?path=output/test.mp3")
    assert response.status_code == 200
    assert response.content == b"fake-audio-data"
    assert "music_test-task.mp3" in response.headers.get("content-disposition", "")


@pytest.mark.asyncio
async def test_list_models(async_client, mock_acestep_client):
    mock_acestep_client.list_models.return_value = [{"model_id": "ace-step-v1.5"}]

    response = await async_client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1


@pytest.mark.asyncio
async def test_cancel_job(async_client):
    response = await async_client.delete("/api/jobs/test-task-123")
    assert response.status_code == 204
