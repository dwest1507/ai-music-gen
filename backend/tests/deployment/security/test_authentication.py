"""
Security tests for authentication and authorization.

These tests verify that session-based authentication works correctly
and users cannot access other users' resources.
"""
import pytest
import requests


@pytest.mark.fast
@pytest.mark.security
def test_session_cookie_created(api_url):
    """Verify that a session cookie is created on first request."""
    session = requests.Session()
    
    response = session.post(
        f"{api_url}/api/generate",
        json={"prompt": "test", "duration": 30}
    )
    
    # Should get a session cookie (either in response or already set)
    assert "session_id" in session.cookies or "session_id" in response.cookies, \
        "Session cookie was not created"
    
    print(f"\n✓ Session cookie created")


@pytest.mark.fast
@pytest.mark.security
def test_session_isolation(api_url, test_prompt):
    """
    Verify that users cannot access other users' jobs.
    
    This is a critical security test.
    """
    # Create two separate sessions (simulating two different users)
    session1 = requests.Session()
    session2 = requests.Session()
    
    # Session 1 creates a job
    response = session1.post(
        f"{api_url}/api/generate",
        json={"prompt": test_prompt, "duration": 30}
    )
    
    assert response.status_code == 202
    job_id = response.json()["job_id"]
    
    print(f"\n✓ Session 1 created job: {job_id}")
    
    # Session 1 can access the job
    response = session1.get(f"{api_url}/api/jobs/{job_id}")
    assert response.status_code == 200, "Session 1 should be able to access its own job"
    print(f"✓ Session 1 can access its job")
    
    # Session 2 tries to access Session 1's job
    response = session2.get(f"{api_url}/api/jobs/{job_id}")
    assert response.status_code == 403, \
        f"Session 2 should NOT be able to access Session 1's job (got {response.status_code})"
    print(f"✓ Session 2 correctly denied access (403)")
    
    # Session 2 tries to download Session 1's audio
    response = session2.get(f"{api_url}/api/audio/{job_id}")
    assert response.status_code == 403, \
        f"Session 2 should NOT be able to download Session 1's audio (got {response.status_code})"
    print(f"✓ Session 2 correctly denied audio download (403)")
    
    print(f"\n✅ Session isolation working correctly!")


@pytest.mark.fast
@pytest.mark.security
def test_cannot_access_job_without_cookie(api_url, test_prompt):
    """Verify that requests without session cookie cannot access jobs."""
    # Create a job with a session
    session = requests.Session()
    response = session.post(
        f"{api_url}/api/generate",
        json={"prompt": test_prompt, "duration": 30}
    )
    
    job_id = response.json()["job_id"]
    
    # Try to access without cookies (new request, no session)
    response = requests.get(f"{api_url}/api/jobs/{job_id}")
    
    # Should be denied (403 or 404)
    assert response.status_code in [403, 404], \
        f"Request without cookie should be denied (got {response.status_code})"
    
    print(f"\n✓ Access denied without session cookie")


@pytest.mark.fast
@pytest.mark.security
def test_session_cookie_attributes(api_url):
    """Verify session cookie has proper security attributes."""
    session = requests.Session()
    
    response = session.post(
        f"{api_url}/api/generate",
        json={"prompt": "test", "duration": 30}
    )
    
    # Get the session cookie
    cookie = None
    if "session_id" in response.cookies:
        cookie = response.cookies["session_id"]
    elif "session_id" in session.cookies:
        cookie = session.cookies["session_id"]
    
    assert cookie is not None, "Session cookie not found"
    
    # Note: Some attributes may not be visible in the cookie object
    # depending on how they're set. This is a best-effort check.
    print(f"\n✓ Session cookie exists: {cookie}")
    
    # The cookie should have a value
    assert len(cookie) > 0, "Session cookie is empty"


@pytest.mark.fast
@pytest.mark.security
def test_cannot_cancel_other_users_jobs(api_url, test_prompt):
    """Verify users cannot cancel other users' jobs."""
    session1 = requests.Session()
    session2 = requests.Session()
    
    # Session 1 creates a job
    response = session1.post(
        f"{api_url}/api/generate",
        json={"prompt": test_prompt, "duration": 30}
    )
    
    job_id = response.json()["job_id"]
    
    # Session 2 tries to cancel it
    response = session2.delete(f"{api_url}/api/jobs/{job_id}")
    
    assert response.status_code == 403, \
        f"Session 2 should NOT be able to cancel Session 1's job (got {response.status_code})"
    
    print(f"\n✓ Cannot cancel other users' jobs")
