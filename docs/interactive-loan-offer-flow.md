# Interactive Loan Offer — End-to-End Flow

The Interactive Loan Offer is a personalized, interactive video experience delivered via a unique shareable web link. Unlike standard video templates, the viewer can interact with the playing video — selecting a loan amount and tenure, and calling the lender directly — all from within the video player interface.

Accessed via the route: `GET /loan-offer/:video_id`

---

## Dual-URL Delivery Architecture & Production 404 Warning

Unlike standard video templates that return a single video link, the Interactive Loan Offer system utilizes a **dual-URL delivery model**:

1. **`video_url` (S3 link)**: Points directly to the raw rendered `.mp4` video stored in the Amazon S3 bucket.
   * *Example*: `https://vishvarupa-dev.s3.amazonaws.com/videos/6a0eb075b7ecb6342178e3a4.mp4`
   * *Purpose*: This file only contains the raw background animation and voice narration. It does NOT contain any overlays, dropdown sliders, pause behaviors, or interaction capabilities. If opened directly in a browser or VLC player, it behaves like a normal passive video.
2. **`interactive_url` (Frontend link)**: The user-facing shareable link that routes to the React application's interactive page.
   * *Example*: `https://vishvarupa.credresolve.com/loan-offer/6a0eb075b7ecb6342178e3a4`
   * *Purpose*: This page loads the interactive framework (`InteractiveLoanOffer.tsx`), loads the raw background video from S3 via the API, parses the word-by-word subtitle timings, overlays the HTML selection cards/CTAs, tracks user events, and manages the interactive play/pause loops.

### Why do I see a 404 on the production domain for interactive videos, but other videos work normally?

Because the **database and SQS queues are shared between the local and production environments**, when you test or trigger a video generation locally:
1. The backend queues the video, generates it, uploads the raw `.mp4` to the S3 bucket, and marks the DB record status as `completed`.
2. When querying the status, the backend builds the `interactive_url` using the target domain (e.g., `vishvarupa.credresolve.com`).
3. Standard videos work fine on the production domain because they are accessed as direct S3 `.mp4` links (e.g., via the `video_url`).
4. **However**, the interactive video requires the React routing system (`/loan-offer/:id`) to be present on the web server. If you have not yet built and deployed the updated React frontend code (which includes the new page route and styling for `InteractiveLoanOffer.tsx`) to the production web server, the web server's routing does not recognize the `/loan-offer/...` path and returns a `404 Not Found`.

**Resolution**: Rebuild and deploy the frontend React app onto your production server (e.g., run `npm run build` and update the production bundle on the EC2 or CDN). Once deployed, the interactive web link will resolve and function correctly in production.

---

## Overview

| Property | Value |
|---|---|
| Template key | `loan_offer_interactive` |
| Video type | `remotion` |
| Render format | `.mp4` (Remotion → ffmpeg) |
| Interactive player | React page (`InteractiveLoanOffer.tsx`) |
| Public route | `/loan-offer/:id` (no login required) |
| API endpoint | `GET /api/interactive/loan-offer/:id` |

---

## Architecture

The interactivity is achieved by layering HTML overlays on top of an HTML5 `<video>` element, **not** by using a special video format. The raw video is a standard `.mp4` file. The React page listens to the video's playback time (`timeupdate` event) and pauses the video at dynamically-computed timestamps, then renders interactive cards/buttons on top.

```
Browser (React)
  └── <video src="...mp4" />          ← Standard MP4 plays in background
       └── HTML Overlays (absolute)
            ├── Play button (before start)
            ├── "Call Now" pill (during playback)
            ├── "Avail Now" button (at introEndSeconds)
            ├── Loan selector card (at selectorEndSeconds)
            └── "Call" + "Replay" buttons (after video ends)
```

---

## End-to-End Flow

### 1. Frontend — Video Generation

The video is generated through the standard 6-step creation wizard:

- **Video type**: `remotion`
- **Template key**: `loan_offer_interactive`
- **Video variety**: `personalized`
- **Required fields**: `customer_name`, `client_name`, `loan_offer` data (amounts, EMIs per tenure), `cta_phone_number`, `primary_color`, `secondary_color`, `language`, `voice_gender`

`generateRemotionVideo()` in `Frontend/src/lib/api.ts` submits all fields as multipart FormData to `POST /api/generate/remotion`.

---

### 2. Backend — Job Worker & Subtitle Persistence

`RemotionJobWorker` in `app/workers/remotion_job_worker.py`:

1. Calls `RemotionService.generate_video()` which:
   - Runs `edge-tts` to generate `{video_id}.mp3` and `{video_id}.vtt`
   - Parses the VTT file into a `subtitles` array (`[{text, start, end}]`)
   - Renders the Remotion composition to `{video_id}.mp4`
   - Returns `video_path`, `subtitles`

