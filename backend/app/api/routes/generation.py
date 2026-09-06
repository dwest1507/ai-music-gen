from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import json
import logging
import re
import secrets
import random
from pathlib import Path
from app.core.config import settings
from app.core.limiter import limiter
from app.services.acestep_client import ACEStepClient, ACEStepError

logger = logging.getLogger(__name__)

router = APIRouter()
SESSION_COOKIE_NAME = "session_id"

# Path to the examples directory relative to this file
# backend/app/api/routes/generation.py -> backend/app/api/routes -> backend/app/api -> backend/app -> backend -> project_root
EXAMPLES_ROOT = Path(__file__).parent.parent.parent.parent / "examples"

# Language codes the form's selector offers. Used to normalise example files onto
# a value the form can display; the code itself is what upstream is conditioned on.
_VOCAL_LANGUAGE_NAMES: dict[str, str] = {
    "bn": "Bengali",
    "zh": "Chinese",
    "en": "English",
    "fr": "French",
    "de": "German",
    "he": "Hebrew",
    "hu": "Hungarian",
    "ja": "Japanese",
    "ko": "Korean",
    "ms": "Malay",
    "pl": "Polish",
    "pt": "Portuguese",
    "es": "Spanish",
}

# ── Pydantic models ──────────────────────────────────────────────


class GenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)
    # What the song is *about*. Kept out of `prompt` because an ACE-Step caption is a
    # style description (instrumentation, timbre, mix, mood) — subject matter placed
    # there has no channel to the vocals. See SPEC.md FR-20.
    topic: str = Field("", max_length=1000)
    lyrics: str = Field("", max_length=5000)
    duration: Optional[float] = Field(None, ge=10, le=300)
    genre: Optional[str] = None
    vocal_language: str = Field("en")
    audio_format: str = Field("mp3")
    thinking: bool = Field(True)
    instrumental: bool = Field(False)
    # Off by default: upstream replaces the DiT caption with the LM's own CoT caption
    # when this is set, discarding what the visitor asked for. Exposed as a field so the
    # LM-expansion behaviour stays A/B-testable without a redeploy. See SPEC.md §8.1.
    use_cot_caption: bool = Field(False)
    # Off by default: upstream never forwards `vocal_language` into the LM's CoT phase,
    # so leaving this on lets the LM pick its own language for the audio semantic codes
    # while the DiT is conditioned on the user's choice. See SPEC.md FR-22.
    use_cot_language: bool = Field(False)
    lm_temperature: float = Field(0.7, ge=0.0, le=2.0)
    bpm: Optional[int] = Field(None, ge=30, le=300)
    key_scale: Optional[str] = None
    time_signature: Optional[str] = None
    inference_steps: int = Field(8, ge=1, le=20)
    batch_size: int = Field(1, ge=1, le=4)
    infer_method: str = Field("ode")

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

    @field_validator("infer_method")
    @classmethod
    def validate_infer_method(cls, v: str) -> str:
        allowed = {"ode", "sde"}
        if v.lower() not in allowed:
            raise ValueError(f"infer_method must be one of {allowed}")
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


class ExampleResponse(BaseModel):
    prompt: str
    lyrics: str = ""
    vocal_language: str = "en"
    instrumental: bool = False


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


def _normalize_language(value: Optional[str]) -> str:
    """Map an example's language field onto a code the form's selector offers."""
    if not value or value not in _VOCAL_LANGUAGE_NAMES:
        return "en"
    return value


# Words that make upstream's `parse_description_hints` classify a sample query as
# instrumental (see acestep/api/server_utils.py). A style description that merely
# mentions an instrumental passage would otherwise suppress the vocals entirely, so
# these are neutralised in `sample_query` when the visitor has not asked for
# instrumental. The explicit checkbox stays the only way to get no vocals.
_INSTRUMENTAL_HINT_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\binstrumental\b", re.IGNORECASE),
    re.compile(r"\bpure music\b", re.IGNORECASE),
    re.compile(r"\bpure instrument\b", re.IGNORECASE),
    re.compile(r"\s+solo\s*$", re.IGNORECASE),
)


def _strip_instrumental_hints(query: str) -> str:
    """Remove wording that would make upstream suppress vocals for a sung request."""
    for pattern in _INSTRUMENTAL_HINT_PATTERNS:
        query = pattern.sub(" ", query)
    return re.sub(r"\s{2,}", " ", query).strip()


