# Personalized Video Generator

FastAPI backend plus a Vite/React frontend for creating personalized videos through three flows:

- Avatar video generation through HeyGen
- Text-to-video rendering through the local `Remotion/` project
- Hybrid Avatar PIP video generation merging HeyGen talking avatars into local Remotion-rendered dashboards

The app also includes email/password auth, autosaved drafts, a "My Videos" library, direct video download/share actions, subtitle/logo post-processing for avatar renders, and a Talking PDF flow for document summaries.

## Highlights

- Three generation modes: HeyGen avatar videos, local Remotion text-to-video renders, and Hybrid Avatar PIP videos.
- Picture-in-Picture (PIP) layouts overlaying realistic talking avatars on top of dynamic collections dashboard frames (landscape and portrait).
- Subtitle controls for color and placement, plus logo position and opacity for styled outputs.
- Share step actions for copy link, WhatsApp sharing, and direct video download.
- Docker images for both backend and frontend, plus a root `docker-compose.yml` for local containerized runs.

## Talking PDF

Talking PDF is the document summarization flow for notices and other PDFs.

- Upload a single PDF or process a bulk CSV with `phone_number`, `pdf_link`, and `language` columns.
- The backend stores each PDF record in MongoDB.
- The original PDF and generated audio files are stored in S3.
- The summary page is shared through a public `/s/<pdfId>` link.
- WhatsApp messages use the `wsp_test2` template and send the borrower-facing summary link.
- Summary text is generated from the PDF content, and next-actions text can be edited before regenerating audio.
- If next-actions text is blank, no next-actions audio is generated.

Flow:

1. Upload or submit the PDF URL.
2. The backend creates a MongoDB record.
3. The PDF is uploaded to S3 when required.
4. The backend extracts text and generates a summary.
5. Summary and next-actions audio are generated with Edge TTS and stored in S3.
6. The public share page at `/s/<pdfId>` loads the borrower-facing PDF view.
7. WhatsApp sends the same public share link to the borrower.

## Hybrid Avatar PIP

Hybrid Avatar PIP is the merged dual-stage video generation flow that integrates realistic HeyGen synthetic talking human avatars directly into a local Remotion-rendered debt collections dashboard.

- **Stage 1 (HeyGen Sync Synthesis):** Compiles a personalized collections script based on customer details and selected locale (Hindi or English), then synchronously submits the synthesis to HeyGen's direct generation endpoint. The raw MP4 video is downloaded to local staging.
- **Stage 2 (Asset Transfer):** Staged MP4 avatar file is automatically copied to the Remotion project assets directory (`Remotion/public/avatar/`).
- **Stage 3 (Layout Resolution):** Resolves the target aspect mode. Landscape uses the `HybridCollectionNoticeLandscape` composition (1920x1080) with a dual-column card layout. Portrait uses the `HybridCollectionNoticePortrait` composition (1080x1920) optimized for vertical mobile screens.
- **Stage 4 (Remotion Compilation):** Triggers the Remotion CLI to render a headless Chromium session compile, drawing the collections metrics overlay and framing the talking avatar inside a Picture-in-Picture floating window in the bottom-right corner.

## Architecture & Queueing
Deploying the heavy Text-To-Video `Remotion` pipeline and HeyGen integrations requires a robust asynchronous pipeline to scale securely avoiding `504 Gateway Timeouts`:
- **AWS SQS:** The API leverages an AWS SQS queue to handle asynchronous tasks. Both Avatar and Remotion messages are submitted here.
- **Dual Polling Workers:** The server spins up `AvatarJobWorker` and `RemotionJobWorker` natively. The UI relies on the HTTP POST endpoint blocking securely until the worker uploads the finished artifact, triggering the real-time "progress bar" flawlessly.
- **Scalability:** Workers strictly process massive Chromium rendering tasks (`npx remotion render`) sequentially (one-by-one). This specifically protects the EC2 vCPU cores from failing or entering race conditions globally.
- **AWS S3:** Once artifacts are produced locally by the background queue, they are uploaded swiftly to AWS S3 (`vishvarupa` bucket) and shared via permanent URLs.

## Repo Layout

```text
.
├── app/
├── Frontend/
├── Remotion/
├── sample_data/
├── scripts/
├── tests/
├── .env.example
├── Dockerfile
└── README.md
```

## Prerequisites

- Python 3.11
- Node.js 20+ for local frontend and Remotion installs
- `ffmpeg`
- A MongoDB connection string
- Chrome or Chromium for local Remotion MP4 rendering, or `REMOTION_BROWSER_EXECUTABLE`

## Environment