2. On success, saves to MongoDB video document:
   ```json
   {
     "video_url": "/output/{video_id}.mp4",
     "subtitles": [{ "text": "...", "start": 2.1, "end": 4.5 }, ...]
   }
   ```

The `subtitles` array is critical for frontend synchronization (see Dynamic Synchronization below).

---

### 3. Backend — API Route

`GET /api/interactive/loan-offer/{video_id}` in `app/main.py`:

Returns a JSON payload with all fields needed for the interactive player:

```json
{
  "video_url": "https://...s3.../output/{video_id}.mp4",
  "customer_name": "Ramesh Kumar",
  "client_name": "CredResolve",
  "primary_color": "#053666",
  "secondary_color": "#f5a623",
  "contact_details": "1800-555-999",
  "loan_offer": {
    "cta_phone_number": "1800-555-999",
    "max_loan_amount": "120000",
    "max_tenure": "60",
    "month_24_loan_amount": "80000",
    "emi_calculation24": "3800",
    ...
  },
  "subtitles": [
    { "text": "Congratulations Ramesh Kumar", "start": 0.5, "end": 2.3 },
    { "text": "select your preferred tenure", "start": 10.8, "end": 13.2 },
    ...
  ]
}
```

---

### 4. Remotion — `LoanOfferInteractiveTemplate`

Located at `Remotion/src/templates/LoanOfferInteractiveTemplate/`.

#### `types.ts`
Defines `LoanOfferInteractiveProps` and `StepBoundaries`:
```ts
type StepBoundaries = {
  introEnd: number;   // frame where "Avail Now" should appear
  selectorEnd: number; // frame where loan selector should appear
};
```

#### `index.tsx`
The main Remotion composition. Uses `stepBoundaries` to dynamically switch between three visual segments:
- **Segment 1 (0 → introEnd)**: Welcome / offer reveal
- **Segment 2 (introEnd → selectorEnd)**: Tenure selection instructions
- **Segment 3 (selectorEnd → end)**: Confirmation / outro

Boundaries are computed from subtitle phrase detection via `TemplateVideo.jsx`'s `findSubtitleStart()` helper, ensuring the visual cuts match the voiceover timing exactly.

---

### 5. Frontend — Dynamic Synchronization (Key Fix)

The core problem that was fixed: **hardcoded pause timestamps caused audio/video desync** because `edge-tts` voice duration varies depending on the customer name, numbers, and language.

**Fix**: The frontend now computes pause times dynamically by scanning the `subtitles` array fetched from the API.

#### `findSubtitleStart()` helper (`InteractiveLoanOffer.tsx`)
```ts
function findSubtitleStart(subtitles, phrase): number | null {
  const hit = subtitles.find(s => s.text.toLowerCase().includes(phrase));
  return hit?.start ?? null;
}
```

#### Dynamic threshold computation:
```ts
// Intro end: when voiceover says "select your preferred tenure"
const introEndSeconds = 
  findSubtitleStart(subs, "select your") ||
  findSubtitleStart(subs, "preferred")  ||
  findSubtitleStart(subs, "पसंद की")   ||  // Hindi fallback
  findSubtitleStart(subs, "अवधि")       ||  // Hindi fallback
  10.8;                                       // safe default

// Selector end: when voiceover says "our team will assist you"
const selectorEndSeconds = 
  findSubtitleStart(subs, "our team")   ||
  findSubtitleStart(subs, "assist")     ||
  findSubtitleStart(subs, "हमारी टीम") ||  // Hindi fallback
  findSubtitleStart(subs, "मदद")        ||  // Hindi fallback
  22.0;                                       // safe default
```

#### `timeupdate` listener:
```ts
const onTimeUpdate = () => {
  const time = video.currentTime;

  // Pause and show "Avail Now" button
  if (time >= introEndSeconds - 0.2 && !showAvail && !hasDismissedAvail) {
    setShowAvail(true);
    video.pause();
  }

  // Pause and show loan selector card
  if (time >= selectorEndSeconds - 0.2 && !showSelector && !hasDismissedSelector) {
    setShowSelector(true);
    video.pause();
  }
};
```

The `0.2` second lookahead buffer compensates for `timeupdate` polling granularity on mobile browsers.

---

### 6. Frontend — Interactive Player UI

**Route**: `/loan-offer/:id` → `InteractiveLoanOffer.tsx`

The player is a two-column layout on desktop, single column on mobile:
- **Left**: The phone-frame video player with all overlays
- **Right**: Summary panel showing selected amount, tenure, EMI

#### Overlay States

| State | Condition | Overlay shown |
|---|---|---|
| Not started | `!hasStarted` | ▶ Play button centered |
| Playing | `hasStarted && !hasEnded` | 📞 "Call Now" pill (top-right) |
| Intro pause | `showAvail` | ✅ "Avail Now" button (bottom) |
| Selector pause | `showSelector` | 📋 Loan selector card (bottom) |
| Video ended | `hasEnded` | 📞 "Call" + 🔄 "Replay" buttons (bottom) |

