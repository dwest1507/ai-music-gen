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
    assert call_args["infer_method"] == "ode"
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
async def test_submit_generation_auto_lyrics_default(async_client, mock_acestep_client):
    """When no lyrics provided and instrumental=False, pass empty string so ACE-Step auto-generates lyrics."""
    mock_acestep_client.submit_task.return_value = {"task_id": "auto-lyrics-task"}

    payload = {"prompt": "A jazz melody"}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["lyrics"] == ""


@pytest.mark.asyncio
async def test_submit_generation_instrumental_flag(async_client, mock_acestep_client):
    """When instrumental=True, pass [Instrumental] to ACE-Step regardless of lyrics field."""
    mock_acestep_client.submit_task.return_value = {"task_id": "inst-task"}

    async_client.cookies.set("session_id", "test-instrumental-session")
    payload = {"prompt": "A jazz melody", "instrumental": True}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["lyrics"] == "[Instrumental]"


@pytest.mark.asyncio
async def test_submit_generation_with_infer_method_sde(
    async_client, mock_acestep_client
):
    mock_acestep_client.submit_task.return_value = {"task_id": "sde-task"}

    async_client.cookies.set("session_id", "test-sde-session")
    payload = {"prompt": "A folk song", "infer_method": "sde"}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["infer_method"] == "sde"


@pytest.mark.asyncio
async def test_submit_generation_validation_invalid_infer_method(async_client):
    payload = {"prompt": "test", "infer_method": "euler"}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_submit_generation_duration_max(async_client, mock_acestep_client):
    """Duration max is 300 seconds (5 minutes)."""
    mock_acestep_client.submit_task.return_value = {"task_id": "dur-task"}

    # Exactly at max should pass
    async_client.cookies.set("session_id", "test-dur-max-session")
    response = await async_client.post(
        "/api/generate", json={"prompt": "test", "duration": 300}
    )
    assert response.status_code == 202

    # One second over should fail (validation rejects before rate limiter)
    response = await async_client.post(
        "/api/generate", json={"prompt": "test", "duration": 301}
    )
    assert response.status_code == 422


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


@pytest.mark.asyncio
async def test_get_random_example(async_client):
    response = await async_client.get("/api/examples/random")
    assert response.status_code == 200
    data = response.json()
    assert "is_advanced" in data
    assert "prompt" in data


@pytest.mark.asyncio
async def test_get_random_example_simple(async_client):
    response = await async_client.get("/api/examples/random?is_advanced=false")
    assert response.status_code == 200
    data = response.json()
    assert data["is_advanced"] is False


@pytest.mark.asyncio
async def test_get_random_example_advanced(async_client):
    response = await async_client.get("/api/examples/random?is_advanced=true")
    assert response.status_code == 200
    data = response.json()
    assert data["is_advanced"] is True


# ── Error propagation ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_submit_generation_error(async_client, mock_acestep_client):
    from app.services.acestep_client import ACEStepError

    mock_acestep_client.submit_task.side_effect = ACEStepError(
        "Service unavailable", 503
    )
    response = await async_client.post("/api/generate", json={"prompt": "test track"})
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_submit_generation_with_bpm_key_timesig(
    async_client, mock_acestep_client
):
    """bpm, key_scale, and time_signature should be forwarded in the payload."""
    mock_acestep_client.submit_task.return_value = {"task_id": "bpm-task"}
    payload = {
        "prompt": "A track with metadata",
        "bpm": 120,
        "key_scale": "C Major",
        "time_signature": "4/4",
    }
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 202
    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["bpm"] == 120
    assert call_args["key_scale"] == "C Major"
    assert call_args["time_signature"] == "4/4"


@pytest.mark.asyncio
async def test_get_job_status_error(async_client, mock_acestep_client):
    from app.services.acestep_client import ACEStepError

    mock_acestep_client.query_result.side_effect = ACEStepError("Service error", 502)
    response = await async_client.get("/api/jobs/test-task")
    assert response.status_code == 502


@pytest.mark.asyncio
async def test_get_job_status_empty_tasks(async_client, mock_acestep_client):
    mock_acestep_client.query_result.return_value = []
    response = await async_client.get("/api/jobs/test-task")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_job_status_completed_multiple_audio(
    async_client, mock_acestep_client
):
    import json

    result_str = json.dumps(
        [
            {"file": "output/track1.mp3", "metas": {"prompt": "test", "bpm": 120}},
            {"file": "output/track2.mp3"},
        ]
    )
    mock_acestep_client.query_result.return_value = [
        {"status": 1, "result": result_str}
    ]
    response = await async_client.get("/api/jobs/task-123")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert "audio_urls" in data
    assert len(data["audio_urls"]) == 2


