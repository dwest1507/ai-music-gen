import pytest
from httpx import Response, TimeoutException
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
    mock_resp = Response(200, content=b"audio-data")
    mock_httpx_client.send.return_value = mock_resp

    resp = await acestep_client.download_audio_stream("path/to/file.mp3")
    assert resp.status_code == 200
    assert resp.content == b"audio-data"


# ── _headers ──────────────────────────────────────────────────────


def test_headers_without_api_key(acestep_client):
    acestep_client.api_key = ""
    headers = acestep_client._headers()
    assert headers["Content-Type"] == "application/json"
    assert "Authorization" not in headers


def test_headers_with_api_key(acestep_client):
    acestep_client.api_key = "test-api-key"  # pragma: allowlist secret
    headers = acestep_client._headers()
    assert headers["Authorization"] == "Bearer test-api-key"


# ── _unwrap ───────────────────────────────────────────────────────


def test_unwrap_401_raises_500(acestep_client):
    with pytest.raises(ACEStepError) as exc:
        acestep_client._unwrap(Response(401))
    assert exc.value.status_code == 500


def test_unwrap_500_raises_502(acestep_client):
    with pytest.raises(ACEStepError) as exc:
        acestep_client._unwrap(Response(500))
    assert exc.value.status_code == 502


def test_unwrap_400_raises_400(acestep_client):
    with pytest.raises(ACEStepError) as exc:
        acestep_client._unwrap(Response(400))
    assert exc.value.status_code == 400


def test_unwrap_string_error_in_body(acestep_client):
    resp = Response(200, json={"error": "Something went wrong", "data": None})
    with pytest.raises(ACEStepError):
        acestep_client._unwrap(resp)


def test_unwrap_dict_error_in_body(acestep_client):
    resp = Response(200, json={"error": {"code": 500}, "data": None})
    with pytest.raises(ACEStepError):
        acestep_client._unwrap(resp)


def test_unwrap_returns_data_field(acestep_client):
    resp = Response(200, json={"data": {"task_id": "abc"}, "error": None})
    assert acestep_client._unwrap(resp) == {"task_id": "abc"}


def test_unwrap_returns_body_when_no_data_key(acestep_client):
    resp = Response(200, json={"task_id": "abc"})
    assert acestep_client._unwrap(resp) == {"task_id": "abc"}


# ── submit_task ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_submit_task_connect_error(acestep_client, mock_httpx_client):
    from httpx import ConnectError

    mock_httpx_client.post.side_effect = ConnectError("refused")
    with pytest.raises(ACEStepError) as exc:
        await acestep_client.submit_task({})
    assert exc.value.status_code == 503


# ── query_result ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_query_result_success(acestep_client, mock_httpx_client):
    mock_httpx_client.post.return_value = Response(
        200, json={"data": [{"status": 1}], "error": None}
    )
    result = await acestep_client.query_result(["task-id"])
    assert result == [{"status": 1}]


@pytest.mark.asyncio
async def test_query_result_timeout(acestep_client, mock_httpx_client):
    mock_httpx_client.post.side_effect = TimeoutException("timeout")
    with pytest.raises(ACEStepError) as exc:
        await acestep_client.query_result(["task-id"])
    assert exc.value.status_code == 504


@pytest.mark.asyncio
async def test_query_result_connect_error(acestep_client, mock_httpx_client):
    from httpx import ConnectError

    mock_httpx_client.post.side_effect = ConnectError("refused")
    with pytest.raises(ACEStepError) as exc:
        await acestep_client.query_result(["task-id"])
    assert exc.value.status_code == 503


# ── download_audio_stream ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_download_audio_stream_non_200(acestep_client, mock_httpx_client):
    from unittest.mock import MagicMock

    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_resp.aread = AsyncMock()
    mock_resp.close = MagicMock()
    mock_httpx_client.send.return_value = mock_resp

    with pytest.raises(ACEStepError) as exc:
        await acestep_client.download_audio_stream("missing.mp3")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_download_audio_stream_timeout(acestep_client, mock_httpx_client):
    mock_httpx_client.send.side_effect = TimeoutException("timeout")
    with pytest.raises(ACEStepError) as exc:
        await acestep_client.download_audio_stream("file.mp3")
    assert exc.value.status_code == 504


