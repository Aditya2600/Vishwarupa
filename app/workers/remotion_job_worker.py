# Rendering library — NOT a standalone SQS consumer.
#
# JobWorker (job_worker.py) is the single SQS polling process. It delegates
# remotion_async and hybrid_remotion_avatar_pip jobs here by calling
# RemotionJobProcessor._process_job directly. Stale-job reaping for these modes lives
# in JobWorker.reap_stale_processing_jobs (this class no longer has its own SQS
# polling loop or process entry point).

from __future__ import annotations

import asyncio
import base64
import html
import json
import logging
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from bson import ObjectId

from app.config import settings
from app.constants import SQS_QUEUE_URL, HYBRID_PUBLIC_DIR
from app.database import videos_collection
from app.models import VideoRecord, RemotionVideoRequest, HybridRemotionAvatarPipRequest
from app.services.errors import PermanentError, classify_exception
from app.services.sqs_service import SQSService
from app.services.remotion_service import RemotionService
from app.services.s3_service import S3Service
from app.services.hybrid_remotion_avatar_pip_service import (
    _verify_media,
    collection_status_percent,
    generate_raw_avatar_for_hybrid,
    render_hybrid_avatar_pip_video,
)

logger = logging.getLogger("app")


# Retained for test_remotion_reaper.py; the live reaper now lives in JobWorker,
# which carries its own copy of this helper.
def _stale_processing_cutoff(now: datetime, timeout_seconds: int, visibility_seconds: int) -> datetime:
    # ponytail: one grace window past the render timeout; use a scheduler later if this grows.
    return now - timedelta(seconds=max(timeout_seconds, 1) + max(visibility_seconds, 1))


def _mongo_id(value: str) -> ObjectId | str:
    cleaned = str(value)
    if ObjectId.is_valid(cleaned):
        return ObjectId(cleaned)
    return cleaned


def _to_mongo_safe(obj: Any) -> Any:
    """Recursively convert Pydantic models and Paths to JSON-safe types."""
    if hasattr(obj, "model_dump"):
        obj = obj.model_dump(mode="python")
    if isinstance(obj, dict):
        return {k: _to_mongo_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_mongo_safe(v) for v in obj]
    if isinstance(obj, Path):
        return str(obj)
    return obj


