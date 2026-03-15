"""
Security tests for rate limiting.

These tests verify that rate limiting is properly enforced.
"""

import pytest


@pytest.mark.fast
@pytest.mark.security
def test_rate_limiting_enforced(api_url, session, test_prompt):
    """
    Verify that rate limiting is enforced.

    Note: This test makes 6 requests rapidly.
    The limit is 5/minute according to limtier config.
    """
    # Make 6 requests rapidly
    responses = []

    for i in range(6):
        response = session.post(
            f"{api_url}/api/generate",
            json={"prompt": f"{test_prompt} {i}", "duration": 10},
        )
        responses.append(response)
        print(f"  Request {i + 1}: {response.status_code}")

    # Count successful (202) and rate-limited (429) responses
    successful = sum(1 for r in responses if r.status_code == 202)
    rate_limited = sum(1 for r in responses if r.status_code == 429)

    # At least some requests should succeed
    assert successful >= 2, f"Expected at least 2 requests to succeed, got {successful}"

    # At least some requests should be rate limited
    assert rate_limited >= 1, (
        f"Expected at least 1 request to be rate limited, got {rate_limited}"
    )

    # The last request should definitely be rate limited
    assert responses[-1].status_code == 429, (
        f"Expected last request to be rate limited (429), got {responses[-1].status_code}"
    )

    print(
        f"\n✓ Rate limiting enforced: {successful} succeeded, {rate_limited} rate-limited"
    )
