# Hybrid PiP / VisionDesk Flow

The Hybrid PiP (Picture-in-Picture) flow — branded **VisionDesk** in video titles — produces a debt-collection video that composites a live HeyGen AI avatar over a Remotion-rendered collection-notice UI. The avatar speaks to the customer while the background displays personalised account data, a collection-status progress bar, and CTA buttons.

It is a two-stage pipeline: first generate a raw avatar MP4 via HeyGen, then feed that MP4 into a local Remotion render that layers it as a floating PiP window over the UI.

---

## End-to-End Flow

### 1. Entry Points

**HTTP API** — `POST /generate/hybrid-remotion-avatar-pip` in `app/main.py:1733`  
Accepts `HybridRemotionAvatarPipRequest` (JSON body), returns `HybridRemotionAvatarPipResponse`.

**CLI script** — `scripts/render_hybrid_from_heygen.py`  
Drives the same two service functions directly. Useful for local testing without running the FastAPI server.

```bash
python scripts/render_hybrid_from_heygen.py \
  --customer-name "Rajesh Kumar" \
  --account-number "DC-2024-089456" \
  --days-overdue 35 \
  --collection-status 75 \
  --amount-due "₹45,200" \
  --avatar-id "<heygen_avatar_id>" \
  --voice-id "<heygen_voice_id>" \
  --agent-name "Priya" \
  --agent-role "Collections Assistant" \
  --language hi \
  --aspect-mode portrait_9_16 \
  --output output/hybrid/result.mp4
```

---

### 2. Request Model — `HybridRemotionAvatarPipRequest`

Defined in `app/models.py:208`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `customer_name` | `str` | required | |
| `account_number` | `str` | required | |
| `days_overdue` | `int` | required | Must be ≥ 0 |
| `collection_status` | `str \| None` | `None` | Parsed to 0–100 integer via `_collection_status_percent()` |
| `amount_due` | `str` | required | Displayed verbatim (e.g. `"₹45,200"`) |
| `avatar_id` | `str` | required | HeyGen avatar ID |
| `voice_id` | `str` | required | HeyGen voice ID |
| `agent_name` | `str` | `"Priya"` | Shown on PiP nameplate and in TTS script |
| `agent_role` | `str` | `"Collections Assistant"` | Shown below the agent name |
| `language` | `str` | `"hi"` | ISO code or full name; see language map below |
| `aspect_mode` | `'portrait_9_16' \| 'landscape_16_9' \| 'auto'` | `'portrait_9_16'` | `auto` picks based on `viewport_width`/`height` |
| `viewport_width` | `int \| None` | `None` | Used only when `aspect_mode='auto'` |
| `viewport_height` | `int \| None` | `None` | Used only when `aspect_mode='auto'` |

All string fields are stripped and validated non-empty. `viewport_width`/`height` must be positive when provided.

---

### 3. Stage 1 — Raw HeyGen Avatar Generation

`generate_raw_avatar_for_hybrid()` in `app/services/hybrid_remotion_avatar_pip_service.py:213`.

#### Script generation

`_build_hybrid_avatar_script()` (line 181) produces a short spoken script in Hindi or English. Hindi is the default; all other languages fall back to English.

Hindi example:
> नमस्ते {customer_name} जी। मैं {agent_name}, कलेक्शंस टीम से बोल रही हूँ। आपके खाते {account_number} पर भुगतान {days_overdue} दिनों से लंबित है। कुल देय राशि {amount_due} है। कृपया आज ही भुगतान करें या सहायता के लिए हमारी टीम से संपर्क करें।

#### HeyGen call

Constructs a `DirectVideoRequest` at 720×1280 (portrait), no captions, background `#F4F4F4`, and passes it to `VideoService().generate_direct(request, wait=True)`. This blocks until HeyGen renders and downloads the MP4.

#### Language map

`_language_name()` (line 153) normalises the `language` field:

| Input codes | Resolved name |
|---|---|
| `hi`, `hindi` | Hindi |
| `en`, `eng`, `english` | English |
| `mr`, `marathi` | Marathi |
| `ta`, `tamil` | Tamil |
| `te`, `telugu` | Telugu |
| `kn`, `kannada` | Kannada |
| `bn`, `bengali` | Bengali |
| `gu`, `gujarati` | Gujarati |
| `ml`, `malayalam` | Malayalam |
| `pa`, `punjabi` | Punjabi |

Any unrecognised code is passed through as-is (treated as a display name).

#### Output

Returns a dict:

```python
{
  "heygen_video_id": str,
  "avatar_local_path": str,    # absolute path to downloaded MP4
  "avatar_remote_url": str,
  "duration_seconds": float,
  "has_video": bool,
  "has_audio": bool,
}
```