Copy `.env.example` to `.env` and fill in the required values:

```env
HEYGEN_API_KEY=
HEYGEN_BASE_URL=https://api.heygen.com
HEYGEN_AVATAR_ID=
HEYGEN_VOICE_ID=
HEYGEN_TEMPLATE_ID=
HEYGEN_TEMPLATE_PAYLOAD_PATH=sample_data/template_payload.json
DEFAULT_VIDEO_WIDTH=1280
DEFAULT_VIDEO_HEIGHT=720
DEFAULT_BACKGROUND_COLOR=#F4F4F4
DEFAULT_OUTPUT_DIR=output
FFMPEG_BINARY=ffmpeg
REMOTION_DIR=Remotion
EDGE_TTS_BINARY=edge-tts
REMOTION_NPX_BINARY=npx
REMOTION_BROWSER_EXECUTABLE=
POLL_INTERVAL_SECONDS=8
POLL_TIMEOUT_SECONDS=1200
STRICT_VALIDATION=true
CORS_ALLOW_ALL=true
CORS_ALLOW_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://localhost:4173,http://127.0.0.1:4173
MONGODB_URI=
SECRET_KEY=change-me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

## Run Locally

Backend:

```bash
python3.11 -m venv .venv311
source .venv311/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd Frontend
npm install
npm run dev
```

Remotion dependencies:

```bash
cd Remotion
npm install
```

### Loan Reminder Remotion Video

The `LoanReminderVideo` composition renders a 9:16 personalized loan reminder
video at 1080x1920, 30 FPS, and 64 seconds. Customer-specific values are passed
through Remotion props and default to `Remotion/src/data/sampleCustomer.ts`.

Preview:

```bash
cd Remotion
npm run preview
```

Render with the sample customer:

```bash
cd Remotion
npm run render
```

Render with dynamic props:

```bash
cd Remotion
npx remotion render src/Root.tsx LoanReminderVideo out/loan-reminder.mp4 --props='{"customerName":"Anita Sharma","loanType":"Personal Loan","loanNumber":"9988776655","overdueAmount":"₹72,500","lenderName":"Brand Credit"}'
```

The MP4 does not include clickable CTA actions. For clickable actions in the
web app, render real HTML buttons over the video with `LoanVideoPlayer`:

```tsx
import {LoanVideoPlayer} from './components/LoanVideoPlayer';

export function LoanReminderPreview() {
  return (
    <LoanVideoPlayer
      videoSrc="/videos/loan-reminder.mp4"
      paymentUrl="https://payments.example.com/pay/123445555555"
      callbackPhone="+919999999999"
      showCtaAt={46}
    />
  );
}
```

The complete generated MP4 + S3 HTML player flow is documented in
`docs/interactive-loan-reminder-flow.md`.

### Loan Reminder Voiceover Script

The scene-wise voiceover script lives in
`Remotion/src/data/loanReminderVoiceoverScript.ts`. It exports
`sceneVoiceoverScript` and `replaceScriptPlaceholders(script, customerData)`.
The helper replaces `{customerName}`, `{loanType}`, `{loanNumber}`,
`{overdueAmount}`, and `{lenderName}` from the customer props used by the
`LoanReminderVideo` composition.

Each scene renders its matching script text as a readable bottom caption synced
to the Remotion timeline:

- Intro: `0-4s`
- LoanDetails: `4-13s`
- NpaWarning: `13-22s`
- CreditImpact: `22-30s`
- LegalWarning: `30-39s`
- LastChance: `39-46s`
- CtaScene: `46-55s`
- FinancialBurden: `55-61s`
- Outro: `61-64s`

To add generated TTS audio, place the MP3 at:

```text
Remotion/public/audio/loan-reminder-voiceover.mp3
```

The composition checks for that default file automatically. You can also pass a
different public audio path through `voiceoverAudioSrc`. If the audio file is
missing, the video still renders with scene captions and no audio track.

Render with default sample props:

```bash
cd Remotion
npx remotion render src/Root.tsx LoanReminderVideo out/loan-reminder.mp4
```

Render with custom customer props and voiceover audio:

```bash
cd Remotion
npx remotion render src/Root.tsx LoanReminderVideo out/loan-reminder.mp4 --props='{
  "customerName": "Rahul Verma",
  "loanType": "Personal Loan",
  "loanNumber": "123445555555",
  "overdueAmount": "₹50,000",
  "lenderName": "TVS Credit",
  "voiceoverAudioSrc": "audio/loan-reminder-voiceover.mp3"
}'
```

Open `http://127.0.0.1:8080`.

The frontend always calls the backend through `/api`, and Vite proxies that to the backend in development.

