"""
Smoke tests for input validation.

These tests verify the API properly validates inputs without actually processing jobs.
"""

import pytest


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_missing_prompt(api_url, session):
    """Verify API rejects requests without prompt."""
    response = session.post(f"{api_url}/api/generate", json={"duration": 60})

    assert response.status_code == 422, (
        f"Expected 422 for missing prompt, got {response.status_code}"
    )


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_prompt_too_long(api_url, session):
    """Verify API rejects prompts exceeding max length."""
    long_prompt = "a" * 501  # Max is 500

    response = session.post(
        f"{api_url}/api/generate", json={"prompt": long_prompt, "duration": 60}
    )

    assert response.status_code == 422, (
        f"Expected 422 for long prompt, got {response.status_code}"
    )


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_invalid_duration(api_url, session):
    """Verify API rejects invalid durations."""
    # Test duration too short (< 10)
    response = session.post(
        f"{api_url}/api/generate", json={"prompt": "test", "duration": 5}
    )
    assert response.status_code == 422, (
        f"Expected 422 for duration < 10, got {response.status_code}"
    )

    # Test duration too long (> 600)
    response = session.post(
        f"{api_url}/api/generate", json={"prompt": "test", "duration": 700}
    )
    assert response.status_code == 422, (
        f"Expected 422 for duration > 600, got {response.status_code}"
    )


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_empty_prompt(api_url, session):
    """Verify API rejects empty prompts."""
    response = session.post(
        f"{api_url}/api/generate", json={"prompt": "", "duration": 60}
    )

    # Should reject empty prompt
    assert response.status_code == 422, (
        f"Expected 422 for empty prompt, got {response.status_code}"
    )


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_whitespace_prompt(api_url, session):
    """Verify API rejects whitespace-only prompts."""
    response = session.post(
        f"{api_url}/api/generate", json={"prompt": "   ", "duration": 60}
    )

    # Should reject whitespace-only prompt
    assert response.status_code == 422, (
        f"Expected 422 for whitespace prompt, got {response.status_code}"
    )


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_invalid_json(api_url, session):
    """Verify API rejects malformed JSON."""
    response = session.post(
        f"{api_url}/api/generate",
        content="this is not json",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 422, (
        f"Expected 422 for invalid JSON, got {response.status_code}"
    )