def _build_release_task_payload(gen_request: GenerationRequest) -> dict:
    """Transform a GenerationRequest into the ACE-Step /release_task payload.

    Two channels, deliberately kept apart: `prompt` carries musical style and
    `sample_query` carries subject matter. The LM flags below are derived rather
    than forwarded, so the 5Hz LM rewrites the visitor's text at most once and
    never rewrites text they typed by hand. See SPEC.md §8.1.
    """
    prompt = gen_request.prompt
    if gen_request.genre:
        prompt = f"{gen_request.genre}. {prompt}"

    if gen_request.instrumental:
        lyrics = "[Instrumental]"
    elif gen_request.lyrics:
        lyrics = gen_request.lyrics
    else:
        lyrics = ""

    # Auto-lyrics: no lyrics given and vocals wanted. Upstream's create_sample writes
    # both the caption and the lyrics from this query.
    sample_mode = not gen_request.instrumental and not gen_request.lyrics

    payload: dict = {
        "prompt": prompt,
        "lyrics": lyrics,
        "thinking": gen_request.thinking,
        "vocal_language": gen_request.vocal_language,
        "audio_format": gen_request.audio_format,
        # use_format runs upstream's format_sample, which regenerates the caption *and*
        # the lyrics in one pass — the caption enrichment cannot be had without the
        # lyric rewrite. None of the three flows can accept that rewrite: after
        # sample_mode it paraphrases LM output a second time, with user lyrics it
        # destroys them (SPEC.md FR-21), and on an instrumental request it can return
        # invented lyrics in place of "[Instrumental]" and put vocals on a track that
        # asked for none. Sent explicitly rather than left to the upstream default.
        # Caption enrichment under our own control is SPEC.md §8.2 "Two-stage caption".
        "use_format": False,
        "use_cot_caption": gen_request.use_cot_caption,
        "use_cot_language": gen_request.use_cot_language,
        "lm_temperature": gen_request.lm_temperature,
        "inference_steps": gen_request.inference_steps,
        "batch_size": gen_request.batch_size,
    }

    if gen_request.duration is not None:
        payload["audio_duration"] = gen_request.duration

    if sample_mode:
        payload["sample_mode"] = True
        # Prefer the dedicated topic field. Falling back to the style prompt keeps
        # older clients working, at the cost of the conflation FR-20 exists to fix.
        payload["sample_query"] = _strip_instrumental_hints(
            gen_request.topic or prompt
        )

    if gen_request.bpm is not None:
        payload["bpm"] = gen_request.bpm
    if gen_request.key_scale:
        payload["key_scale"] = gen_request.key_scale
    if gen_request.time_signature:
        payload["time_signature"] = gen_request.time_signature

    payload["infer_method"] = gen_request.infer_method

    return payload


# Status code mapping: ACE-Step → user-facing
_STATUS_MAP = {
    0: "processing",
    1: "completed",
    2: "failed",
}


def _parse_acestep_result(task: dict) -> list[dict]:
    """Parse the stringified JSON 'result' field from the ACE-Step API."""
    result_str = task.get("result")
    if not result_str or not isinstance(result_str, str):
        return []
    try:
        return json.loads(result_str)
    except json.JSONDecodeError:
        return []


# ── Routes ────────────────────────────────────────────────────────


@router.post(
    "/generate", response_model=GenerationResponse, status_code=status.HTTP_202_ACCEPTED
)
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
        parsed_results = _parse_acestep_result(task)
        audio_files = []
        metadata = {}

        if parsed_results:
            # We typically just use the first item's metadata
            first_item = parsed_results[0]
            metas = first_item.get("metas", {})
            metadata = {
                "prompt": metas.get("prompt", first_item.get("prompt")),
                "lyrics": metas.get("lyrics", first_item.get("lyrics")),
                "bpm": metas.get("bpm"),
                "audio_duration": metas.get("duration"),
                "key_scale": metas.get("keyscale"),
                "time_signature": metas.get("timesignature"),
            }
            # Filter out empty metadata fields
            metadata = {k: v for k, v in metadata.items() if v is not None}

            # Collect all file paths
            for item in parsed_results:
                f = item.get("file")
                if f:
                    # Depending on ACE-Step, it might be a clean string or a raw URL
                    audio_files.append(f)

        if audio_files:
            response_data["audio_url"] = f"/api/audio/{task_id}?index=0"
            if len(audio_files) > 1:
                response_data["audio_urls"] = [
                    f"/api/audio/{task_id}?index={i}" for i in range(len(audio_files))
                ]

        if metadata:
            response_data["metadata"] = metadata

    elif mapped_status == "failed":
        response_data["error"] = task.get("error", "Generation failed")

    return response_data


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
        parsed_results = _parse_acestep_result(task)
        audio_files = []
        for item in parsed_results:
            f = item.get("file")
            if f:
                audio_files.append(f)

        if not audio_files or index >= len(audio_files):
            raise HTTPException(status_code=404, detail="Audio file not found")

        safe_path = audio_files[index]
        # Sometimes the ACE-Step API returns the full endpoint string e.g. /v1/audio?path=...
        # We need to extract the actual path argument
        if "?path=" in safe_path:
            safe_path = safe_path.split("?path=")[1]
            import urllib.parse

            safe_path = urllib.parse.unquote(safe_path)

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


