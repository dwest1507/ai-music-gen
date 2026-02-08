import modal
import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Name of the Modal app and function to call
MODAL_APP_NAME = "music-gen-app"
MODAL_FUNCTION_NAME = "generate"

from rq import get_current_job

def generate_music_task(prompt: str, duration: int, genre: str):
    """
    Task to be executed by RQ worker.
    Calls Modal for inference and handles result storage.
    """
    job = get_current_job()
    job_id = job.id
    logger.info(f"Starting generation for job {job_id}")
    
    # Ensure audio directory exists (use /tmp for write permissions)
    output_dir = "/tmp/audio_temp"
    os.makedirs(output_dir, exist_ok=True)
    output_path = f"{output_dir}/{job_id}.wav"

    try:
        # Check for Modal credentials (basic check)
        if not settings.MODAL_TOKEN_ID or not settings.MODAL_TOKEN_SECRET:
            # Fallback for local testing without Modal
            logger.warning("Modal credentials missing. Using dummy generation for testing.")
            # Generate dummy audio file
            with open(output_path, "wb") as f:
                f.write(b"RIFF" + b"\x00" * 36) # valid-ish WAV header
            return {"status": "completed", "path": output_path, "mock": True}

        # Lookup the Modal function
        # This requires the Modal app to be deployed separately
        try:
            # New Modal API (v1.0+) uses from_name
            f = modal.Function.from_name(MODAL_APP_NAME, MODAL_FUNCTION_NAME)
        except Exception:
            try:
                # Fallback for older versions
                f = modal.Function.lookup(MODAL_APP_NAME, MODAL_FUNCTION_NAME)
            except Exception:
                 logger.error(f"Modal app '{MODAL_APP_NAME}' not found.")
                 raise Exception("Modal app not deployed. Please deploy the backend/modal_app.py first.")

        # Call the function remotely
        # The modal function is expected to return audio bytes
        # Call the function remotely
        # The modal function is expected to return audio bytes
        logger.info(f"Calling Modal function '{MODAL_FUNCTION_NAME}'...")
        audio_bytes = f.remote(prompt, duration, genre)
        
        # Save result locally (as backup/cache)
        with open(output_path, "wb") as f_out:
            f_out.write(audio_bytes)
            
        # Upload to Storage (R2/S3)
        from app.services.storage import storage_service
        storage_key = f"{job_id}.wav"
        
        result_data = {
            "status": "completed", 
            "path": output_path, # Keep local path for reference
        }
        
        if storage_service.enabled:
            logger.info(f"Uploading {storage_key} to storage...")
            success = storage_service.upload_file(audio_bytes, storage_key)
            if success:
                result_data["storage_key"] = storage_key
                result_data["storage_type"] = "s3"
            else:
                logger.error("Failed to upload to storage")
                # We don't fail the job if upload fails, but API might not be able to serve it if different node
        
        logger.info(f"Job {job_id} completed successfully.")
        return result_data
        
    except Exception as e:
        logger.exception(f"Job {job_id} failed: {e}")
        # RQ will catch this exception and mark job as failed
        raise e
