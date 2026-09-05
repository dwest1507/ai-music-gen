"""The rate limiter must key on something the caller cannot choose.

An earlier revision keyed on the `session_id` cookie. It is generated with
`secrets.token_urlsafe`, but the client supplies it on every request, so rotating
the value minted a fresh budget each time — leaving the two endpoints that cost
money effectively unlimited. See SPEC.md section 8.1.
"""

from pathlib import Path

import pytest
from uvicorn.middleware.proxy_headers import _TrustedHosts


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


def _configured_trusted_hosts() -> list[str]:
    """The proxy ranges the deployed container actually runs with.

    Read out of the Dockerfile rather than restated here, because the value that
    matters is the one shipped. A test asserting against its own copy would still
    pass with `*` back in the CMD.
    """
    dockerfile = Path(__file__).parents[3] / "Dockerfile"
    for line in dockerfile.read_text().splitlines():
        if line.startswith("ENV FORWARDED_ALLOW_IPS="):
            return line.split("=", 1)[1].strip().strip('"').split(",")
    raise AssertionError("Dockerfile does not set FORWARDED_ALLOW_IPS")


def test_the_deployed_proxy_config_ignores_a_client_supplied_forwarded_for():
    """The IP the limiter keys on must be the proxy's word, not the caller's.

    Railway appends to X-Forwarded-For rather than replacing it, and uvicorn under
    `--forwarded-allow-ips "*"` reads the *leftmost* entry — so a client-sent header
    would become the rate-limit key and rotating it would mint a fresh allowance per
    request, exactly the bypass moving the key off the session cookie closed. Given
    explicit ranges uvicorn walks from the right instead and stops at the first
    address outside them: the one Railway appended.
    """
    trusted = _TrustedHosts(_configured_trusted_hosts())
    real_client = "203.0.113.9"

    spoofed = f"1.2.3.4, {real_client}"
    padded = f"9.9.9.9, 10.1.2.3, {real_client}"

    assert trusted.get_trusted_client_address(spoofed)[0] == real_client
    assert trusted.get_trusted_client_address(padded)[0] == real_client
    assert trusted.get_trusted_client_address(real_client)[0] == real_client