def _asset_data_uri(relative_path: str) -> str:
    project_root = Path(__file__).resolve().parents[2]
    if relative_path.startswith(("app/", "Remotion/")):
        asset_path = project_root / relative_path
    else:
        asset_path = Path(__file__).resolve().parents[1] / relative_path
    if not asset_path.exists():
        logger.warning("Interactive HTML asset missing: %s", asset_path)
        return ""

    mime_type = "image/png" if asset_path.suffix.lower() == ".png" else "image/jpeg"
    encoded = base64.b64encode(asset_path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


class RemotionJobProcessor:
    """Rendering engine for Remotion and hybrid avatar+PiP jobs.

    Called by JobWorker.process_message — not a standalone SQS consumer.
    Entry point: _process_job(video_id, receipt_handle).
    """

    def __init__(self) -> None:
        self.sqs_service = SQSService()
        self.remotion_service = RemotionService()
        self.s3_service = S3Service()
        self.videos_collection_ref = videos_collection
        self.queue_url = SQS_QUEUE_URL

    def _build_loan_reminder_html(
        self,
        *,
        video_id: str,
        title: str,
        video_url: str,
        payment_url: str,
        callback_phone: str,
    ) -> str:
        frontend_base_url = (settings.frontend_url or "").strip().rstrip("/")
        api_url = f"{frontend_base_url}/api/interactive/loan-reminder/{video_id}" if frontend_base_url else ""
        payload = json.dumps(
            {
                "apiUrl": api_url,
                "videoUrl": video_url,
                "paymentUrl": payment_url,
                "callbackPhone": callback_phone,
                "showCtaAt": 46,
            },
            ensure_ascii=True,
        )
        escaped_title = html.escape(title or "Loan Reminder")
        bank_logo_src = _asset_data_uri("Remotion/public/assets/tvs_credit_logo.png")
        credresolve_logo_src = _asset_data_uri("app/assets/credresolve_logo-removebg-preview.png")
        bank_logo_markup = (
            f'<img class="bank-logo" src="{bank_logo_src}" alt="TVS Credit" />'
            if bank_logo_src
            else '<div class="bank-logo-fallback">TVS</div>'
        )
        credresolve_logo_markup = (
            f'<img class="credresolve-logo" src="{credresolve_logo_src}" alt="CredResolve" />'
            if credresolve_logo_src
            else '<div class="credresolve-fallback">CredResolve</div>'
        )

        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escaped_title}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(circle at 16% 12%, rgba(10, 157, 88, 0.34), transparent 32%),
        radial-gradient(circle at 86% 78%, rgba(0, 107, 179, 0.42), transparent 34%),
        linear-gradient(180deg, #005baa 0%, #063f5f 58%, #021c2f 100%);
      color: #fff;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    .shell {{
      width: min(100%, 460px);
    }}
    .brand-overlay {{
      align-items: center;
      display: flex;
      gap: 14px;
      justify-content: space-between;
      left: 14px;
      pointer-events: none;
      position: absolute;
      right: 14px;
      top: 14px;
      z-index: 5;
    }}
    .bank-brand {{
      align-items: center;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.34);
      border-radius: 18px;
      display: flex;
      min-height: 54px;
      padding: 8px;
      box-shadow: 0 18px 40px rgba(2, 28, 47, 0.22);
    }}
    .bank-logo {{
      width: 42px;
      height: 42px;
      display: block;
      object-fit: contain;
    }}
    .bank-logo-fallback {{
      align-items: center;
      background: #005baa;
      border-radius: 12px;
      color: #ffffff;
      display: flex;
      font-size: 13px;
      font-weight: 950;
      height: 34px;
      justify-content: center;
      width: 34px;
    }}
    .powered-by {{
      align-items: flex-end;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }}
    .powered-label {{
      color: rgba(255, 255, 255, 0.82);
      font-size: 8px;
      font-weight: 850;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }}
    .credresolve-logo {{
      width: min(30vw, 110px);
      height: auto;
      display: block;
      filter: drop-shadow(0 12px 24px rgba(2, 28, 47, 0.2));
    }}
    .credresolve-fallback {{
      color: #ffffff;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: -0.02em;
    }}
    .player {{
      position: relative;
      width: 100%;
      max-width: 430px;
      max-height: min(86vh, 920px);
      aspect-ratio: 9 / 16;
      margin: 0 auto;
      overflow: hidden;
      border-radius: 12px;
      background: #063f5f;
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 24px 70px rgba(2, 28, 47, 0.34);
    }}
    video {{
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      background: #063f5f;
    }}
    .overlay {{
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: none;
      padding: 72px 18px 18px;
      background: linear-gradient(180deg, rgba(6, 63, 95, 0) 0%, rgba(6, 63, 95, 0.72) 28%, rgba(6, 63, 95, 0.96) 100%);
    }}
    .overlay.visible {{
      display: block;
    }}
    .actions {{
      display: grid;
      gap: 12px;
    }}
    .button {{
      min-height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 18px;
      line-height: 1.1;
      font-weight: 900;
      text-decoration: none;
      border: 0;
    }}
    .pay {{
      color: #fff;
      background: linear-gradient(135deg, #0a9d58 0%, #25c978 100%);
      box-shadow: 0 16px 34px rgba(10, 157, 88, 0.3);
    }}
    .call {{
      color: #063f5f;
      background: #fff;
      border: 2px solid rgba(6, 63, 95, 0.16);
      box-shadow: 0 12px 28px rgba(6, 63, 95, 0.18);
    }}
    .note {{
      margin: 18px 0 0;
      text-align: center;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.65);
    }}
  </style>
