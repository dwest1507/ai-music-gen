"""Behaviour of GET /api/gpu-ready — the readiness probe a visitor polls before submitting.

A Modal wake that rebuilds its snapshot takes minutes, and Railway closes a request
that sends nothing for five. Holding /api/generate open through the wake lost the
response, so the frontend waits for the GPU with short probes and only then submits.
See ADR 0005.
"""

import pytest

from app.core.warm_state import WarmState
from app.services.acestep_client import ACEStepError


@pytest.mark.asyncio
async def test_gpu_ready_reports_ready_when_the_gpu_answers(
    async_client, mock_acestep_client
):
    response = await async_client.get("/api/gpu-ready")

    assert response.status_code == 200
    assert response.json() == {"ready": True}


@pytest.mark.asyncio
async def test_gpu_ready_reports_not_ready_while_the_gpu_is_waking(
    async_client, mock_acestep_client
):
    # A waking container does not answer within the health check's ten seconds.
    # That is the expected answer to a probe, not a failure to surface.
    mock_acestep_client.health_check.side_effect = ACEStepError(
        "Cannot reach music generation service.", 503
    )

    response = await async_client.get("/api/gpu-ready")

    assert response.status_code == 200
    assert response.json() == {"ready": False}


@pytest.mark.asyncio
async def test_gpu_ready_asks_the_gpu_on_every_probe_unlike_prewarm(
    async_client, mock_acestep_client, fake_clock
):
    # Prewarm answers from its dedupe window and stops at the monthly budget. A
    # probe must do neither: a cached "cold" would hold the visitor at "Waking GPU"
    # after the GPU came up, and a spent budget would stop them generating at all.
    from app.main import app

    app.state.warm_state = WarmState(
        clock=fake_clock, calendar_clock=fake_clock.calendar, monthly_budget=1
    )
    await async_client.post("/api/warmup")  # spends the budget, opens the window
    mock_acestep_client.health_check.reset_mock()

    for _ in range(3):
        await async_client.get("/api/gpu-ready")

    assert mock_acestep_client.health_check.await_count == 3


@pytest.mark.asyncio
async def test_gpu_ready_reports_not_ready_on_an_unconverted_error(
    async_client, mock_acestep_client
):
    # A connection dropped mid-read by a container that is still coming up is not
    # converted to ACEStepError. The visitor's wait should carry on, not end in a 500.
    mock_acestep_client.health_check.side_effect = RuntimeError("connection reset")

    response = await async_client.get("/api/gpu-ready")

    assert response.status_code == 200
    assert response.json() == {"ready": False}


@pytest.mark.asyncio
async def test_gpu_ready_rate_limit_returns_429_without_reaching_the_gpu(
    async_client, mock_acestep_client
):
    """30 probes a minute per client, then 429s.

    A visitor polling every five seconds, each probe waiting up to ten on a cold
    GPU, makes at most twelve a minute. The limit is for anything faster.
    """
    for _ in range(30):
        assert (await async_client.get("/api/gpu-ready")).status_code == 200
    mock_acestep_client.health_check.reset_mock()

    assert (await async_client.get("/api/gpu-ready")).status_code == 429
    mock_acestep_client.health_check.assert_not_awaited()