@pytest.mark.asyncio
async def test_get_job_status_completed_no_audio_files(
    async_client, mock_acestep_client
):
    import json

    result_str = json.dumps([{"metas": {"prompt": "test"}}])
    mock_acestep_client.query_result.return_value = [
        {"status": 1, "result": result_str}
    ]
    response = await async_client.get("/api/jobs/task-123")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert "audio_url" not in data


@pytest.mark.asyncio
async def test_get_job_status_completed_no_result_field(
    async_client, mock_acestep_client
):
    mock_acestep_client.query_result.return_value = [{"status": 1}]
    response = await async_client.get("/api/jobs/task-123")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert "audio_url" not in data


@pytest.mark.asyncio
async def test_get_job_status_completed_invalid_json_result(
    async_client, mock_acestep_client
):
    mock_acestep_client.query_result.return_value = [
        {"status": 1, "result": "not{valid}json"}
    ]
    response = await async_client.get("/api/jobs/task-123")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert "audio_url" not in data


@pytest.mark.asyncio
async def test_get_job_status_completed_metadata_keyscale_timesig(
    async_client, mock_acestep_client
):
    """keyscale and timesignature in metas should map to key_scale and time_signature."""
    import json

    result_str = json.dumps(
        [
            {
                "file": "output/track.mp3",
                "metas": {
                    "prompt": "test prompt",
                    "lyrics": "la la la",
                    "bpm": 140,
                    "duration": 60,
                    "keyscale": "G Minor",
                    "timesignature": "3/4",
                },
            }
        ]
    )
    mock_acestep_client.query_result.return_value = [
        {"status": 1, "result": result_str}
    ]
    response = await async_client.get("/api/jobs/task-123")
    assert response.status_code == 200
    data = response.json()
    assert data["metadata"]["key_scale"] == "G Minor"
    assert data["metadata"]["time_signature"] == "3/4"
    assert data["metadata"]["lyrics"] == "la la la"


@pytest.mark.asyncio
async def test_get_job_status_failed_no_error_field(async_client, mock_acestep_client):
    mock_acestep_client.query_result.return_value = [{"status": 2}]
    response = await async_client.get("/api/jobs/task-123")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert data["error"] == "Generation failed"


# ── Audio download ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_download_audio_path_with_query_string(async_client, mock_acestep_client):
    """?path= in the file URL should be extracted and URL-decoded."""
    import json

    result_str = json.dumps([{"file": "/v1/audio?path=output%2Ftest.mp3"}])
    mock_acestep_client.query_result.return_value = [
        {"status": 1, "result": result_str}
    ]

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.headers = {"content-type": "audio/mpeg"}

    async def mock_aiter_bytes(*args, **kwargs):
        yield b"audio-data"

    mock_response.aiter_bytes = mock_aiter_bytes
    mock_acestep_client.download_audio_stream.return_value = mock_response

    response = await async_client.get("/api/audio/test-task")
    assert response.status_code == 200
    call_arg = mock_acestep_client.download_audio_stream.call_args[0][0]
    assert call_arg == "output/test.mp3"


@pytest.mark.asyncio
async def test_download_audio_wav_content_type(async_client, mock_acestep_client):
    """WAV content type should produce a .wav filename."""
    import json

    result_str = json.dumps([{"file": "output/test.wav"}])
    mock_acestep_client.query_result.return_value = [
        {"status": 1, "result": result_str}
    ]

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.headers = {"content-type": "audio/wav"}

    async def mock_aiter_bytes(*args, **kwargs):
        yield b"wav-data"

    mock_response.aiter_bytes = mock_aiter_bytes
    mock_acestep_client.download_audio_stream.return_value = mock_response

    response = await async_client.get("/api/audio/test-task")
    assert response.status_code == 200
    assert "music_test-task.wav" in response.headers.get("content-disposition", "")