</head>
<body>
  <main class="shell">
    <section class="player" aria-label="{escaped_title}">
      <video id="loan-video" controls playsinline preload="metadata"></video>
      <div class="brand-overlay">
        <div class="bank-brand">
          {bank_logo_markup}
        </div>
        <div class="powered-by">
          <div class="powered-label">Powered by</div>
          {credresolve_logo_markup}
        </div>
      </div>
      <div id="cta-overlay" class="overlay">
        <div class="actions">
          <a id="pay-button" class="button pay" target="_blank" rel="noopener noreferrer">Pay Now</a>
          <a id="call-button" class="button call">Call Now</a>
        </div>
      </div>
    </section>
    <p class="note">The MP4 visuals are not clickable. Use the on-screen buttons.</p>
  </main>
  <script>
    const config = {payload};
    const video = document.getElementById("loan-video");
    const overlay = document.getElementById("cta-overlay");
    const payButton = document.getElementById("pay-button");
    const callButton = document.getElementById("call-button");

    function applyConfig(nextConfig) {{
      if (nextConfig.videoUrl) {{
        video.src = nextConfig.videoUrl;
      }}
      if (nextConfig.paymentUrl) {{
        payButton.href = nextConfig.paymentUrl;
      }}
      if (nextConfig.callbackPhone) {{
        callButton.href = "tel:" + nextConfig.callbackPhone;
      }}
      payButton.style.display = nextConfig.paymentUrl ? "flex" : "none";
      callButton.style.display = nextConfig.callbackPhone ? "flex" : "none";
    }}

    applyConfig(config);

    if (config.apiUrl) {{
      fetch(config.apiUrl)
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {{
          if (!data) return;
          applyConfig({{
            videoUrl: data.video_url,
            paymentUrl: data.payment_url,
            callbackPhone: data.contact_details,
          }});
        }})
        .catch(() => undefined);
    }}

    if (!config.paymentUrl) {{
      payButton.style.display = "none";
    }}
    if (!config.callbackPhone) {{
      callButton.style.display = "none";
    }}

    video.addEventListener("timeupdate", () => {{
      overlay.classList.toggle("visible", video.currentTime >= config.showCtaAt);
    }});
  </script>
