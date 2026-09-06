import json
import pytest
from unittest.mock import MagicMock, patch
import httpx
from app.services.acestep_client import ACEStepError


@pytest.mark.asyncio
async def test_health_check_answers_without_contacting_upstream(
    async_client, mock_acestep_client
):
    """Liveness must not wake the GPU.

    A health check that pings Modal turns every uptime probe and deploy check
    into a GPU wake, and stalls for the length of a cold start while doing it.
    """
    response = await async_client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "1.0.0"
    mock_acestep_client.health_check.assert_not_awaited()


@pytest.mark.asyncio
async def test_upstream_health_check_reports_reachability(
    async_client, mock_acestep_client
):
    response = await async_client.get("/health/upstream")

    assert response.status_code == 200
    assert response.json()["upstream"] == "healthy"


@pytest.mark.asyncio
async def test_upstream_health_check_reports_an_unreachable_service(
    async_client, mock_acestep_client
):
    from app.services.acestep_client import ACEStepError

    mock_acestep_client.health_check.side_effect = ACEStepError("down", 503)

    response = await async_client.get("/health/upstream")

    assert response.status_code == 200
    assert response.json()["upstream"] == "unreachable"


@pytest.mark.asyncio
async def test_submit_generation(async_client, mock_acestep_client):
    mock_acestep_client.submit_task.return_value = {
        "task_id": "test-task-123",
        "queue_position": 1,
    }

    payload = {
        "prompt": "An epic orchestral soundtrack",
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
    assert "audio_duration" not in call_args  # duration omitted when not provided
    assert call_args["thinking"] is True
    assert call_args["use_format"] is False
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
    assert call_args["audio_duration"] == 30  # duration included when explicitly set


@pytest.mark.asyncio
async def test_submit_generation_no_lyrics_enables_sample_mode(
    async_client, mock_acestep_client
):
    """When no lyrics provided, sample_mode=True and sample_query are set for ACE-Step auto-generation."""
    mock_acestep_client.submit_task.return_value = {"task_id": "auto-lyrics-task"}

    payload = {"prompt": "A jazz melody"}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["lyrics"] == ""
    assert call_args["sample_mode"] is True
    assert call_args["sample_query"] == "A jazz melody"


@pytest.mark.asyncio
async def test_submit_generation_pins_language_without_polluting_the_query(
    async_client, mock_acestep_client
):
    """The chosen language is pinned by flags, not by wording appended to the query.

    Upstream lets the LM choose its own language during CoT unless use_cot_language is
    off, and the codes it then generates are what actually gets sung. Turning the flag
    off is the fix; the old "(lyrics in Spanish)" suffix only leaked into the caption.
    """
    mock_acestep_client.submit_task.return_value = {"task_id": "lang-hint-task"}

    async_client.cookies.set("session_id", "test-lang-hint-session")
    payload = {"prompt": "A trap rap song", "vocal_language": "es"}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["sample_mode"] is True
    assert call_args["vocal_language"] == "es"
    assert call_args["use_cot_language"] is False
    assert call_args["sample_query"] == "A trap rap song"


@pytest.mark.asyncio
async def test_submit_generation_sample_query_includes_genre(
    async_client, mock_acestep_client
):
    """The lyrics query reuses the genre-prefixed prompt so lyrics match the genre."""
    mock_acestep_client.submit_task.return_value = {"task_id": "genre-query-task"}

    payload = {"prompt": "a song about rain", "genre": "Metal"}
    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["prompt"] == "Metal. a song about rain"
    assert call_args["sample_query"] == "Metal. a song about rain"


@pytest.mark.asyncio
async def test_submit_generation_user_lyrics_disables_sample_mode(
    async_client, mock_acestep_client
):
    """When user provides lyrics, sample_mode is NOT set."""
    mock_acestep_client.submit_task.return_value = {"task_id": "user-lyrics-task"}

    payload = {
        "prompt": "A pop ballad",
        "lyrics": "Hello world, this is my song",
    }
    response = await async_client.post("/api/generate", json=payload)

    assert response.status_code == 202
    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["lyrics"] == "Hello world, this is my song"
    assert "sample_mode" not in call_args
    assert "sample_query" not in call_args


@pytest.mark.asyncio
async def test_submit_generation_instrumental_disables_sample_mode(
    async_client, mock_acestep_client
):
    """When instrumental=True, sample_mode is NOT set."""
    mock_acestep_client.submit_task.return_value = {"task_id": "inst-task"}

    payload = {"prompt": "A jazz melody", "instrumental": True}
    response = await async_client.post("/api/generate", json=payload)

    assert response.status_code == 202
    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["lyrics"] == "[Instrumental]"
    assert "sample_mode" not in call_args
    assert "sample_query" not in call_args


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
    assert data["prompt"]
    assert set(data) == {"prompt", "lyrics", "vocal_language", "instrumental"}


@pytest.mark.asyncio
async def test_get_random_example_pools_both_collections(async_client, tmp_path):
    """One pool spans both example directories, so every example is reachable."""
    (tmp_path / "simple_mode").mkdir()
    (tmp_path / "simple_mode" / "s.json").write_text(json.dumps({"description": "s"}))
    (tmp_path / "text2music").mkdir()
    (tmp_path / "text2music" / "t.json").write_text(json.dumps({"caption": "t"}))

    pools = []

    def capture_choice(seq):
        pools.append(list(seq))
        return seq[0]

    with (
        patch("app.api.routes.generation.EXAMPLES_ROOT", new=tmp_path),
        patch("app.api.routes.generation.random.choice", side_effect=capture_choice),
    ):
        response = await async_client.get("/api/examples/random")

    assert response.status_code == 200
    assert {dirname for dirname, _ in pools[0]} == {"simple_mode", "text2music"}


@pytest.mark.asyncio
async def test_get_random_example_rate_limit_returns_429(async_client):
    """/api/examples/random allows 10 requests per minute per session, then 429s."""
    async_client.cookies.set("session_id", "example-rate-limit-session")

    for _ in range(10):
        assert (await async_client.get("/api/examples/random")).status_code == 200

    assert (await async_client.get("/api/examples/random")).status_code == 429


@pytest.mark.asyncio
async def test_get_random_example_maps_simple_mode_fields(async_client, tmp_path):
    """A simple_mode example maps description/instrumental and drops lyrics."""
    (tmp_path / "simple_mode").mkdir()
    (tmp_path / "simple_mode" / "one.json").write_text(
        json.dumps(
            {
                "description": "a mellow guitar instrumental",
                "instrumental": True,
                "vocal_language": "unknown",
            }
        )
    )

    with patch("app.api.routes.generation.EXAMPLES_ROOT", new=tmp_path):
        response = await async_client.get("/api/examples/random")

    assert response.status_code == 200
    assert response.json() == {
        "prompt": "a mellow guitar instrumental",
        "lyrics": "",
        # "unknown" is not a language the form offers, so it falls back to "en"
        "vocal_language": "en",
        "instrumental": True,
    }


@pytest.mark.asyncio
async def test_get_random_example_maps_text2music_fields(async_client, tmp_path):
    """A text2music example maps caption/lyrics/language and is never instrumental."""
    (tmp_path / "text2music").mkdir()
    (tmp_path / "text2music" / "one.json").write_text(
        json.dumps(
            {
                "caption": "an upbeat city pop track",
                "lyrics": "[Verse 1]\nneon rain",
                "language": "ja",
                "bpm": 120,
                "duration": 160,
            }
        )
    )

    with patch("app.api.routes.generation.EXAMPLES_ROOT", new=tmp_path):
        response = await async_client.get("/api/examples/random")

    assert response.status_code == 200
    assert response.json() == {
        "prompt": "an upbeat city pop track",
        "lyrics": "[Verse 1]\nneon rain",
        "vocal_language": "ja",
        "instrumental": False,
    }


@pytest.mark.asyncio
async def test_get_random_example_unreadable_file_returns_500(async_client, tmp_path):
    """A malformed example file surfaces as a 500, not an unhandled error."""
    (tmp_path / "simple_mode").mkdir()
    (tmp_path / "simple_mode" / "broken.json").write_text("{ not json")

    with patch("app.api.routes.generation.EXAMPLES_ROOT", new=tmp_path):
        response = await async_client.get("/api/examples/random")

    assert response.status_code == 500
    assert "Failed to fetch example" in response.json()["detail"]


@pytest.mark.asyncio
async def test_generate_rate_limit_returns_429(async_client, mock_acestep_client):
    """/api/generate allows 5 requests per minute per session, then 429s."""
    mock_acestep_client.submit_task.return_value = {"task_id": "rate-limited-task"}
    async_client.cookies.set("session_id", "rate-limit-session")

    payload = {"prompt": "A short jingle"}
    for _ in range(5):
        assert (
            await async_client.post("/api/generate", json=payload)
        ).status_code == 202

    response = await async_client.post("/api/generate", json=payload)
    assert response.status_code == 429


# ── Error propagation ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_submit_generation_error(async_client, mock_acestep_client):
    from app.services.acestep_client import ACEStepError

    mock_acestep_client.submit_task.side_effect = ACEStepError(
        "Service unavailable", 503
    )
    async_client.cookies.set("session_id", "test-submit-error-session")
    response = await async_client.post("/api/generate", json={"prompt": "test track"})
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_submit_generation_with_bpm_key_timesig(
    async_client, mock_acestep_client
):
    """bpm, key_scale, and time_signature should be forwarded in the payload."""
    mock_acestep_client.submit_task.return_value = {"task_id": "bpm-task"}
    async_client.cookies.set("session_id", "test-bpm-key-timesig-session")
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
async def test_health_check_stays_healthy_when_upstream_is_down(
    async_client, mock_acestep_client
):
    """Liveness is about this service, so an unreachable GPU must not fail it."""
    mock_acestep_client.health_check.side_effect = Exception("Connection refused")

    response = await async_client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


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
        response = await async_client.get("/api/examples/random")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_random_example_no_files(async_client, tmp_path):
    from unittest.mock import patch

    (tmp_path / "simple_mode").mkdir()
    (tmp_path / "text2music").mkdir()

    with patch("app.api.routes.generation.EXAMPLES_ROOT", new=tmp_path):
        response = await async_client.get("/api/examples/random")
    assert response.status_code == 404


# ── Single-pass conditioning (SPEC.md §8.1, FR-20/21/22) ──────────


@pytest.mark.asyncio
async def test_user_lyrics_are_never_sent_for_lm_rewrite(
    async_client, mock_acestep_client
):
    """Lyrics the user typed reach the model verbatim.

    use_format runs upstream's format_sample, which regenerates lyrics free-form and
    returns its own text in place of the input. That is what made hand-written lyrics
    come back only partially used.
    """
    mock_acestep_client.submit_task.return_value = {"task_id": "verbatim-task"}

    lyrics = "[Verse]\nHe taught me how to drive\n\n[Chorus]\nAnd I never said thanks"
    response = await async_client.post(
        "/api/generate", json={"prompt": "A country ballad", "lyrics": lyrics}
    )
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["lyrics"] == lyrics
    assert call_args["use_format"] is False
    assert "sample_mode" not in call_args


@pytest.mark.asyncio
async def test_instrumental_request_is_not_sent_for_lm_rewrite(
    async_client, mock_acestep_client
):
    """An instrumental request keeps its [Instrumental] marker.

    format_sample regenerates the lyrics section whatever it was handed, so running it
    here can return invented lyrics and put vocals on a track that asked for none.
    """
    mock_acestep_client.submit_task.return_value = {"task_id": "instrumental-task"}

    response = await async_client.post(
        "/api/generate", json={"prompt": "A solo piano piece", "instrumental": True}
    )
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["lyrics"] == "[Instrumental]"
    assert call_args["use_format"] is False


@pytest.mark.asyncio
async def test_auto_lyrics_are_not_paraphrased_twice(
    async_client, mock_acestep_client
):
    """sample_mode already yields a clean caption and lyrics; don't format them again."""
    mock_acestep_client.submit_task.return_value = {"task_id": "single-pass-task"}

    response = await async_client.post("/api/generate", json={"prompt": "A jazz melody"})
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["sample_mode"] is True
    assert call_args["use_format"] is False


@pytest.mark.asyncio
async def test_topic_drives_lyrics_and_prompt_drives_style(
    async_client, mock_acestep_client
):
    """Subject matter goes to the lyric query; the caption stays a style description.

    An ACE-Step caption describes instrumentation and mood, so a narrative request
    placed there has no channel to the vocals (SPEC.md FR-20).
    """
    mock_acestep_client.submit_task.return_value = {"task_id": "topic-task"}

    response = await async_client.post(
        "/api/generate",
        json={
            "prompt": "warm acoustic guitar, gentle male vocal",
            "topic": "a father and son's relationship",
            "genre": "Country",
        },
    )
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["prompt"] == "Country. warm acoustic guitar, gentle male vocal"
    assert call_args["sample_query"] == "a father and son's relationship"


@pytest.mark.asyncio
async def test_sample_query_falls_back_to_the_prompt_without_a_topic(
    async_client, mock_acestep_client
):
    """Clients that predate the topic field keep working."""
    mock_acestep_client.submit_task.return_value = {"task_id": "fallback-task"}

    response = await async_client.post(
        "/api/generate", json={"prompt": "a song about rain"}
    )
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["sample_query"] == "a song about rain"


@pytest.mark.asyncio
async def test_the_lm_does_not_replace_the_caption_or_choose_the_language(
    async_client, mock_acestep_client
):
    """Both CoT overrides are off, so the DiT is conditioned on what the user chose."""
    mock_acestep_client.submit_task.return_value = {"task_id": "cot-task"}

    response = await async_client.post(
        "/api/generate", json={"prompt": "A synthwave track", "vocal_language": "ja"}
    )
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["use_cot_caption"] is False
    assert call_args["use_cot_language"] is False
    assert call_args["vocal_language"] == "ja"


@pytest.mark.asyncio
async def test_cot_caption_stays_switchable_for_ab_testing(
    async_client, mock_acestep_client
):
    """LM caption expansion helps a terse prompt, so the lever survives the default."""
    mock_acestep_client.submit_task.return_value = {"task_id": "ab-task"}

    response = await async_client.post(
        "/api/generate", json={"prompt": "country", "use_cot_caption": True}
    )
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["use_cot_caption"] is True


@pytest.mark.asyncio
async def test_lm_temperature_defaults_below_upstream(
    async_client, mock_acestep_client
):
    """Upstream defaults to 0.85; a cooler LM follows the prompt more closely."""
    mock_acestep_client.submit_task.return_value = {"task_id": "temp-task"}

    response = await async_client.post("/api/generate", json={"prompt": "A folk song"})
    assert response.status_code == 202

    assert mock_acestep_client.submit_task.call_args[0][0]["lm_temperature"] == 0.7


@pytest.mark.asyncio
async def test_instrumental_wording_does_not_silence_a_sung_request(
    async_client, mock_acestep_client
):
    """A style that mentions an instrumental passage must not suppress the vocals.

    Upstream's parse_description_hints scans sample_query for "instrumental", "pure
    music", "pure instrument", or a trailing "solo", and flips the whole request to
    instrumental. Only the explicit toggle should be able to do that.
    """
    mock_acestep_client.submit_task.return_value = {"task_id": "hint-task"}

    response = await async_client.post(
        "/api/generate",
        json={
            "prompt": "A ballad",
            "topic": "heartbreak, with an instrumental bridge and a closing guitar solo",
        },
    )
    assert response.status_code == 202

    query = mock_acestep_client.submit_task.call_args[0][0]["sample_query"]
    assert "instrumental" not in query.lower()
    assert not query.lower().endswith("solo")
    assert "heartbreak" in query
    assert "  " not in query


@pytest.mark.asyncio
async def test_explicit_duration_is_forwarded(async_client, mock_acestep_client):
    """Without a duration the LM picks one, which can be shorter than the lyrics need."""
    mock_acestep_client.submit_task.return_value = {"task_id": "duration-task"}

    response = await async_client.post(
        "/api/generate", json={"prompt": "A long ballad", "duration": 180}
    )
    assert response.status_code == 202

    assert mock_acestep_client.submit_task.call_args[0][0]["audio_duration"] == 180


# ── Two-stage caption (SPEC.md §8.2) ──────────────────────────────


@pytest.mark.asyncio
async def test_a_terse_style_prompt_is_enriched_before_generation(
    async_client, mock_acestep_client
):
    """A bare style prompt is expanded into a real caption before it conditions the DiT.

    "country" carries almost no production detail, and we no longer let the LM's CoT
    fill that gap because it replaced the caption wholesale. Enriching it up front and
    keeping the result is the controlled version of the same idea.
    """
    mock_acestep_client.format_input.return_value = {
        "caption": "A warm mid-tempo country ballad with acoustic guitar and pedal steel.",
        "lyrics": "[Instrumental]",
    }
    mock_acestep_client.submit_task.return_value = {"task_id": "enriched-task"}

    response = await async_client.post("/api/generate", json={"prompt": "country"})
    assert response.status_code == 202

    call_args = mock_acestep_client.submit_task.call_args[0][0]
    assert call_args["prompt"] == (
        "A warm mid-tempo country ballad with acoustic guitar and pedal steel."
    )


@pytest.mark.asyncio
async def test_a_detailed_style_prompt_is_left_alone(
    async_client, mock_acestep_client
):
    """A caption that already reads like one is not rewritten, and costs no round-trip.

    Enrichment exists to fill in what a bare genre word leaves out. Running it on a
    prompt the visitor wrote carefully would put us back where Tier 1 started —
    paraphrasing their text — and would add an LM call to every generation.
    """
    mock_acestep_client.submit_task.return_value = {"task_id": "detailed-task"}

    detailed = (
        "A brooding synthwave instrumental with analog pads, gated reverb drums, "
        "and a driving arpeggiated bassline under a slow, wide lead."
    )
    response = await async_client.post("/api/generate", json={"prompt": detailed})
    assert response.status_code == 202

    mock_acestep_client.format_input.assert_not_called()
    assert mock_acestep_client.submit_task.call_args[0][0]["prompt"] == detailed


@pytest.mark.asyncio
async def test_enrichment_never_sees_the_users_lyrics(
    async_client, mock_acestep_client
):
    """The pre-pass is sent empty lyrics, whatever the visitor wrote.

    format_input runs the same format_sample that regenerates lyrics free-form. Sending
    it the real lyrics would reintroduce exactly the rewrite FR-21 exists to prevent,
    just one call earlier.
    """
    mock_acestep_client.format_input.return_value = {"caption": "An enriched caption."}
    mock_acestep_client.submit_task.return_value = {"task_id": "no-lyrics-leak"}

    lyrics = "[Verse]\nWords the visitor wrote themselves"
    response = await async_client.post(
        "/api/generate", json={"prompt": "country", "lyrics": lyrics}
    )
    assert response.status_code == 202

    sent = mock_acestep_client.format_input.call_args[0][0]
    assert sent["lyrics"] == ""
    assert lyrics not in str(sent)
    # ...and the real lyrics still reach generation untouched.
    assert mock_acestep_client.submit_task.call_args[0][0]["lyrics"] == lyrics


@pytest.mark.asyncio
async def test_a_failed_enrichment_still_generates(async_client, mock_acestep_client):
    """Enrichment is an improvement, not a dependency.

    It is a second upstream call on the way to the one the visitor actually asked for,
    so a failure there must cost them a thinner caption, not their song.
    """
    mock_acestep_client.format_input.side_effect = ACEStepError("LM unavailable", 502)
    mock_acestep_client.submit_task.return_value = {"task_id": "degraded-task"}

    response = await async_client.post(
        "/api/generate", json={"prompt": "country", "genre": "Country"}
    )
    assert response.status_code == 202

    assert mock_acestep_client.submit_task.call_args[0][0]["prompt"] == "Country. country"


@pytest.mark.asyncio
async def test_composed_style_wording_is_not_treated_as_a_bare_label(
    async_client, mock_acestep_client
):
    """Six words naming instruments and a vocal is a description, not a label.

    This is the line the threshold draws. Getting it wrong in this direction would
    paraphrase text the visitor composed — the failure Tier 1 fixed — so the boundary
    is asserted rather than left to the constant.
    """
    mock_acestep_client.submit_task.return_value = {"task_id": "boundary-task"}

    response = await async_client.post(
        "/api/generate", json={"prompt": "warm acoustic guitar, gentle male vocals"}
    )
    assert response.status_code == 202

    mock_acestep_client.format_input.assert_not_called()


@pytest.mark.asyncio
async def test_a_malformed_enrichment_response_still_generates(
    async_client, mock_acestep_client
):
    """A response that is not a caption-bearing object degrades like a failure.

    The client unwraps whatever upstream put in `data`, which is not guaranteed to be
    an object. Reading it must not be the thing that fails the visitor's song.
    """
    mock_acestep_client.format_input.return_value = None
    mock_acestep_client.submit_task.return_value = {"task_id": "malformed-task"}

    response = await async_client.post("/api/generate", json={"prompt": "country"})
    assert response.status_code == 202

    assert mock_acestep_client.submit_task.call_args[0][0]["prompt"] == "country"