@pytest.mark.asyncio
async def test_download_audio_index_out_of_range(async_client, mock_acestep_client):
    import json

    result_str = json.dumps([{"file": "output/test.mp3"}])
    mock_acestep_client.query_result.return_value = [
        {"status": 1, "result": result_str}
    ]
    response = await async_client.get("/api/audio/test-task?index=5")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_download_audio_no_files(async_client, mock_acestep_client):
    import json

    result_str = json.dumps([{"metas": {}}])
    mock_acestep_client.query_result.return_value = [
        {"status": 1, "result": result_str}
    ]
    response = await async_client.get("/api/audio/test-task")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_download_audio_error(async_client, mock_acestep_client):
    from app.services.acestep_client import ACEStepError

    mock_acestep_client.query_result.side_effect = ACEStepError("Service error", 503)
    response = await async_client.get("/api/audio/test-task")
    assert response.status_code == 503


# ── Models / Random sample / Format ──────────────────────────────


@pytest.mark.asyncio
async def test_list_models_error(async_client, mock_acestep_client):
    from app.services.acestep_client import ACEStepError

    mock_acestep_client.list_models.side_effect = ACEStepError("Service down", 502)
    response = await async_client.get("/api/models")
    assert response.status_code == 502


@pytest.mark.asyncio
async def test_random_sample(async_client, mock_acestep_client):
    mock_acestep_client.get_random_sample.return_value = {"prompt": "test sample"}
    response = await async_client.post("/api/random-sample", json={})
    assert response.status_code == 200
    assert response.json()["prompt"] == "test sample"


@pytest.mark.asyncio
async def test_random_sample_with_query(async_client, mock_acestep_client):
    mock_acestep_client.get_random_sample.return_value = {"prompt": "jazz sample"}
    response = await async_client.post(
        "/api/random-sample", json={"sample_query": "jazz"}
    )
    assert response.status_code == 200
    call_arg = mock_acestep_client.get_random_sample.call_args[0][0]
    assert call_arg == {"sample_query": "jazz"}


@pytest.mark.asyncio
async def test_random_sample_error(async_client, mock_acestep_client):
    from app.services.acestep_client import ACEStepError

    mock_acestep_client.get_random_sample.side_effect = ACEStepError("Error", 502)
    response = await async_client.post("/api/random-sample", json={})
    assert response.status_code == 502


@pytest.mark.asyncio
async def test_format_input(async_client, mock_acestep_client):
    mock_acestep_client.format_input.return_value = {"prompt": "enhanced", "lyrics": ""}
    response = await async_client.post("/api/format", json={"prompt": "raw"})
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_format_input_error(async_client, mock_acestep_client):
    from app.services.acestep_client import ACEStepError

    mock_acestep_client.format_input.side_effect = ACEStepError("Error", 502)
    response = await async_client.post("/api/format", json={"prompt": "test"})
    assert response.status_code == 502


# ── Health check / Session ────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_check_upstream_unreachable(async_client, mock_acestep_client):
    mock_acestep_client.health_check.side_effect = Exception("Connection refused")
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["upstream"] == "unreachable"


def test_get_session_id_secure_cookie():
    """When FRONTEND_URL is non-localhost, session cookie should use secure=True."""
    from unittest.mock import patch, MagicMock
    from fastapi import Request, Response as FastAPIResponse
    from app.api.routes.generation import get_session_id
    from app.api.routes import generation

    mock_request = MagicMock(spec=Request)
    mock_request.cookies = {}
    mock_response = MagicMock(spec=FastAPIResponse)

    with patch.object(generation.settings, "FRONTEND_URL", "https://app.example.com"):
        session_id = get_session_id(mock_request, mock_response)

    assert session_id is not None
    mock_response.set_cookie.assert_called_once()
    call_kwargs = mock_response.set_cookie.call_args[1]
    assert call_kwargs["secure"] is True


# ── get_random_example edge cases ────────────────────────────────


@pytest.mark.asyncio
async def test_get_random_example_directory_not_found(async_client, tmp_path):
    from unittest.mock import patch

    with patch(
        "app.api.routes.generation.EXAMPLES_ROOT",
        new=tmp_path / "nonexistent_subdir",
    ):
        response = await async_client.get("/api/examples/random?is_advanced=false")
    assert response.status_code == 500


@pytest.mark.asyncio
async def test_get_random_example_no_files(async_client, tmp_path):
    from unittest.mock import patch

    (tmp_path / "simple_mode").mkdir()
    (tmp_path / "text2music").mkdir()

    with patch("app.api.routes.generation.EXAMPLES_ROOT", new=tmp_path):
        response = await async_client.get("/api/examples/random?is_advanced=false")
    assert response.status_code == 500