@router.post("/warmup")
@limiter.limit("10/minute")
async def warmup(request: Request, response: Response):
    """Dispatch a wake to the GPU ahead of the user asking for a song.

    Modal wake dominates the wait for a first song and cannot overlap with
    anything, because nothing contacts the GPU until a Task is submitted. The
    frontend calls this on the visitor's first genuine interaction so the wake
    runs while they read the page and fill the form. See SPEC.md FR-16.
    """
    warm_state = request.app.state.warm_state

    if warm_state.is_within_dedupe_window():
        return {"warm": warm_state.last_known_warm}

    if not warm_state.has_budget_remaining():
        # Report cold rather than the last known answer: the dedupe window has
        # lapsed, so the container may have scaled down since we last looked and
        # we are declining to find out. Promising a warm GPU we have not checked
        # would set the visitor up for a wait the UI told them was not coming.
        logger.warning("Prewarm declined: monthly warm budget exhausted")
        return {"warm": False}

    client = _get_client(request)
    # Reserved before the await, not after: the health check waits ten seconds and
    # prewarm is public, so recording on completion would let a burst of callers
    # all pass the checks above and each wake upstream. See WarmState.begin_dispatch.
    warm_state.begin_dispatch()
    warm = False
    try:
        await client.health_check()
        warm = True
    except ACEStepError:
        # Not an error worth surfacing. A cold container takes far longer to
        # answer than the health check waits, so a failure here is the normal
        # cold path: Modal starts booting the moment the request reaches its
        # ingress, whether or not we stay for the reply. The visitor has not
        # asked for anything yet, so there is nothing to report and nothing to
        # retry — they pay Modal wake later only if they submit a Task.
        pass
    except Exception:
        # Prewarm is speculative and the visitor has asked for nothing, so no
        # failure here is worth a 500. Anything the client did not convert — a
        # connection dropped mid-read by a container on its way to zero, say —
        # lands here and is reported as cold, like any other unanswered wake.
        logger.exception("Prewarm failed with an unconverted error; reporting cold")
    finally:
        # In the finally block so the reservation is always settled: leaking an
        # in-flight count would pin last_known_warm to False for the process's life.
        warm_state.complete_dispatch(warm=warm)

    return {"warm": warm}


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
async def random_sample(
    request: Request,
    response: Response,
    body: RandomSampleRequest = RandomSampleRequest(),
):
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


@router.get("/examples/random", response_model=ExampleResponse)
@limiter.limit("10/minute")
async def get_random_example(request: Request, response: Response):
    """Pick a random example from the curated collection and map its fields."""
    try:
        # Draw from both collections so every example is reachable, regardless
        # of which one it came from — the UI no longer has separate modes.
        all_files = [
            (dirname, f)
            for dirname in ("simple_mode", "text2music")
            if (EXAMPLES_ROOT / dirname).exists()
            for f in (EXAMPLES_ROOT / dirname).glob("*.json")
        ]

        if not all_files:
            raise HTTPException(status_code=404, detail="No example files found")

        dirname, random_file = random.choice(all_files)
        with open(random_file, "r") as f:
            data = json.load(f)

        if dirname == "simple_mode":
            return ExampleResponse(
                prompt=data.get("description", ""),
                lyrics="",
                vocal_language=_normalize_language(data.get("vocal_language")),
                instrumental=bool(data.get("instrumental")),
            )

        return ExampleResponse(
            prompt=data.get("caption", ""),
            lyrics=data.get("lyrics", ""),
            vocal_language=_normalize_language(data.get("language")),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch example: {str(e)}"
        )