## Docker

### Docker Compose

Use the root `docker-compose.yml` to start both services together:

```bash
docker compose up --build -d
```

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

The compose stack starts these containers:

- `personalized-video-backend`
- `personalized-video-frontend`

The backend mounts `./input` and `./output` so generated and styled artifacts persist on the host.

### Backend image

The backend image now includes:

- Python dependencies
- `ffmpeg`
- Node + npm for Remotion
- Chromium for Remotion rendering
- Noto fonts for Hindi and other Indic scripts in Remotion renders
- The local `Remotion/` project and its npm dependencies

Build:

```bash
docker build -t personalized-video-backend .
```

Run:

```bash
docker run --rm \
  --shm-size=2g \
  -p 8000:8000 \
  --env-file .env \
  -v "$(pwd)/input:/app/input" \
  -v "$(pwd)/output:/app/output" \
  personalized-video-backend
```

### Frontend image

The frontend image proxies backend requests through `BACKEND_ORIGIN`.

Build:

```bash
cd Frontend
docker build -t personalized-video-frontend .
```

Run:

```bash
docker run --rm -p 8080:80 personalized-video-frontend
```

To point the container at a different backend:

```bash
docker run --rm \
  --network app-network \
  -p 8080:80 \
  -e BACKEND_ORIGIN=http://heygen-backend:8000 \
  personalized-video-frontend
```

For local one-off Docker runs outside a shared Docker network, set `BACKEND_ORIGIN` to an address the container can resolve.

## CI/CD

GitHub Actions workflows are included under `.github/workflows/`:

- `ci.yml` runs backend tests, frontend tests/build, and a Remotion dependency check on every push, pull request, and manual run.
- `publish-images.yml` is the EC2 CD pipeline. It reruns the checks, publishes backend/frontend images to GitHub Container Registry, uploads `docker-compose.ec2.yml` to your EC2 instance, and restarts the app over SSH.

Published image names:

- `ghcr.io/<owner>/<repo>-backend`
- `ghcr.io/<owner>/<repo>-frontend`

Required GitHub secrets for EC2 deployment:

- `EC2_HOST`
- `EC2_USERNAME`
- `EC2_SSH_KEY`
- `EC2_APP_DIR`
- `GHCR_USERNAME`
- `GHCR_TOKEN`

Optional GitHub secrets:

- `EC2_PORT`
- `EC2_FRONTEND_PORT`

EC2 setup checklist:

1. Install Docker and Docker Compose on the EC2 instance.
2. Create the deploy directory from `EC2_APP_DIR`, for example `/opt/personalized-video-generator`.
3. Copy `.env.example` to `$EC2_APP_DIR/.env` on the server and fill in your real values.
4. Open inbound security-group access for port `80` and, if needed, `22`.
5. Keep backend port `8000` private; the frontend container proxies `/api` and `/artifacts` to the backend through `docker-compose.ec2.yml`.

The CD workflow uses the built-in `GITHUB_TOKEN` to push packages to GHCR from Actions, and the EC2 host uses `GHCR_USERNAME` plus `GHCR_TOKEN` to pull those private images during deployment.

## API Endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `GET /health`
- `GET /meta/avatars`
- `GET /meta/voices`
- `GET /meta/templates`
- `GET /meta/template/{template_id}`
- `POST /generate/direct`
- `POST /generate/template`
- `POST /generate/remotion`
- `POST /generate/hybrid-remotion-avatar-pip`
- `GET /videos/{video_id}/status`
- `POST /videos/{video_id}/stylize`
- `GET /my-videos`
- `POST /drafts/save`
- `GET /drafts`
- `POST /pdf/upload`
- `POST /pdf/{pdf_id}/summarize`
- `GET /pdf/{pdf_id}/status`
- `POST /pdf/{pdf_id}/generate-audio`
- `GET /pdf/share/{pdf_id}`
- `POST /pdf/bulk-csv`

## Notes

- Avatar drafts default to `app/templates/legal_notice_raw_hi.txt`.
- Text-to-video uses the local `Remotion/` project plus `edge-tts`.
- The Share step downloads the final video directly when the file is served by this app, and falls back to the video URL for external assets.
- Subtitle overlays are rendered with configurable placement and a lighter background to reduce overlap with on-screen content.
- The public Talking PDF share route is `/s/<pdfId>`.
- Generated Remotion runtime files under `Remotion/public/audio/` and `Remotion/public/metadata.json` should not be committed.
- If local Remotion renders fail to launch a browser, set `REMOTION_BROWSER_EXECUTABLE` explicitly.
- The active frontend docs live in `Frontend/README.md`.
