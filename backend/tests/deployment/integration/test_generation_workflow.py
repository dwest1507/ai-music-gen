"""
Integration tests for the complete music generation workflow.

⚠️ WARNING: These tests consume Modal GPU credits!
Run sparingly and use short durations (30s) to minimize costs.
"""
import pytest
import requests
import time


@pytest.mark.slow
@pytest.mark.expensive
@pytest.mark.integration
def test_complete_generation_workflow(api_url, session, test_prompt, test_duration, cleanup_jobs):
    """
    Test the complete workflow: submit job → poll status → download audio.
    
    This is an end-to-end test that verifies the entire system works together.
    """
    # 1. Submit generation job
    response = session.post(
        f"{api_url}/api/generate",
        json={
            "prompt": test_prompt,
            "duration": test_duration,
            "genre": "test"
        }
    )
    
    assert response.status_code == 202, f"Job submission failed with {response.status_code}"
    
    job_data = response.json()
    assert "job_id" in job_data, "Response missing job_id"
    assert job_data["status"] == "queued", f"Expected queued status, got {job_data['status']}"
    
    job_id = job_data["job_id"]
    cleanup_jobs.append(job_id)
    
    print(f"\n✓ Job submitted: {job_id}")
    
    # 2. Poll for completion
    max_wait_time = 180  # 3 minutes max
    poll_interval = 5  # Check every 5 seconds
    start_time = time.time()
    
    final_status = None
    
    while time.time() - start_time < max_wait_time:
        response = session.get(f"{api_url}/api/jobs/{job_id}")
        
        assert response.status_code == 200, f"Status check failed with {response.status_code}"
        
        status_data = response.json()
        final_status = status_data["status"]
        
        print(f"  Status: {final_status} (elapsed: {int(time.time() - start_time)}s)")
        
        if final_status == "finished":
            assert "audio_url" in status_data, "Finished job missing audio_url"
            print(f"✓ Job completed in {int(time.time() - start_time)}s")
            break
        elif final_status == "failed":
            error = status_data.get("error", "Unknown error")
            pytest.fail(f"Job failed: {error}")
        
        time.sleep(poll_interval)
    
    assert final_status == "finished", \
        f"Job did not complete in {max_wait_time}s (final status: {final_status})"
    
    # 3. Download audio
    response = session.get(f"{api_url}/api/audio/{job_id}")
    
    assert response.status_code == 200, f"Audio download failed with {response.status_code}"
    assert response.headers.get("content-type") == "audio/wav", \
        f"Expected audio/wav, got {response.headers.get('content-type')}"
    
    audio_data = response.content
    assert len(audio_data) > 0, "Audio file is empty"
    assert len(audio_data) > 1000, "Audio file suspiciously small"
    
    # Verify WAV header (starts with "RIFF")
    assert audio_data[:4] == b"RIFF", "Invalid WAV file header"
    
    print(f"✓ Audio downloaded: {len(audio_data)} bytes")
    print(f"\n✅ Complete workflow test passed!")

# WARNING: These tests consume Modal GPU credits!
# They are commented out by default.
# Do not uncomment them unless you get explicit permission from the owner.
# @pytest.mark.slow
# @pytest.mark.expensive
# @pytest.mark.integration
# def test_generation_with_genre(api_url, session, cleanup_jobs):
#     """Test generation with genre parameter."""
#     response = session.post(
#         f"{api_url}/api/generate",
#         json={
#             "prompt": "Upbeat melody",
#             "duration": 30,
#             "genre": "jazz"
#         }
#     )
    
#     assert response.status_code == 202
#     job_id = response.json()["job_id"]
#     cleanup_jobs.append(job_id)
    
#     # Just verify the job was accepted
#     # We won't wait for completion to save time/money
#     print(f"\n✓ Job with genre accepted: {job_id}")


# @pytest.mark.slow
# @pytest.mark.expensive
# @pytest.mark.integration
# def test_generation_different_durations(api_url, session, cleanup_jobs):
#     """Test that different durations are accepted (without waiting for completion)."""
#     durations = [30, 60, 120]
    
#     for duration in durations:
#         response = session.post(
#             f"{api_url}/api/generate",
#             json={
#                 "prompt": f"Test music {duration}s",
#                 "duration": duration
#             }
#         )
        
#         assert response.status_code == 202, \
#             f"Duration {duration} failed with {response.status_code}"
        
#         job_id = response.json()["job_id"]
#         cleanup_jobs.append(job_id)
        
#         print(f"✓ Job accepted for {duration}s duration: {job_id}")


# @pytest.mark.slow
# @pytest.mark.integration
# def test_job_status_fields(api_url, session, test_prompt, cleanup_jobs):
#     """Verify job status response contains all expected fields."""
#     # Submit a job
#     response = session.post(
#         f"{api_url}/api/generate",
#         json={"prompt": test_prompt, "duration": 30}
#     )
    
#     job_id = response.json()["job_id"]
#     cleanup_jobs.append(job_id)
    
#     # Check status immediately
#     response = session.get(f"{api_url}/api/jobs/{job_id}")
    
#     assert response.status_code == 200
    
#     data = response.json()
    
#     # Verify required fields
#     assert "job_id" in data
#     assert "status" in data
#     assert "created_at" in data
#     assert "enqueued_at" in data
    
#     # Status should be one of the valid values
#     assert data["status"] in ["queued", "started", "finished", "failed"]
    
#     print(f"\n✓ Job status response valid: {data}")
