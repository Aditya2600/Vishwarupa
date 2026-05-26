from __future__ import annotations

import asyncio
import base64
import html
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any
from bson import ObjectId

from app.config import settings
from app.constants import SQS_QUEUE_URL
from app.database import videos_collection
from app.models import VideoRecord, RemotionVideoRequest
from app.services.sqs_service import SQSService
from app.services.remotion_service import RemotionService
from app.services.s3_service import S3Service

logger = logging.getLogger("app")


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


class RemotionJobWorker:
    """
    Polls the SQS queue for Remotion video generation jobs and processes them.
    Mirrors the AvatarJobWorker pattern.
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

    async def run_forever(self) -> None:
        """Continuously poll SQS for remotion jobs until the process is killed."""
        logger.info("RemotionJobWorker: Starting SQS polling loop...")
        while True:
            try:
                await self._poll_once()
            except Exception as exc:
                logger.error(f"RemotionJobWorker: Unexpected error in poll loop: {exc}")
            await asyncio.sleep(settings.sqs_poll_interval_seconds if hasattr(settings, 'sqs_poll_interval_seconds') else 5)

    async def _poll_once(self) -> None:
        """Fetch one batch of messages from SQS and process them."""
        try:
            messages = await asyncio.to_thread(
                self.sqs_service.receive_messages,
                self.queue_url,
                max_messages=5
            )
            for message in messages:
                import json
                body_raw = message.get("Body", "{}")
                try:
                    body = json.loads(body_raw)
                except Exception:
                    body = {}

                video_id = body.get('_id')
                receipt_handle = message.get("ReceiptHandle")

                if not video_id:
                    logger.warning(f"RemotionJobWorker: Received message with no video_id/job_id: {body}, skipping.")
                    if receipt_handle:
                        self.sqs_service.delete_message(receipt_handle, self.queue_url)
                    continue

                await self._process_job(str(video_id), receipt_handle)

        except Exception as exc:
            logger.error(f"RemotionJobWorker: Error processing message: {exc}")

    async def _process_job(self, video_id: str, receipt_handle: str | None) -> None:
        """Fetch job from MongoDB, run Remotion generation, and update the record."""
        # 1. Fetch full job document from MongoDB
        job_doc = await self.videos_collection_ref.find_one(
            {"_id": _mongo_id(video_id)}
        )

        if not job_doc:
            logger.warning(f"RemotionJobWorker: No job found for video_id={video_id}. It may have been processed already.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)
            return

        # 2. Skip only completed jobs. Failed jobs are allowed to retry.
        current_status = job_doc.get("status", "queued")
        if current_status == "completed":
            logger.info(f"RemotionJobWorker: video_id={video_id} already in status={current_status}. Deleting from SQS.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)
            return
        if current_status == "processing":
            logger.info(f"RemotionJobWorker: video_id={video_id} is already processing. Deleting duplicate SQS message.")
            if receipt_handle:
                self.sqs_service.delete_message(receipt_handle, self.queue_url)
            return

        # 3. Mark as processing, clearing any prior failure state so retries can run cleanly.
        # CRITICAL FIX: Only process jobs that are explicitly Remotion jobs.
        # If an Avatar job is found in SQS, let the AvatarJobWorker handle it.
        request_mode = job_doc.get("request_mode", "")
        if "remotion" not in str(request_mode).lower():
            logger.info(f"RemotionJobWorker: skipping video_id={video_id} because request_mode={request_mode} is not Remotion.")
            return

        now = datetime.utcnow()
        await self.videos_collection_ref.update_one(
            {"_id": _mongo_id(video_id)},
            {"$set": {
                "status": "processing",
                "updated_at": now,
                "error_message": None,
            }}
        )

        try:
            # 4. Generate Remotion video
            raw_payload = job_doc.get("job_data", {}).get("request_payload", {})
            remotion_req = RemotionVideoRequest(**raw_payload)
            
            # Pass the video_id down to consolidate all file naming
            result_payload = await self.remotion_service.generate_video(remotion_req, video_id=video_id)
            result_path = result_payload["video_path"]
            
            # 5. Upload to S3
            s3_key = f"videos/{video_id}.mp4"
            final_url = self.s3_service.upload_video(result_path, s3_key)
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
            logger.error(f"RemotionJobWorker: Failed to process video_id={video_id}: {exc}")
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


def main():
    worker = RemotionJobWorker()
    try:
        asyncio.run(worker.run_forever())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user.")


if __name__ == "__main__":
    main()
