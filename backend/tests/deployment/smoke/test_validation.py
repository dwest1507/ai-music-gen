"""
Smoke tests for input validation.

These tests verify the API properly validates inputs without actually processing jobs.
"""
import pytest
import requests


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_missing_prompt(api_url, session):
    """Verify API rejects requests without prompt."""
    response = session.post(
        f"{api_url}/api/generate",
        json={"duration": 60}
    )
    
    assert response.status_code == 422, f"Expected 422 for missing prompt, got {response.status_code}"


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_prompt_too_long(api_url, session):
    """Verify API rejects prompts exceeding max length."""
    long_prompt = "a" * 501  # Max is 500
    
    response = session.post(
        f"{api_url}/api/generate",
        json={"prompt": long_prompt, "duration": 60}
    )
    
    assert response.status_code == 422, f"Expected 422 for long prompt, got {response.status_code}"


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_invalid_duration(api_url, session):
    """Verify API rejects invalid durations."""
    # Test duration too short
    response = session.post(
        f"{api_url}/api/generate",
        json={"prompt": "test", "duration": 10}
    )
    assert response.status_code == 422, f"Expected 422 for duration < 30, got {response.status_code}"
    
    # Test duration too long
    response = session.post(
        f"{api_url}/api/generate",
        json={"prompt": "test", "duration": 200}
    )
    assert response.status_code == 422, f"Expected 422 for duration > 120, got {response.status_code}"


# @pytest.mark.fast
# @pytest.mark.smoke
# def test_generate_valid_durations(api_url, session):
#     """Verify API accepts valid durations (30, 60, 120)."""
#     # Note: This will create actual jobs, but we're just checking they're accepted
#     # We won't wait for them to complete
    
#     valid_durations = [30, 60, 120]
    
#     for duration in valid_durations:
#         response = session.post(
#             f"{api_url}/api/generate",
#             json={"prompt": "test", "duration": duration}
#         )
        
#         # Should be accepted (202) or rate limited (429), not validation error (422)
#         assert response.status_code in [202, 429], \
#             f"Duration {duration} should be valid, got {response.status_code}"


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_empty_prompt(api_url, session):
    """Verify API rejects empty prompts."""
    response = session.post(
        f"{api_url}/api/generate",
        json={"prompt": "", "duration": 60}
    )
    
    # Should reject empty prompt
    assert response.status_code == 422, f"Expected 422 for empty prompt, got {response.status_code}"


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_whitespace_prompt(api_url, session):
    """Verify API rejects whitespace-only prompts."""
    response = session.post(
        f"{api_url}/api/generate",
        json={"prompt": "   ", "duration": 60}
    )
    
    # Should reject whitespace-only prompt
    assert response.status_code == 422, \
        f"Expected 422 for whitespace prompt, got {response.status_code}"


@pytest.mark.fast
@pytest.mark.smoke
def test_generate_invalid_json(api_url, session):
    """Verify API rejects malformed JSON."""
    response = session.post(
        f"{api_url}/api/generate",
        data="this is not json",
        headers={"Content-Type": "application/json"}
    )
    
    assert response.status_code == 422, f"Expected 422 for invalid JSON, got {response.status_code}"