#### Loan Selector Card
Shown when video pauses at `selectorEndSeconds`. Contains:
- **Loan Amount** dropdown — lists all unique amounts from `loan_offer` data
- **Tenure** dropdown — filtered by selected amount
- **Summary tiles** — Amount / Tenure / EMI at a glance
- **Confirm Loan Offer** button — resumes video and records the event

#### Event Tracking
All user interactions are recorded via `recordInteractiveLoanOfferEvent()`:

| Action | Trigger |
|---|---|
| `play` | User taps the play button |
| `avail_now` | User taps "Avail Now" |
| `confirm_loan_offer` | User taps "Confirm Loan Offer" (with selected row) |
| `call_now` | User taps any "Call" button |

---

## Supported Offer Data Fields

The `loan_offer` object in the API response maps directly to the dropdown options in the player:

| Field | Description |
|---|---|
| `month_{N}_loan_amount` | Loan amount for tenure N months (N = 24, 30, 36, 42, 48, 60) |
| `emi_calculation{N}` | EMI amount for tenure N months |
| `max_loan_amount` | Fallback max amount if per-tenure fields are missing |
| `max_tenure` | Fallback max tenure |
| `max_emi` | Fallback EMI |
| `cta_phone_number` | Phone number for "Call Now" button (overrides `contact_details`) |

---

## Branding

The interactive player uses CSS custom properties driven by the video's brand colors:

```tsx
<main style={{ "--brand": brandColor, "--accent": accentColor }}>
```

| Variable | Source field | Usage |
|---|---|---|
| `--brand` / `brandColor` | `primary_color` | "Confirm" button, selector card header |
| `--accent` / `accentColor` | `secondary_color` | "Avail Now", "Call" buttons, CheckCircle icon |

---

## Files Changed

### Remotion (Video Composition)

| File | Change |
|---|---|
| `Remotion/src/templates/LoanOfferInteractiveTemplate/types.ts` | Added `StepBoundaries` type; mapped dynamic frame boundaries |
| `Remotion/src/templates/LoanOfferInteractiveTemplate/index.tsx` | Used `stepBoundaries` to dynamically split composition into 3 segments |
| `Remotion/src/TemplateVideo.jsx` | Added `findSubtitleStart()` helper; computed dynamic `durationInFrames` from subtitle keyword detection |

### Backend

| File | Change |
|---|---|
| `app/services/remotion_service.py` | `generate_video()` now returns parsed `subtitles` array from VTT |
| `app/workers/remotion_job_worker.py` | Saves `subtitles` array to MongoDB on job completion |
| `app/main.py` | `GET /interactive/loan-offer/{id}` now includes `subtitles` in response |

### Frontend

| File | Change |
|---|---|
| `Frontend/src/lib/api.ts` | Added `subtitles` field to `InteractiveLoanOffer` type |
| `Frontend/src/pages/InteractiveLoanOffer.tsx` | Added `findSubtitleStart()`; dynamic `introEndSeconds` / `selectorEndSeconds`; replaced hardcoded 8.5s/18.5s pauses; moved "Call" and "Replay" buttons into video overlay; added "Call Now" persistent pill during playback; added end-of-video overlay with "Call" + "Replay" buttons |

---

## Known Limitations

| # | Issue | Status |
|---|---|---|
| 1 | Subtitle phrase detection falls back to hardcoded defaults (10.8s / 22.0s) if the voiceover script changes significantly | Open — add a wider set of fallback phrases per language |
| 2 | `timeupdate` fires at ~250ms intervals on some mobile browsers, so the pause can trigger up to 0.25s after the threshold | Mitigated by the `0.2s` lookahead — acceptable tolerance |
| 3 | The "Call Now" button in the top-right makes a `tel:` call, which only works natively on mobile. On desktop it opens a prompt (e.g. FaceTime/Skype) | By design — the primary audience is mobile users |
| 4 | If the viewer downloads the raw `.mp4` file and plays it in VLC / QuickTime, the interactive overlays are not present | By design — interactivity requires the web player |

---

## Differences vs. Standard Video Templates

| Aspect | Standard Template (e.g. Payment Guidance) | Interactive Loan Offer |
|---|---|---|
| Delivery | MP4 shared as a link | Web player at `/loan-offer/:id` |
| User input | None — passive viewing | Tenure/amount selection, call CTA |
| Video pauses | Never | At two dynamic timestamps |
| Overlays | Burned into video frames | HTML elements over HTML5 `<video>` |
| Sync method | Static frame count in Remotion | Dynamic subtitle phrase detection |
| Auth required | Depends on share URL | No — public route, no login |
| Event tracking | None | `recordInteractiveLoanOfferEvent()` on each action |
