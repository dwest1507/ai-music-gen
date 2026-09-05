"""Behaviour of POST /api/warmup — the GPU prewarm endpoint.

The endpoint exists so that Modal wake overlaps the time a visitor spends reading
the page and filling the form, instead of starting when they click Generate.
See SPEC.md FR-16 and ADR 0001.
"""

import pytest

from app.core.warm_state import WARM_DEDUPE_WINDOW_SECONDS, WarmState
from app.services.acestep_client import ACEStepError


@pytest.mark.asyncio
async def test_warmup_dispatches_a_wake_to_the_gpu(async_client, mock_acestep_client):
    """A warmup on a cold system reaches upstream, so the GPU starts booting."""
    response = await async_client.post("/api/warmup")

    assert response.status_code == 200
    mock_acestep_client.health_check.assert_awaited_once()


@pytest.mark.asyncio
async def test_warmup_succeeds_when_the_gpu_is_unreachable(
    async_client, mock_acestep_client
):
    """Prewarm is opportunistic — an unreachable GPU must not break the page.

    The visitor has not asked for anything yet, so there is nothing to report and
    nothing to retry. They simply pay Modal wake later if they do submit a Task.
    """
    mock_acestep_client.health_check.side_effect = ACEStepError(
        "Cannot reach music generation service.", 503
    )

    response = await async_client.post("/api/warmup")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_warmup_reports_an_already_warm_gpu(async_client, mock_acestep_client):
    """A fast reply means the container was up, so no wake was needed."""
    response = await async_client.post("/api/warmup")

    assert response.json()["warm"] is True


@pytest.mark.asyncio
async def test_warmup_reports_a_cold_gpu(async_client, mock_acestep_client):
    """A health check that does not come back means the container was scaled to zero.

    Modal begins booting as soon as the request reaches its ingress, so giving up
    on the reply still leaves a wake in progress — we just cannot confirm it. That
    distinction is what lets the UI name the phase the visitor is actually in.
    """
    mock_acestep_client.health_check.side_effect = ACEStepError(
        "Cannot reach music generation service.", 503
    )

    response = await async_client.post("/api/warmup")

    assert response.json()["warm"] is False


@pytest.mark.asyncio
async def test_repeat_warmup_inside_the_window_does_not_wake_the_gpu(
    async_client, mock_acestep_client
):
    """Concurrent visitors collapse into a single wake.

    This is the main cost control: without it, a burst of arrivals each pays for
    a wake of the same container.
    """
    await async_client.post("/api/warmup")
    await async_client.post("/api/warmup")
    await async_client.post("/api/warmup")

    assert mock_acestep_client.health_check.await_count == 1


@pytest.mark.asyncio
async def test_warmup_wakes_the_gpu_again_once_the_window_lapses(
    async_client, mock_acestep_client, fake_clock
):
    """The window must actually expire, or the heartbeat can never hold it open."""
    await async_client.post("/api/warmup")
    fake_clock.advance(WARM_DEDUPE_WINDOW_SECONDS + 1)
    await async_client.post("/api/warmup")

    assert mock_acestep_client.health_check.await_count == 2


@pytest.mark.asyncio
async def test_deduped_warmup_still_reports_the_gpu_as_warm(
    async_client, mock_acestep_client
):
    """Skipping the upstream call must not look like a cold GPU to the UI."""
    await async_client.post("/api/warmup")
    response = await async_client.post("/api/warmup")

    assert response.json()["warm"] is True


@pytest.mark.asyncio
async def test_warmup_stops_waking_the_gpu_once_the_monthly_budget_is_spent(
    async_client, mock_acestep_client, fake_clock
):
    """The only guard that bounds a slow-drip attacker.

    Rate limiting cannot help here: one request every few minutes stays under any
    sane limit while holding a GPU warm indefinitely. The budget is what converts
    that from an unbounded liability into a known figure.
    """
    from app.main import app

    app.state.warm_state = WarmState(clock=fake_clock, monthly_budget=2)

    for _ in range(4):
        fake_clock.advance(WARM_DEDUPE_WINDOW_SECONDS + 1)
        await async_client.post("/api/warmup")

    assert mock_acestep_client.health_check.await_count == 2


@pytest.mark.asyncio
async def test_warmup_still_succeeds_once_the_budget_is_spent(
    async_client, mock_acestep_client, fake_clock
):
    """Exhausting the budget degrades the site to cold starts, it does not break it."""
    from app.main import app

    app.state.warm_state = WarmState(clock=fake_clock, monthly_budget=1)

    await async_client.post("/api/warmup")
    fake_clock.advance(WARM_DEDUPE_WINDOW_SECONDS + 1)
    response = await async_client.post("/api/warmup")

    assert response.status_code == 200
    assert response.json()["warm"] is False


@pytest.mark.asyncio
async def test_the_warm_budget_refills_the_following_month(
    async_client, mock_acestep_client, fake_clock
):
    """A spent budget must not disable prewarm permanently."""
    from app.main import app

    app.state.warm_state = WarmState(clock=fake_clock, monthly_budget=1)

    await async_client.post("/api/warmup")
    fake_clock.advance(31 * 24 * 60 * 60)
    await async_client.post("/api/warmup")

    assert mock_acestep_client.health_check.await_count == 2
