"""Typed HTTP client for the internal Node Remotion renderer service.

Replaces the per-job `npx remotion render` subprocess with a request to a
long-lived renderer that reuses one Remotion bundle + one Chromium across jobs.

Failures are mapped onto the existing retry taxonomy (`TransientError` /
`PermanentError` in app.services.errors) so the worker's fail-fast vs requeue
logic is unchanged: a renderer crash / 5xx / timeout is transient (requeue), a
4xx (bad composition/props) is permanent (fail fast). A failed render NEVER
returns success, so a crashed renderer can't silently mark a job completed.

Never logs input props: they carry borrower scripts, phone numbers and account
numbers. Only job_id / composition_id / stage are logged.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings
from app.services.errors import PermanentError, TransientError

logger = logging.getLogger("app")


class RendererError(RuntimeError):
    """Carries the renderer pipeline stage where the failure occurred."""

    def __init__(self, message: str, *, stage: str) -> None:
        super().__init__(message)
        self.stage = stage


class RendererClient:
    def __init__(
        self,
        base_url: str | None = None,
        *,
        connect_timeout: float | None = None,
        read_timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url or settings.remotion_renderer_url or "").rstrip("/")
        self.connect_timeout = float(
            connect_timeout
            if connect_timeout is not None
            else settings.remotion_renderer_connect_timeout_seconds
        )
        # Read timeout must cover a full render; default to the render timeout.
        self.read_timeout = float(
            read_timeout
            if read_timeout is not None
            else settings.remotion_render_timeout_seconds
        )

    def render(
        self,
        *,
        entry_point: str,
        composition_id: str,
        input_props: dict[str, Any],
        output_location: str,
        job_id: str,
        request_mode: str | None = None,
    ) -> dict[str, Any]:
        """POST /render and return the renderer's structured success payload.

        Raises TransientError (requeue) or PermanentError (fail fast). The output
        MP4 is written by the renderer to `output_location` on the shared volume;
        the caller keeps ownership of ffprobe validation, S3 upload and DB status.
        """
        if not self.base_url:
            raise PermanentError(
                "REMOTION_RENDERER_URL is not configured but REMOTION_RENDER_BACKEND=service"
            )

        url = f"{self.base_url}/render"
        payload = {
            "entryPoint": entry_point,
            "compositionId": composition_id,
            "inputProps": input_props,
            "outputLocation": output_location,
            "jobId": job_id,
            "requestMode": request_mode,
        }
        timeout = httpx.Timeout(
            self.read_timeout, connect=self.connect_timeout, read=self.read_timeout
        )

        logger.info(
            "renderer.request job_id=%s composition_id=%s mode=%s",
            job_id,
            composition_id,
            request_mode,
        )
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(url, json=payload)
        except httpx.TimeoutException as exc:
            raise TransientError(
                f"Renderer timed out after {self.read_timeout}s (job_id={job_id}, stage=render)"
            ) from exc
        except httpx.TransportError as exc:
            # ConnectError / ReadError / network — renderer down or restarting.
            raise TransientError(
                f"Renderer transport error (job_id={job_id}): {exc}"
            ) from exc

        return self._handle_response(response, job_id=job_id)

    def _handle_response(self, response: httpx.Response, *, job_id: str) -> dict[str, Any]:
        stage = "render"
        detail = ""
        parsed: dict[str, Any] | None = None
        try:
            parsed = response.json()
        except ValueError:
            parsed = None

        if isinstance(parsed, dict):
            stage = str(parsed.get("stage") or stage)
            detail = str(parsed.get("error") or "")

        if response.status_code == 200:
            if not isinstance(parsed, dict) or not parsed.get("ok"):
                # 200 but not a well-formed success -> treat as transient, do not
                # trust it as completed.
                raise TransientError(
                    f"Malformed renderer response (job_id={job_id}): "
                    f"{response.text[:500]!r}"
                )
            logger.info(
                "renderer.complete job_id=%s duration_ms=%s queue_wait_ms=%s restarts=%s",
                job_id,
                parsed.get("durationMs"),
                parsed.get("queueWaitMs"),
                parsed.get("browserRestartCount"),
            )
            return parsed

        message = (
            f"Renderer failed (job_id={job_id}, status={response.status_code}, "
            f"stage={stage}): {detail[:500]}"
        )
        logger.error("renderer.failed job_id=%s status=%s stage=%s", job_id, response.status_code, stage)
        if 400 <= response.status_code < 500:
            # Bad composition / props / request — retrying won't help.
            raise PermanentError(message)
        # 5xx or anything else — transient, let the worker requeue.
        raise TransientError(message)
