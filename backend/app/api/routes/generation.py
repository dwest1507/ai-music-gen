from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import secrets
import logging

from app.core.config import settings
from app.core.limiter import limiter
from app.services.acestep_client import ACEStepClient, ACEStepError

# ── Pydantic models ──────────────────────────────────────────────


class GenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
    lyrics: str = Field("", max_length=5000)
    duration: float = Field(60, ge=10, le=600)
    genre: Optional[str] = None
    vocal_language: str = Field("en")
    audio_format: str = Field("mp3")
    thinking: bool = Field(True)
    use_format: bool = Field(False)
    bpm: Optional[int] = Field(None, ge=30, le=300)
    key_scale: Optional[str] = None
    time_signature: Optional[str] = None
    inference_steps: int = Field(8, ge=1, le=20)
    batch_size: int = Field(1, ge=1, le=4)

    @field_validator("prompt")
    @classmethod
    def validate_prompt_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Prompt cannot be empty or whitespace-only")
        return v.strip()

    @field_validator("audio_format")
    @classmethod
    def validate_audio_format(cls, v: str) -> str:
        allowed = {"mp3", "wav", "flac"}
        if v.lower() not in allowed:
            raise ValueError(f"audio_format must be one of {allowed}")
        return v.lower()


class GenerationResponse(BaseModel):
    task_id: str
    status: str
    queue_position: Optional[int] = None


class FormatRequest(BaseModel):
    prompt: Optional[str] = ""
    lyrics: Optional[str] = ""


class RandomSampleRequest(BaseModel):
    """Optional parameters for random sample generation."""
    sample_query: Optional[str] = ""


# ── Helpers ──────────────────────────────────────────────────────


def _get_client(request: Request) -> ACEStepClient:
    """Retrieve the ACE-Step client from app state."""
    return request.app.state.acestep_client


def get_session_id(request: Request, response: Response) -> str:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        session_id = secrets.token_urlsafe(32)
        is_secure = not settings.FRONTEND_URL.startswith("http://localhost")
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_id,
            httponly=True,
            secure=is_secure,
            samesite="lax",
        )
    return session_id


def _build_release_task_payload(gen_request: GenerationRequest) -> dict:
    """Transform a GenerationRequest into the ACE-Step /release_task payload."""
    prompt = gen_request.prompt
    if gen_request.genre:
        prompt = f"{gen_request.genre}. {prompt}"

    lyrics = gen_request.lyrics if gen_request.lyrics else "[Instrumental]"

    payload: dict = {
        "prompt": prompt,
        "lyrics": lyrics,
        "audio_duration": gen_request.duration,
        "thinking": gen_request.thinking,
        "vocal_language": gen_request.vocal_language,
        "audio_format": gen_request.audio_format,
        "use_format": gen_request.use_format,
        "inference_steps": gen_request.inference_steps,
        "batch_size": gen_request.batch_size,
    }

    if gen_request.bpm is not None:
        payload["bpm"] = gen_request.bpm
    if gen_request.key_scale:
        payload["key_scale"] = gen_request.key_scale
    if gen_request.time_signature:
        payload["time_signature"] = gen_request.time_signature

    return payload


# Status code mapping: ACE-Step → user-facing
_STATUS_MAP = {
    0: "processing",
    1: "completed",
    2: "failed",
}


# ── Routes ────────────────────────────────────────────────────────