The MP4 is validated with `ffprobe` before returning — missing video or audio streams raise `HybridAvatarGenerationError`.

---

### 4. Stage 2 — Remotion PiP Render

`render_hybrid_avatar_pip_video()` in `app/services/hybrid_remotion_avatar_pip_service.py:333`.

#### Aspect mode resolution

`_resolve_aspect_mode()` (line 300) maps the requested mode to a composition config:

| `aspect_mode` | Composition ID | Resolution |
|---|---|---|
| `portrait_9_16` | `HybridCollectionNoticePortrait` | 1080 × 1920 |
| `landscape_16_9` | `HybridCollectionNoticeLandscape` | 1920 × 1080 |
| `auto` (wide viewport) | `HybridCollectionNoticeLandscape` | 1920 × 1080 |
| `auto` (narrow/tall viewport) | `HybridCollectionNoticePortrait` | 1080 × 1920 |

`auto` selects landscape when `viewport_width >= viewport_height`, otherwise portrait.

#### Avatar staging

The raw avatar MP4 is copied to `Remotion/public/avatar/{video_id}.mp4` so that Remotion's `staticFile()` can serve it during render.

#### Props assembly

A temporary JSON file `hybrid_props_{video_id}_{uuid}.json` is written to the Remotion directory with:

```json
{
  "customerName": "...",
  "accountNumber": "...",
  "daysOverdue": 35,
  "collectionStatus": 75,
  "amountDue": "₹45,200",
  "agentName": "Priya",
  "agentRole": "Collections Assistant",
  "avatarVideoPath": "avatar/{video_id}.mp4",
  "durationInFrames": 900,
  "aspectMode": "portrait_9_16",
  "resolvedAspectMode": "portrait_9_16"
}
```

`durationInFrames` is derived from the raw avatar duration: `ceil(duration_seconds × 30)`.

#### Remotion render command

```bash
npx --yes remotion render src/index.jsx <CompositionId> <output.mp4> \
  --props=hybrid_props_{video_id}_{uuid}.json \
  --overwrite
  [--browser-executable=<path>]   # if REMOTION_BROWSER_EXECUTABLE is set
```

Runs from the `Remotion/` directory, 900-second timeout. The props file is deleted after render regardless of success or failure.

#### Output validation

The final MP4 is verified with `ffprobe` for video+audio streams and positive duration. Returns:

```python
{
  "output_path": str,
  "requested_aspect_mode": str,
  "resolved_aspect_mode": str,
  "composition": str,
  "width": int,
  "height": int,
  "duration_seconds": float,
  "duration_frames": int,
}
```

---

### 5. API Endpoint Orchestration — `app/main.py:1733`

1. Validates `avatar_id` and `voice_id` are non-empty.
2. Parses `collection_status` to an integer 0–100 via `_collection_status_percent()`.
3. Generates a `uuid4().hex` as `video_id`.
4. Runs Stage 1 and Stage 2 sequentially via `asyncio.to_thread` (both are blocking).
5. Copies the final MP4 to `HYBRID_PUBLIC_DIR` (`/tmp/hybrid-public/{video_id}.mp4`).
6. Sets `final_video_url = /generated/{video_id}.mp4`.
7. Inserts a `VideoRecord` to MongoDB with `request_mode="hybrid_remotion_avatar_pip"` and `title="VisionDesk - {customer_name}"`.
8. Returns `HybridRemotionAvatarPipResponse`.

#### Error mapping

| Exception | HTTP status |
|---|---|
| `HybridAvatarGenerationError` | 502 |
| `HybridRenderError` | 502 |
| `ValueError` (bad input) | 400 |
| Missing output MP4 | 500 |

---

### 6. Remotion — `HybridCollectionNotice` Composition

Defined in `Remotion/src/HybridCollectionNotice.jsx`.

```
HybridCollectionNotice (layout prop: 'portrait' | 'landscape')
├── MobileCollectionUI    (portrait layout)
├── LandscapeCollectionUI (landscape layout)
└── AvatarPip             (always rendered, position varies)
```

#### `MobileCollectionUI` (`Remotion/src/components/MobileCollectionUI.jsx`)

Portrait (1080 × 1920). Dark red gradient background (`#ff4258 → #c91428 → #650914`) with a scrolling grid overlay.

| Element | Detail |
|---|---|
| Header | "Payment attention required" + sub-text |
| White card | 2×2 grid: Account number, Customer name, Days overdue, Amount due |
| Progress bar | Animates from 0 to `collectionStatus`% between frames 20–90 |
| Notice card | "Timely payment can help avoid further collection escalation" |
| CTA buttons | "Pay now" (white, pulsing) + "Talk to agent" (ghost) at bottom |