@pytest.mark.asyncio
async def test_download_audio_stream_connect_error(acestep_client, mock_httpx_client):
    from httpx import ConnectError

    mock_httpx_client.send.side_effect = ConnectError("refused")
    with pytest.raises(ACEStepError) as exc:
        await acestep_client.download_audio_stream("file.mp3")
    assert exc.value.status_code == 503


# ── health_check ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_check_success(acestep_client, mock_httpx_client):
    mock_httpx_client.get.return_value = Response(
        200, json={"data": {"status": "ok"}, "error": None}
    )
    result = await acestep_client.health_check()
    assert result == {"status": "ok"}


@pytest.mark.asyncio
async def test_health_check_timeout(acestep_client, mock_httpx_client):
    mock_httpx_client.get.side_effect = TimeoutException("timeout")
    with pytest.raises(ACEStepError) as exc:
        await acestep_client.health_check()
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_health_check_connect_error(acestep_client, mock_httpx_client):
    from httpx import ConnectError

    mock_httpx_client.get.side_effect = ConnectError("refused")
    with pytest.raises(ACEStepError):
        await acestep_client.health_check()


# ── list_models ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_models_success(acestep_client, mock_httpx_client):
    mock_httpx_client.get.return_value = Response(
        200, json={"data": [{"id": "m1"}], "error": None}
    )
    result = await acestep_client.list_models()
    assert result == [{"id": "m1"}]


@pytest.mark.asyncio
async def test_list_models_timeout(acestep_client, mock_httpx_client):
    mock_httpx_client.get.side_effect = TimeoutException("timeout")
    with pytest.raises(ACEStepError):
        await acestep_client.list_models()


@pytest.mark.asyncio
async def test_list_models_connect_error(acestep_client, mock_httpx_client):
    from httpx import ConnectError

    mock_httpx_client.get.side_effect = ConnectError("refused")
    with pytest.raises(ACEStepError):
        await acestep_client.list_models()


# ── get_random_sample ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_random_sample_success(acestep_client, mock_httpx_client):
    mock_httpx_client.post.return_value = Response(
        200, json={"data": {"prompt": "jazz"}, "error": None}
    )
    result = await acestep_client.get_random_sample({"sample_query": "jazz"})
    assert result == {"prompt": "jazz"}


@pytest.mark.asyncio
async def test_get_random_sample_no_params(acestep_client, mock_httpx_client):
    mock_httpx_client.post.return_value = Response(
        200, json={"data": {"prompt": "random"}, "error": None}
    )
    result = await acestep_client.get_random_sample()
    assert result == {"prompt": "random"}


@pytest.mark.asyncio
async def test_get_random_sample_timeout(acestep_client, mock_httpx_client):
    mock_httpx_client.post.side_effect = TimeoutException("timeout")
    with pytest.raises(ACEStepError):
        await acestep_client.get_random_sample()


@pytest.mark.asyncio
async def test_get_random_sample_connect_error(acestep_client, mock_httpx_client):
    from httpx import ConnectError

    mock_httpx_client.post.side_effect = ConnectError("refused")
    with pytest.raises(ACEStepError):
        await acestep_client.get_random_sample()


# ── format_input ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_format_input_success(acestep_client, mock_httpx_client):
    mock_httpx_client.post.return_value = Response(
        200, json={"data": {"prompt": "enhanced"}, "error": None}
    )
    result = await acestep_client.format_input({"prompt": "raw", "lyrics": ""})
    assert result == {"prompt": "enhanced"}


@pytest.mark.asyncio
async def test_format_input_timeout(acestep_client, mock_httpx_client):
    mock_httpx_client.post.side_effect = TimeoutException("timeout")
    with pytest.raises(ACEStepError):
        await acestep_client.format_input({"prompt": "raw"})


@pytest.mark.asyncio
async def test_format_input_connect_error(acestep_client, mock_httpx_client):
    from httpx import ConnectError

    mock_httpx_client.post.side_effect = ConnectError("refused")
    with pytest.raises(ACEStepError):
        await acestep_client.format_input({"prompt": "raw"})