@router.post("/generate", response_model=GenerationResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def submit_generation(
    request: Request,
    response: Response,
    gen_request: GenerationRequest,
):
    """Submit a music generation task to the ACE-Step API."""
    get_session_id(request, response)  # ensure session cookie is set

    payload = _build_release_task_payload(gen_request)
    client = _get_client(request)

    try:
        result = await client.submit_task(payload)
    except ACEStepError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    task_id = result.get("task_id", "")
    queue_position = result.get("queue_position")

    return GenerationResponse(
        task_id=task_id,
        status="queued",
        queue_position=queue_position,
    )


@router.get("/jobs/{task_id}")
@limiter.limit("60/minute")
async def get_job_status(task_id: str, request: Request, response: Response):
    """Query the status of a generation task."""
    get_session_id(request, response)
    client = _get_client(request)

    try:
        result = await client.query_result([task_id])
    except ACEStepError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    # result is a list of task statuses; we requested one
    tasks = result if isinstance(result, list) else [result]
    if not tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[0] if isinstance(tasks, list) else tasks
    status_code = task.get("status", 0)
    mapped_status = _STATUS_MAP.get(status_code, "processing")

    response_data: dict = {
        "task_id": task_id,
        "status": mapped_status,
    }

    if mapped_status == "completed":
        # Build audio proxy URLs from result file paths
        audio_files = task.get("file", [])
        if isinstance(audio_files, str):
            audio_files = [audio_files]

        if audio_files:
            response_data["audio_url"] = f"/api/audio/{task_id}?index=0"
            if len(audio_files) > 1:
                response_data["audio_urls"] = [
                    f"/api/audio/{task_id}?index={i}" for i in range(len(audio_files))
                ]

        # Include generation metadata if available
        metadata = {}
        for key in ("prompt", "lyrics", "bpm", "audio_duration", "key_scale", "time_signature"):
            if key in task:
                metadata[key] = task[key]
        if metadata:
            response_data["metadata"] = metadata

    elif mapped_status == "failed":
        response_data["error"] = task.get("error", "Generation failed")

    return response_data


from fastapi.responses import StreamingResponse

@router.get("/audio/{task_id}")
@limiter.limit("20/minute")
async def download_audio(
    task_id: str,
    request: Request,
    response: Response,
    index: int = Query(0, description="Index of the audio file to download", ge=0),
):
    """Proxy-download generated audio from the ACE-Step API via a stream."""
    get_session_id(request, response)
    client = _get_client(request)

    try:
        # Prevent SSRF: Lookup actual path using the task ID
        result = await client.query_result([task_id])
        tasks = result if isinstance(result, list) else [result]
        if not tasks:
            raise HTTPException(status_code=404, detail="Task not found")
        task = tasks[0] if isinstance(tasks, list) else tasks
        
        audio_files = task.get("file", [])
        if isinstance(audio_files, str):
            audio_files = [audio_files]
            
        if not audio_files or index >= len(audio_files):
            raise HTTPException(status_code=404, detail="Audio file not found")
            
        safe_path = audio_files[index]
        resp = await client.download_audio_stream(safe_path)
    except ACEStepError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    content_type = resp.headers.get("content-type", "audio/mpeg")

    # Determine file extension from content type
    ext_map = {
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/flac": "flac",
    }
    ext = ext_map.get(content_type, "mp3")
    filename = f"music_{task_id}.{ext}"

    async def stream_generator():
        try:
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await resp.aclose()

    return StreamingResponse(
        stream_generator(),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/models")
@limiter.limit("30/minute")
async def list_models(request: Request, response: Response):
    """List available DiT models from the ACE-Step API."""
    get_session_id(request, response)
    client = _get_client(request)
    try:
        return await client.list_models()
    except ACEStepError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/random-sample")
@limiter.limit("10/minute")
async def random_sample(request: Request, response: Response, body: RandomSampleRequest = RandomSampleRequest()):
    """Get random example generation parameters from the ACE-Step API."""
    get_session_id(request, response)
    client = _get_client(request)
    try:
        params = {"sample_query": body.sample_query} if body.sample_query else {}
        return await client.get_random_sample(params)
    except ACEStepError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/format")
@limiter.limit("10/minute")
async def format_input(request: Request, response: Response, body: FormatRequest):
    """LM-format prompt and/or lyrics via the ACE-Step API."""
    get_session_id(request, response)
    client = _get_client(request)
    try:
        return await client.format_input(body.model_dump())
    except ACEStepError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.delete("/jobs/{task_id}", status_code=204)
@limiter.limit("30/minute")
async def cancel_job(task_id: str, request: Request, response: Response):
    """
    Cancel / discard a generation task locally.

    The ACE-Step API does not have a cancel endpoint, so this is a no-op
    upstream. It can be extended later to track cancelled task IDs locally.
    """
    # No upstream cancel available; return success
    return Response(status_code=204)
