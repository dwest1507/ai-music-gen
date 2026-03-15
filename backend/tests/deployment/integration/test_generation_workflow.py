"""
Integration tests for the complete music generation workflow.

⚠️ WARNING: These tests consume Modal GPU credits!
Run sparingly and use short durations (10s) to minimize costs.
"""

import pytest
import time


@pytest.mark.slow
@pytest.mark.expensive
@pytest.mark.integration
def test_complete_generation_workflow(api_url, session, test_prompt, cleanup_jobs):
    """
    Test the complete workflow: submit job → poll status → download audio.

    This is an end-to-end test that verifies the entire system works together.
    """
    # 1. Submit generation job
    response = session.post(
        f"{api_url}/api/generate",
        json={
            "prompt": test_prompt,
            "duration": 10,  # Short duration for testing
            "genre": "test",
        },
    )

    assert response.status_code == 202, (
        f"Job submission failed with {response.status_code}"
    )

    job_data = response.json()
    assert "task_id" in job_data, "Response missing task_id"
    assert job_data["status"] == "queued", (
        f"Expected queued status, got {job_data['status']}"
    )

    job_id = job_data["task_id"]
    cleanup_jobs.append(job_id)

    print(f"\n✓ Task submitted: {job_id}")

    # 2. Poll for completion
    max_wait_time = 180  # 3 minutes max
    poll_interval = 5  # Check every 5 seconds
    start_time = time.time()

    final_status = None

    while time.time() - start_time < max_wait_time:
        response = session.get(f"{api_url}/api/jobs/{job_id}")

        assert response.status_code == 200, (
            f"Status check failed with {response.status_code}"
        )

        status_data = response.json()
        final_status = status_data["status"]

        print(f"  Status: {final_status} (elapsed: {int(time.time() - start_time)}s)")

        if final_status == "completed":
            assert "audio_url" in status_data, "Completed job missing audio_url"
            print(f"✓ Task completed in {int(time.time() - start_time)}s")

            # 3. Download audio
            audio_url_path = status_data["audio_url"]
            print(f"  Downloading from internal proxy path: {audio_url_path}")

            audio_response = session.get(f"{api_url}{audio_url_path}")

            assert audio_response.status_code == 200, (
                f"Audio download failed with {audio_response.status_code}"
            )

            audio_data = audio_response.content
            assert len(audio_data) > 0, "Audio file is empty"
            assert len(audio_data) > 1000, "Audio file suspiciously small"

            # Since the API often returns MP3s now, we skip the hardcoded RIFF WAV check
            # and verify the headers indicate an audio file
            content_type = audio_response.headers.get("content-type", "")
            assert content_type.startswith("audio/"), (
                f"Expected audio content type, got {content_type}"
            )

            print(f"✓ Audio downloaded: {len(audio_data)} bytes")
            print("\n✅ Complete workflow test passed!")
            break

        elif final_status == "failed":
            error = status_data.get("error", "Unknown error")
            pytest.fail(f"Job failed: {error}")

        time.sleep(poll_interval)

    assert final_status == "completed", (
        f"Job did not complete in {max_wait_time}s (final status: {final_status})"
    )