</body>
</html>
"""

    def _upload_loan_reminder_html(
        self,
        *,
        video_id: str,
        title: str,
        video_url: str,
        payment_url: str,
        callback_phone: str,
    ) -> str | None:
        html_dir = settings.output_dir / "interactive" / "loan-reminder"
        html_dir.mkdir(parents=True, exist_ok=True)
        html_path = html_dir / f"{video_id}.html"
        html_path.write_text(
            self._build_loan_reminder_html(
                video_id=video_id,
                title=title,
                video_url=video_url,
                payment_url=payment_url,
                callback_phone=callback_phone,
            ),
            encoding="utf-8",
        )
        return self.s3_service.upload_file(
            html_path,
            f"interactive/loan-reminder/{video_id}.html",
            content_type="text/html; charset=utf-8",
        )

    async def _process_job(self, video_id: str, receipt_handle: str | None) -> None:
        """Fetch job from MongoDB, run Remotion generation, and update the record."""
        # 1. Fetch full job document from MongoDB
        job_doc = await self.videos_collection_ref.find_one(
            {"_id": _mongo_id(video_id)}
        )

        if not job_doc:
            logger.warning(f"RemotionJobProcessor: No job found for video_id={video_id}. It may have been processed already.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)
            return

        # 2. Skip completed jobs outright. Failed/queued jobs are claimable below.
        current_status = job_doc.get("status", "queued")
        if current_status == "completed":
            logger.info(f"RemotionJobProcessor: video_id={video_id} already in status={current_status}. Deleting from SQS.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)
            return

        # CRITICAL: Only process jobs that are explicitly Remotion jobs.
        # If an Avatar job is found in SQS, let the JobWorker handle it.
        request_mode = job_doc.get("request_mode", "")
        if "remotion" not in str(request_mode).lower():
            logger.info(f"RemotionJobProcessor: skipping video_id={video_id} because request_mode={request_mode} is not Remotion.")
            return

        # 3. Atomically claim the job. A single conditional update is the only safe
        # gate: a read-then-write check is a TOCTOU race where two workers both read
        # "queued" and both render the same job. Only a job still in a claimable
        # state ('queued' or 'failed' retry) matches, so exactly one worker wins.
        now = datetime.utcnow()
        claim = await self.videos_collection_ref.update_one(
            {"_id": _mongo_id(video_id), "status": {"$in": ["queued", "failed"]}},
            {"$set": {
                "status": "processing",
                "updated_at": now,
                "started_at": now,
                "error_message": None,
            }, "$inc": {"attempts": 1}}
        )
        if claim.modified_count == 0:
            # Another worker claimed it (or it advanced past a claimable state)
            # between our read and this update. Drop the duplicate message.
            logger.info(f"RemotionJobProcessor: video_id={video_id} was claimed by another worker (status={current_status}). Deleting duplicate SQS message.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)
            return

        try:
            # Hybrid jobs (avatar + Remotion PiP) share this worker because their
            # request_mode contains "remotion", but they run a different pipeline.
            if "hybrid" in str(request_mode).lower():
                await self._process_hybrid_job(video_id, job_doc, receipt_handle)
                return

            # 4. Generate Remotion video
            raw_payload = job_doc.get("job_data", {}).get("request_payload", {})
            remotion_req = RemotionVideoRequest(**raw_payload)
            
            # Pass the video_id down to consolidate all file naming
            result_payload = await self.remotion_service.generate_video(remotion_req, video_id=video_id)
            result_path = result_payload["video_path"]
            _verify_media(Path(result_path), require_audio=True)
            
            # 5. Upload to S3 (strict: a failed upload must not mark the job completed)
            s3_key = f"videos/{video_id}.mp4"
            final_url = self.s3_service.upload_video(result_path, s3_key, raise_on_failure=True)
            interactive_url = None
            if remotion_req.template_key in {"loan_reminder", "collection_reminder"} and final_url:
                interactive_url = self._upload_loan_reminder_html(
                    video_id=video_id,
                    title=str(job_doc.get("title") or "Loan Reminder"),
                    video_url=final_url,
                    payment_url=remotion_req.payment_url or "",
                    callback_phone=remotion_req.contact_details or "",
                )
            
            # 6. Update MongoDB to completed
            update_fields = {
                    "status": "completed",
                    "video_url": final_url,
                    "subtitles": result_payload.get("subtitles"),
                    "updated_at": datetime.utcnow(),
                }
            if interactive_url:
                update_fields["interactive_url"] = interactive_url

            await self.videos_collection_ref.update_one(
                {"_id": _mongo_id(video_id)},
                {"$set": update_fields}
            )
            
            # 7. Delete from SQS
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)

        except Exception as exc:
            # Decide retry vs fail-fast. The atomic claim already $inc'd `attempts`,
            # so attempts-so-far = the doc's prior value + 1. A transient error under
            # the retry cap is left reclaimable WITHOUT deleting the SQS message, so
            # the message redelivers and another claim re-runs it. Permanent errors
            # (and exhausted retries) fail fast: mark failed and drop the message,
            # rather than burning the full SQS receive budget on a hopeless render.
            attempts_so_far = int(job_doc.get("attempts", 0)) + 1
            transient = not isinstance(exc, PermanentError) and classify_exception(exc)
            retryable = transient and attempts_so_far < settings.sqs_max_receive_count

            if retryable:
                logger.warning(
                    f"RemotionJobProcessor: transient failure for video_id={video_id} "
                    f"(attempt {attempts_so_far}/{settings.sqs_max_receive_count}); requeueing: {exc}"
                )
                await self.videos_collection_ref.update_one(
                    {"_id": _mongo_id(video_id)},
                    {"$set": {
                        "status": "queued",
                        "error_message": str(exc),
                        "updated_at": datetime.utcnow(),
                    }}
                )
                # Do NOT delete the message — let SQS redeliver it for another claim.
                return

            logger.error(f"RemotionJobProcessor: Failed to process video_id={video_id}: {exc}")
            await self.videos_collection_ref.update_one(
                {"_id": _mongo_id(video_id)},
                {"$set": {
                    "status": "failed",
                    "error_message": str(exc),
                    "updated_at": datetime.utcnow(),
                }}
            )
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)

    async def _process_hybrid_job(
        self, video_id: str, job_doc: dict[str, Any], receipt_handle: str | None
    ) -> None:
        """Render an async hybrid (avatar + Remotion PiP) job.

        Mirrors the former synchronous endpoint, but runs on the worker. Raises on
        failure so the caller's retry/fail-fast handler manages status + SQS; on
        success it updates the record to 'completed' and deletes the message itself.
        """
        raw_payload = (job_doc.get("job_data") or {}).get("request_payload") or {}
        request = HybridRemotionAvatarPipRequest(**raw_payload)
        collection_status = collection_status_percent(request.collection_status)

        raw_avatar = await asyncio.to_thread(
            generate_raw_avatar_for_hybrid,
            customer_name=request.customer_name,
            account_number=request.account_number,
            days_overdue=request.days_overdue,
            amount_due=request.amount_due,
            avatar_id=request.avatar_id,
            voice_id=request.voice_id,
            agent_name=request.agent_name,
            language=request.language,
        )
        render_result = await asyncio.to_thread(
            render_hybrid_avatar_pip_video,
            video_id=video_id,
            avatar_mp4_path=raw_avatar["avatar_local_path"],
            customer_name=request.customer_name,
            account_number=request.account_number,
            days_overdue=request.days_overdue,
            collection_status=collection_status,
            amount_due=request.amount_due,
            agent_name=request.agent_name,
            agent_role=request.agent_role,
            aspect_mode=request.aspect_mode,
            viewport_width=request.viewport_width,
            viewport_height=request.viewport_height,
        )

        final_source_path = Path(render_result["output_path"])
        _verify_media(final_source_path, require_audio=True)

        # Serve locally under /generated (parity with the old endpoint) and upload
        # to S3 for durability — the /tmp public copy does not survive a restart.
        public_filename = f"{video_id}.mp4"
        public_path = HYBRID_PUBLIC_DIR / public_filename
        HYBRID_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(shutil.copyfile, final_source_path, public_path)

        s3_url = self.s3_service.upload_video(
            public_path, f"videos/{video_id}.mp4", raise_on_failure=True
        )
        final_video_url = s3_url or f"/generated/{public_filename}"

        response = {
            "success": True,
            "raw_avatar_video_id": raw_avatar.get("heygen_video_id"),
            "raw_avatar_path": raw_avatar.get("avatar_local_path"),
            "final_video_path": str(public_path),
            "final_video_url": final_video_url,
            "width": int(render_result["width"]),
            "height": int(render_result["height"]),
            "duration_seconds": render_result.get("duration_seconds"),
        }

        await self.videos_collection_ref.update_one(
            {"_id": _mongo_id(video_id)},
            {"$set": {
                "status": "completed",
                "video_url": final_video_url,
                "updated_at": datetime.utcnow(),
                "completed_at": datetime.utcnow(),
                "job_data.raw_avatar": raw_avatar,
                "job_data.render_result": render_result,
                "job_data.response": response,
            }},
        )
        if receipt_handle:
            self.sqs_service.delete_message(receipt_handle, self.queue_url)
        logger.info("RemotionJobProcessor: hybrid job %s completed.", video_id)
