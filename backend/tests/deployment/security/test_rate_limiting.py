"""
Security tests for rate limiting.

These tests verify that rate limiting is properly enforced.
"""
import pytest
import requests
import time


@pytest.mark.fast
@pytest.mark.security
def test_rate_limiting_enforced(api_url, session, test_prompt):
    """
    Verify that rate limiting is enforced.
    
    Note: This test makes 6 requests rapidly.
    The exact limit may vary (3-5 requests) depending on timing and previous requests.
    """
    # Make 6 requests rapidly
    responses = []
    
    for i in range(6):
        response = session.post(
            f"{api_url}/api/generate",
            json={"prompt": f"{test_prompt} {i}", "duration": 30}
        )
        responses.append(response)
        print(f"  Request {i+1}: {response.status_code}")
    
    # Count successful (202) and rate-limited (429) responses
    successful = sum(1 for r in responses if r.status_code == 202)
    rate_limited = sum(1 for r in responses if r.status_code == 429)
    
    # At least some requests should succeed
    assert successful >= 2, \
        f"Expected at least 2 requests to succeed, got {successful}"
    
    # At least some requests should be rate limited
    assert rate_limited >= 1, \
        f"Expected at least 1 request to be rate limited, got {rate_limited}"
    
    # The last request should definitely be rate limited
    assert responses[-1].status_code == 429, \
        f"Expected last request to be rate limited (429), got {responses[-1].status_code}"
    
    print(f"\n✓ Rate limiting enforced: {successful} succeeded, {rate_limited} rate-limited")

# DO NOT UNCOMMENT THESE TESTS
# They are commented out by default.
# Only uncomment them if you get explicit permission from the owner.
# @pytest.mark.slow
# @pytest.mark.security
# def test_rate_limit_resets(api_url, test_prompt):
#     """
#     Verify that rate limit resets after the time window.
    
#     This test takes ~60 seconds to run.
#     """
#     session = requests.Session()
    
#     # Make 5 requests to hit the limit
#     for i in range(5):
#         response = session.post(
#             f"{api_url}/api/generate",
#             json={"prompt": f"{test_prompt} {i}", "duration": 30}
#         )
#         assert response.status_code == 202, f"Request {i+1} should succeed"
    
#     print(f"\n✓ Made 5 requests successfully")
    
#     # 6th request should be rate limited
#     response = session.post(
#         f"{api_url}/api/generate",
#         json={"prompt": test_prompt, "duration": 30}
#     )
#     assert response.status_code == 429, "6th request should be rate limited"
#     print(f"✓ 6th request rate limited (429)")
    
#     # Wait for rate limit to reset (60 seconds + buffer)
#     print(f"⏳ Waiting 65 seconds for rate limit to reset...")
#     time.sleep(65)
    
#     # Should be able to make requests again
#     response = session.post(
#         f"{api_url}/api/generate",
#         json={"prompt": test_prompt, "duration": 30}
#     )
#     assert response.status_code == 202, \
#         f"Request after reset should succeed, got {response.status_code}"
    
#     print(f"✓ Rate limit reset successfully")


# @pytest.mark.fast
# @pytest.mark.security
# def test_rate_limit_per_session(api_url, test_prompt):
#     """Verify that rate limits are per-session (not global)."""
#     session1 = requests.Session()
#     session2 = requests.Session()
    
#     # Session 1 makes 5 requests
#     for i in range(5):
#         response = session1.post(
#             f"{api_url}/api/generate",
#             json={"prompt": f"{test_prompt} session1 {i}", "duration": 30}
#         )
#         assert response.status_code == 202
    
#     print(f"\n✓ Session 1 made 5 requests")
    
#     # Session 1's 6th request should be rate limited
#     response = session1.post(
#         f"{api_url}/api/generate",
#         json={"prompt": test_prompt, "duration": 30}
#     )
#     assert response.status_code == 429, "Session 1 should be rate limited"
#     print(f"✓ Session 1 rate limited")
    
#     # Session 2 should still be able to make requests
#     response = session2.post(
#         f"{api_url}/api/generate",
#         json={"prompt": test_prompt, "duration": 30}
#     )
#     assert response.status_code == 202, \
#         f"Session 2 should NOT be rate limited (got {response.status_code})"
    
#     print(f"✓ Session 2 can still make requests (rate limits are per-session)")


# @pytest.mark.fast
# @pytest.mark.security
# def test_rate_limit_response_format(api_url, session, test_prompt):
#     """Verify that rate limit error response has proper format."""
#     # Hit the rate limit
#     for i in range(6):
#         response = session.post(
#             f"{api_url}/api/generate",
#             json={"prompt": f"{test_prompt} {i}", "duration": 30}
#         )
    
#     # The last response should be rate limited
#     assert response.status_code == 429
    
#     # Check response format
#     # SlowAPI typically returns a plain text response
#     # but we should at least verify it's not a 500 error
#     assert response.text is not None, "Rate limit response should have a body"
    
#     print(f"\n✓ Rate limit response: {response.text[:100]}")