#### `LandscapeCollectionUI` (`Remotion/src/components/LandscapeCollectionUI.jsx`)

Landscape (1920 × 1080). Split diagonal background: white left half (`#fff`), deep red right half (`#41070e → #940f20`).

| Element | Detail |
|---|---|
| Header | "Account payment notice" + sub-text |
| Detail card | Rows: Customer, Account number, Days overdue, Amount due (amount highlighted in red) |
| Progress bar | Same 0→status% animation, frames 18–88 |
| Notice card | "Payment today may help prevent additional recovery steps" |

#### `AvatarPip` (`Remotion/src/components/AvatarPip.jsx`)

A floating rounded-rectangle video window rendered via Remotion's `<Video src={staticFile(avatarVideoPath)} />`.

| Mode | Position | Size |
|---|---|---|
| Portrait | Right side, above CTA buttons | 360 × 560 px, right: 54, bottom: 220 |
| Landscape | Right side, mid-height | 480 × 680 px, right: 100, bottom: 120 |

The bottom 92 px of the PiP shows a nameplate gradient with `agentName` (bold, 28 px) and `agentRole` (muted, 18 px) over a dark scrim.

Styling: `borderRadius: 32`, glassmorphism border (`rgba(255,255,255,0.38)`), large drop shadow.

---

### 7. Composition Registration Gap

**The composition IDs `HybridCollectionNoticeLandscape` and `HybridCollectionNoticePortrait` are not currently registered in either `Root.jsx` or `Root.tsx`.**

`Root.jsx` (loaded by `index.jsx` / `registerRoot`) registers: `main`, `PaymentLinkGuidanceTemplate`, `TVSCreditEMITemplate`, `LoanOfferInteractiveTemplate`, `SceneLoanOfferVideo`, `CollectionReminderVideo`, and per-lead compositions.

`Root.tsx` registers: `LoanReminderVideo`, `CollectionReminderVideo`, `LoanOfferInteractiveTemplate`.

Neither imports or mounts `HybridCollectionNotice`. Attempting to render `HybridCollectionNoticeLandscape` or `HybridCollectionNoticePortrait` via `npx remotion render src/index.jsx` will fail with a "composition not found" error. The compositions need to be added to `Root.jsx` as `HybridCollectionNoticeLandscape` (layout="landscape") and `HybridCollectionNoticePortrait` (layout="portrait") using `calculateMetadata` to accept the runtime `durationInFrames` prop.

---

## Configuration

| Setting | Source | Default |
|---|---|---|
| `ffmpeg` binary | `settings.ffmpeg_binary` / `FFMPEG_BINARY` env | `ffmpeg` |
| `npx` binary | `settings.remotion_npx_binary` / `REMOTION_NPX_BINARY` env | `npx` |
| Browser executable | `settings.remotion_browser_executable` / `REMOTION_BROWSER_EXECUTABLE` env | system default |
| Remotion dir | `settings.remotion_path` / `REMOTION_DIR` env | `<project_root>/Remotion` |
| Output dir (render) | `settings.output_dir` / `DEFAULT_OUTPUT_DIR` env | `<project_root>/output` |
| Public serving dir | `HYBRID_PUBLIC_DIR` (hardcoded) | `/tmp/hybrid-public` |
| Render FPS | Hardcoded | 30 |
| Render timeout | Hardcoded | 900 seconds |

---

## Differences vs. Other Flows

| Aspect | Hybrid PiP / VisionDesk | Standard Remotion (`account_notice`) | Payment Guidance |
|---|---|---|---|
| Avatar | Live HeyGen AI avatar as PiP video | No avatar | No avatar |
| Audio | HeyGen TTS (embedded in avatar MP4) | Azure Neural TTS (separate MP3) | Azure Neural TTS (separate MP3) |
| Render entrypoint | `HybridCollectionNoticePortrait` / `Landscape` | `main` composition | `main` composition |
| Background | Red gradient (portrait) / white+red split (landscape) | Dark `#020817` | White `#f8fafc` |
| Aspect options | Portrait 9:16, Landscape 16:9, or auto | Portrait 9:16 only | Portrait 9:16 only |
| Remotion props delivery | Standalone JSON file (not `leads.json`) | `leads.json` + props file | `leads.json` + props file |
| MongoDB `request_mode` | `hybrid_remotion_avatar_pip` | `remotion` | `remotion` |
| Video title prefix | `VisionDesk - {customer_name}` | Varies | Varies |
