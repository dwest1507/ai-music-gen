"""Behaviour of POST /api/warmup — the GPU prewarm endpoint.

The endpoint exists so that Modal wake overlaps the time a visitor spends reading
the page and filling the form, instead of starting when they click Generate.
See SPEC.md FR-16 and ADR 0001.
"""

import pytest

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
