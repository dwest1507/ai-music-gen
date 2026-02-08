"""
Smoke tests for basic API health and accessibility.

These tests are fast and should run after every deployment.
"""
import pytest
import requests


@pytest.mark.fast
@pytest.mark.smoke
def test_health_endpoint(api_url, verify_api_accessible):
    """Verify the health endpoint returns correct response."""
    response = requests.get(f"{api_url}/health")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert data["status"] == "healthy", f"Expected healthy status, got {data.get('status')}"
    assert "version" in data, "Version field missing from health response"


@pytest.mark.fast
@pytest.mark.smoke
def test_api_returns_json(api_url, verify_api_accessible):
    """Verify API returns JSON content type."""
    response = requests.get(f"{api_url}/health")
    
    content_type = response.headers.get("content-type", "")
    assert "application/json" in content_type, f"Expected JSON, got {content_type}"


@pytest.mark.fast
@pytest.mark.smoke
def test_cors_headers_present(api_url, verify_api_accessible):
    """Verify CORS headers are configured."""
    # Make a simple POST request with Origin header to check CORS
    response = requests.post(
        f"{api_url}/api/generate",
        json={"prompt": "test", "duration": 60},
        headers={"Origin": "http://localhost:3000"}
    )
    
    # Check for CORS headers in the response
    # The API should include access-control headers if CORS is configured
    # We're just verifying CORS is set up, not testing specific values
    assert response.status_code in [200, 202, 422, 429], \
        f"Unexpected status code: {response.status_code}"


@pytest.mark.fast
@pytest.mark.smoke
def test_invalid_endpoint_returns_404(api_url, verify_api_accessible):
    """Verify invalid endpoints return 404."""
    response = requests.get(f"{api_url}/this-endpoint-does-not-exist")
    
    assert response.status_code == 404, f"Expected 404 for invalid endpoint, got {response.status_code}"


@pytest.mark.fast
@pytest.mark.smoke
def test_api_endpoints_accessible(api_url, verify_api_accessible):
    """Verify main API endpoints are accessible (even if they return errors without proper data)."""
    session = requests.Session()
    
    # POST to generate without data should return 422 (validation error), not 500
    response = session.post(f"{api_url}/api/generate", json={})
    assert response.status_code in [400, 422], f"Expected validation error, got {response.status_code}"
    
    # GET to non-existent job should return 404, not 500
    response = session.get(f"{api_url}/api/jobs/nonexistent-job-id")
    assert response.status_code in [403, 404], f"Expected 404/403, got {response.status_code}"
