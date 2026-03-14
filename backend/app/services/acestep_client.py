"""
ACE-Step Modal API client.

Async HTTP client that replaces modal_client.py, job_queue.py, and storage.py.
All music generation is delegated to the deployed ACE-Step REST API.
"""

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Timeout profiles (seconds)
DEFAULT_TIMEOUT = 60*5
AUDIO_DOWNLOAD_TIMEOUT = 60*5


class ACEStepError(Exception):
    """Base exception for ACE-Step API errors."""

    def __init__(self, message: str, status_code: int = 502):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ACEStepClient:
    """Async HTTP client for the ACE-Step Modal REST API."""

    def __init__(self, http_client: httpx.AsyncClient):
        self.base_url = settings.ACESTEP_API_URL.rstrip("/")
        self.api_key = settings.ACESTEP_API_KEY
        self.client = http_client

    def _headers(self) -> dict[str, str]:
        """Build request headers with optional auth."""
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _unwrap(self, response: httpx.Response) -> Any:
        """
        Unwrap the ACE-Step unified response envelope.

        Expected shape: {"data": ..., "code": 200, "error": null, ...}
        """
        if response.status_code == 429:
            raise ACEStepError("Service is busy. Please try again later.", 503)

        if response.status_code == 401:
            raise ACEStepError("Service configuration error.", 500)

        if response.status_code >= 500:
            raise ACEStepError("Music generation service unavailable.", 502)

        if response.status_code >= 400:
            raise ACEStepError("Invalid generation parameters.", 400)

        body = response.json()
        if body.get("error"):
            raise ACEStepError(
                body["error"] if isinstance(body["error"], str) else str(body["error"]),
                502,
            )
        return body.get("data", body)

    # ── Core workflow ──────────────────────────────────────────────

    async def submit_task(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Submit a music generation task.

        POST /release_task → returns task_id (and possibly queue position).
        """
        try:
            resp = await self.client.post(
                f"{self.base_url}/release_task",
                json=params,
                headers=self._headers(),
                timeout=DEFAULT_TIMEOUT,
            )
            return self._unwrap(resp)
        except httpx.TimeoutException:
            raise ACEStepError("Service timed out. Please try again.", 504)
        except httpx.ConnectError:
            raise ACEStepError("Cannot reach music generation service.", 503)

    async def query_result(self, task_ids: list[str]) -> dict[str, Any]:
        """
        Query the status / result for one or more tasks.

        POST /query_result with {"task_id_list": [...]}
        """
        try:
            resp = await self.client.post(
                f"{self.base_url}/query_result",
                json={"task_id_list": task_ids},
                headers=self._headers(),
                timeout=DEFAULT_TIMEOUT,
            )
            return self._unwrap(resp)
        except httpx.TimeoutException:
            raise ACEStepError("Service timed out. Please try again.", 504)
        except httpx.ConnectError:
            raise ACEStepError("Cannot reach music generation service.", 503)

    async def download_audio_stream(self, path: str) -> httpx.Response:
        """
        Stream-download an audio file from the ACE-Step API.

        GET /v1/audio?path=<path>  →  returns a streaming response.
        The caller MUST ensure they iterate it and close it.
        """
        try:
            req = self.client.build_request(
                "GET",
                f"{self.base_url}/v1/audio",
                params={"path": path},
                headers=self._headers(),
                timeout=AUDIO_DOWNLOAD_TIMEOUT,
            )
            resp = await self.client.send(req, stream=True)
            if resp.status_code != 200:
                await resp.aread()
                resp.close()
                raise ACEStepError("Failed to download audio.", resp.status_code)
            return resp
        except httpx.TimeoutException:
            raise ACEStepError("Audio download timed out.", 504)
        except httpx.ConnectError:
            raise ACEStepError("Cannot reach music generation service.", 503)

    # ── Utility endpoints ─────────────────────────────────────────

    async def health_check(self) -> dict[str, Any]:
        """GET /health"""
        try:
            resp = await self.client.get(
                f"{self.base_url}/health",
                headers=self._headers(),
                timeout=10.0,
            )
            return self._unwrap(resp)
        except (httpx.TimeoutException, httpx.ConnectError):
            raise ACEStepError("Cannot reach music generation service.", 503)

    async def list_models(self) -> Any:
        """GET /v1/models"""
        try:
            resp = await self.client.get(
                f"{self.base_url}/v1/models",
                headers=self._headers(),
                timeout=DEFAULT_TIMEOUT,
            )
            return self._unwrap(resp)
        except (httpx.TimeoutException, httpx.ConnectError):
            raise ACEStepError("Cannot reach music generation service.", 503)

    async def get_random_sample(self, params: dict[str, Any] | None = None) -> Any:
        """POST /create_random_sample"""
        try:
            resp = await self.client.post(
                f"{self.base_url}/create_random_sample",
                json=params or {},
                headers=self._headers(),
                timeout=DEFAULT_TIMEOUT,
            )
            return self._unwrap(resp)
        except (httpx.TimeoutException, httpx.ConnectError):
            raise ACEStepError("Cannot reach music generation service.", 503)

    async def format_input(self, params: dict[str, Any]) -> Any:
        """POST /format_input"""
        try:
            resp = await self.client.post(
                f"{self.base_url}/format_input",
                json=params,
                headers=self._headers(),
                timeout=DEFAULT_TIMEOUT,
            )
            return self._unwrap(resp)
        except (httpx.TimeoutException, httpx.ConnectError):
            raise ACEStepError("Cannot reach music generation service.", 503)
