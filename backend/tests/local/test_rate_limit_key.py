"""The rate limiter must key on something the caller cannot choose.

An earlier revision keyed on the `session_id` cookie. It is generated with
`secrets.token_urlsafe`, but the client supplies it on every request, so rotating
the value minted a fresh budget each time — leaving the two endpoints that cost
money effectively unlimited. See SPEC.md section 8.1.
"""

import pytest


@pytest.mark.asyncio
async def test_rotating_the_session_cookie_does_not_grant_a_fresh_budget(async_client):
    """Ten warmups exhaust the 10/min allowance however the cookie is varied."""
    for attempt in range(10):
        await async_client.post(
            "/api/warmup", headers={"Cookie": f"session_id=rotated-{attempt}"}
        )

    refused = await async_client.post(
        "/api/warmup", headers={"Cookie": "session_id=rotated-again"}
    )

    assert refused.status_code == 429


@pytest.mark.asyncio
async def test_rotating_the_session_cookie_does_not_grant_a_fresh_generate_budget(
    async_client, mock_acestep_client
):
    """The same bypass applied to generation, which starts real GPU inference."""
    mock_acestep_client.submit_task.return_value = {"task_id": "t"}
    payload = {"prompt": "a test prompt"}

    for attempt in range(5):
        await async_client.post(
            "/api/generate", json=payload, headers={"Cookie": f"session_id=r-{attempt}"}
        )

    refused = await async_client.post(
        "/api/generate", json=payload, headers={"Cookie": "session_id=r-final"}
    )

    assert refused.status_code == 429
