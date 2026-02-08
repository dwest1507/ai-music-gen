from fastapi import APIRouter, HTTPException, Request, Response, status, Depends
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import secrets
import logging
from app.services.job_queue import job_queue
from app.services.modal_client import generate_music_task
from app.core.limiter import limiter

router = APIRouter()
logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = "session_id"

class GenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
    duration: int = Field(60, ge=30, le=120)  # 30, 60, 120
    genre: Optional[str] = None
    
    @field_validator('prompt')
    @classmethod
    def validate_prompt_not_empty(cls, v: str) -> str:
        """Ensure prompt is not empty or whitespace-only."""
        if not v or not v.strip():
            raise ValueError('Prompt cannot be empty or whitespace-only')
        return v.strip()  # Return trimmed prompt

class JobResponse(BaseModel):
    job_id: str
    status: str
    estimated_wait: int

def get_session_id(request: Request, response: Response) -> str:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        session_id = secrets.token_urlsafe(32)
        # Set strictly for subsequent requests, 
        # but return it here so current request context has it
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_id,
            httponly=True,
            secure=True, # Should be True in prod (HTTPS)
            samesite="lax"
        )
    return session_id

@router.post("/generate", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def submit_generation_job(
    request: Request, 
    response: Response,
    gen_request: GenerationRequest
):
    """
    Submit a music generation job.
    """
    session_id = get_session_id(request, response)
    
    # Generate job ID explicitly to ensure consistency
    custom_job_id = secrets.token_urlsafe(16)
    
    # Enqueue job
    job = job_queue.enqueue_job(
        generate_music_task,
        job_id=custom_job_id,
        prompt=gen_request.prompt,
        duration=gen_request.duration,
        genre=gen_request.genre
    )
    
    # Store session ID in job metadata
    job.meta["session_id"] = session_id
    job.save_meta()
    
    return {
        "job_id": job.id,
        "status": "queued",
        "estimated_wait": 30 # Rough estimate
    }

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, request: Request):
    """
    Get the status of a specific job.
    """
    session_id = request.cookies.get(SESSION_COOKIE_NAME) # Don't create new if missing
    
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Verify ownership
    if job.meta.get("session_id") != session_id:
        # For security, return 404 or 403. 404 prevents enumeration?
        # 403 is clearer.
        raise HTTPException(status_code=403, detail="Unauthorized access to job")
        
    response = {
        "job_id": job.id,
        "status": job.get_status(),
        "created_at": job.created_at,
        "enqueued_at": job.enqueued_at,
        "error": job.exc_info, # Might expose stack trace? Simplify.
    }
    
    if job.get_status() == "failed":
        response["error"] = "Generation failed" # Generic message
        
    if job.is_finished:
        # result is whatever task returned
        result = job.result
        if result and result.get("path"):
            response["audio_url"] = f"/api/audio/{job_id}"
            
    return response

@router.get("/audio/{job_id}")
async def download_audio(job_id: str, request: Request):
    """
    Download the generated audio file.
    """
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.meta.get("session_id") != session_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if not job.is_finished:
         raise HTTPException(status_code=400, detail="Job not completed")
         
    # Check if file exists
    # We need path. Task returns path.
    result = job.result
    
    # Try Storage First
    if result and "storage_key" in result:
        storage_key = result["storage_key"]
        from app.services.storage import storage_service
        url = storage_service.generate_presigned_url(storage_key)
        if url:
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url)
            
    # Fallback to local file (only works if API and Worker are same machine)
    if not result or not result.get("path"):
         raise HTTPException(status_code=500, detail="Audio file missing")
         
    file_path = result["path"]
    import os
    if not os.path.exists(file_path):
         raise HTTPException(status_code=404, detail="Audio file not found on server")
         
    return FileResponse(file_path, media_type="audio/wav", filename=f"music_{job_id}.wav")

@router.delete("/jobs/{job_id}", status_code=204)
async def cancel_job(job_id: str, request: Request):
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.meta.get("session_id") != session_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if job.is_started or job.is_finished:
        raise HTTPException(status_code=409, detail="Cannot cancel started or completed job")
        
    job_queue.cancel_job(job_id)
    return Response(status_code=204)
