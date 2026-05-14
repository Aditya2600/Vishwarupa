# Payment Guidance Flow

Payment Guidance is a customer-facing payment walkthrough video that guides borrowers through completing a TVS Credit loan payment via PhonePe. It is a distinct visual template from the standard account-notice debt collection video — light-themed, non-confrontational, and step-by-step in nature.

Triggered by setting `template_key = 'payment_guidance'` in the request.

---

## End-to-End Flow

### 1. Frontend — Wizard Configuration

The user configures the video through the 6-step wizard (`WizardStore`):

- **Video type**: `remotion`
- **Template key**: `payment_guidance`
- **Video variety**: `personalized` (requires customer name, LAN, client name, TOS/payable amount, contact details)
- **Language**: Any of 9 supported languages (English, Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati, Malayalam)
- **Voice gender**: Male or Female

`generateRemotionVideo()` in `Frontend/src/lib/api.ts` submits all fields as multipart FormData to `POST /api/generate/remotion`, including `template_key: 'payment_guidance'`.

---

### 2. Backend — Request Parsing & Routing

`_parse_remotion_payload()` in `app/main.py` parses the FormData into a `RemotionVideoRequest` model (defined in `app/models.py`). The route then calls `RemotionService.generate_video()`.

`generate_video()` in `app/services/remotion_service.py` orchestrates three steps:
1. TTS generation
2. Scene payload building
3. Remotion render

---

### 3. Backend — `build_payment_guidance_scene_payload()`

Located at `app/services/remotion_service.py:358`.

`build_scene_payload()` checks `request.template_key == 'payment_guidance'` and delegates to `build_payment_guidance_scene_payload()` instead of the standard account-notice builder.

Copy is available in English and Hindi; other languages fall back to English.

| Scene key | Content |
|---|---|
| `opening` | "{Customer}, here is how to complete your payment" + client name + LAN |
| `account` | Account number, payable amount, badge "Personalized guidance" |
| `context` | "Follow these simple steps" + full PhonePe step-by-step body text |
| `amounts` | Loan amount + "Check details before confirming" note |
| `action` | "Open PhonePe and pay" headline + contact CTA |
| `closing` | "Payment support is available" + contact body |

The `ui_copy` keys are overridden with payment-specific labels:

| Standard key | Payment Guidance override |
|---|---|
| `formalNotice` | "Payment Guidance" |
| `financialHighlights` | "Payment Amount" |
| `immediateNextStep` | "PhonePe Walkthrough" |
| `resolutionStillPossible` | "Support Available" |

---

### 4. Backend — TTS Generation

`generate_tts()` at `app/services/remotion_service.py:100`:

- Renders the Jinja2 script with customer data substituted (personalized mode — `{{ customer_name }}`, `{{ lan }}`, `{{ tos }}`, etc.)
- Picks the Azure Neural TTS voice via `VOICE_MAP["{Language}-{Gender}"]`
- Runs `edge-tts` subprocess, writing:
  - `Remotion/public/audio/{video_id}.mp3`
  - `Remotion/public/assets/{video_id}.vtt`
- Returns `audio_path`, `vtt_path`, `duration`, and rendered `text`

---

### 5. Backend — Render Payload & `npx remotion render`

`build_render_payload()` assembles the final JSON with:
- `template_key: 'payment_guidance'`
- All lead fields (`customer_name`, `lan`, `client_name`, `tos`, `loan_amount`, `contact_details`)
- `scene_payload` (from step 3)
- `subtitles` (list of `{text, start, end}` parsed from the VTT file)
- `branding` (logo path, primary/secondary colors)

Written to `Remotion/leads.json`. Then `render_video()` executes:

```
npx remotion render src/index.jsx main <output.mp4> --props=props_{video_id}.json
```

10-minute timeout. Props file cleaned up after render.

---

### 6. Remotion — `TemplateVideo` Composition

In `Remotion/src/TemplateVideo.jsx:2329`, the composition checks `lead.template_key === 'payment_guidance'` **before** the standard dark-background render path.

If true, renders `<PaymentGuidanceVideo>` on a white/light background instead of the standard dark `#020817` theme. No `BrandHud`, `ProgressTrack`, or `FloatingOrbs`.

#### `PaymentGuidanceVideo` (line 1947)

Calls `getSceneTimeline()` to proportionally distribute total frames across 6 scenes, then renders:

| Scene | Component | Visual |
|---|---|---|
| 0 | `PaymentWelcomeScene` | "Hi {customer}, here is your payment guide" (left) + summary card with LAN, provider, support number (right) |
| 1 | `PaymentChecklistScene` | 3-card checklist: ① Open payment link/PhonePe ② Keep LAN ready ③ Verify payable amount |
| 2 | `PaymentPhoneScene` | Dark-card split: animated step list (left) + mock phone screen cycling 4 steps with tap indicator (right) |
| 3 | `PaymentSafetyScene` | "Confirm every detail" (left) + 4 verification rows: Provider, LAN, Payable Amount, Help number (right) |
| 4 | `PaymentPhoneScene` | Second pass of the PhonePe walkthrough |
| 5 | `PaymentSupportScene` | Deep-purple screen: "Need help while paying?" + large contact number pill |

Top bar: `PaymentTopBar` — a floating white pill showing "Payment Guidance" / "Reference walkthrough for customers" (purple `#5f259f` brand color).

#### `PaymentPhoneWalkthroughScene` (line 1236)

The interactive PhonePe walkthrough used in scenes 2 and 4.

- **Left panel**: `phoneEyebrow` label, "Open PhonePe and pay" headline, 3-line checklist body text, animated step list (4 rows — number turns to ✓ as step completes, active step gets accent-colored border)
- **Right panel**: Mock phone screen driven by `PHONE_STEP_CONFIG` (defined at line 49), cycling through 4 screen states. Tap indicator is shown only on steps with a non-null `tap` target.

#### `PHONE_STEP_CONFIG` (line 49)

Central config for the phone walkthrough. Each entry controls one step:

| Index | Image | Tap target (display px) | Weight | Notes |
|---|---|---|---|---|
| 0 | `step1.png` | `{x: 231, y: 362}` | 1.0 | PhonePe home → tap "Loan Repayment" |
| 1 | `step2.png` | `{x: 110, y: 111}` | 1.2 | Lender list → tap "TVS Credit" |
| 2 | `step3.png` | `null` | 2.4 | Agreement number entry — no tap (keyboard visible, user is typing LAN) |
| 3 | `step3.png` | `null` | 1.6 | Amount entry — no tap (same screen, narration reads amount) |

**Tap coordinates** are in the rendered phone screen coordinate space (container: 272×502 px). Source images are 739×1600 PNG, displayed with `objectFit: cover` (scale factor ≈ 0.368, ~43 px vertical crop). To re-derive a coordinate: `x_display = x_source × 0.368`, `y_display = y_source × 0.368 − 43`.

**Weights** control relative dwell time per step. `activeIndex` now advances by cumulative weight rather than uniform interpolation, so LAN entry (weight 2.4) and amount entry (weight 1.6) get proportionally longer screen time — matching the TTS which reads digits slowly.

**Tap indicator** is rendered conditionally: steps with `tap: null` show no circle, preventing a misplaced dot on the typing/keyboard screens.

**`tapPulse`** is now fps-aware: `sin((localFrame / fps) × 2π × 1.05)` — pulse speed is consistent at any composition fps.

---

### Multilingual Copy — `PAYMENT_COPY` (line 1500)

All UI strings are defined in `PAYMENT_COPY` inside `TemplateVideo.jsx`. Supported languages: English, Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati, Malayalam.

Each language entry contains:
- `topTitle`, `topSubtitle` — top bar labels
- `welcomeHeadline(name)`, `welcomeBody(client)` — personalized welcome functions
- `checklist` — array of `[title, body]` pairs (3 items)
- `phoneSteps` — 4-item array for the mock phone walkthrough
- `reviewEyebrow/Title/Body` — safety scene copy
- `helpTitle`, `helpBody`, `supportAvailable` — closing support scene copy
- `fallbackSubtitle` — subtitle panel fallback text

---

## Open Issues / Known Limitations

| # | Issue | Location | Status |
|---|---|---|---|
| 1 | `step4.png` missing — Amount entry screen doesn't exist yet; step index 3 falls back to `step3.png`, so no visual change between indices 2 and 3 | `PHONE_STEP_CONFIG[3]` | Open — add a real "amount entry" screenshot |
| 2 | `phoneSteps[2].title` is `'TVS Credit'` across all locales regardless of `lead.client_name` — on-screen step label won't match narration for non-TVS clients | `PAYMENT_COPY.*.phoneSteps` | Open |
| 3 | `PaymentPhoneScene` is rendered twice (timeline[2] and timeline[4]); the second pass replays the full walkthrough but no audio narration corresponds to it at that point | `PaymentGuidanceVideo` line 1911 | Open |
| 4 | `PAYMENT_COPY` is a large static block duplicated for 9 locales inside `TemplateVideo.jsx`; TTS narration lives separately in `Frontend/src/lib/templates.ts` — two sources of truth | `TemplateVideo.jsx:1455`, `templates.ts:120` | Open |
| 5 | `PaymentPhoneWalkthroughScene` accent color is hardcoded `#5f259f` instead of using the lead's urgency-driven `accentColor` | `TemplateVideo.jsx:1810` | Open (intentional PhonePe brand color — add named constant) |
| 6 | Hindi welcome headline appends ` जी` even when `customer_name` is empty, producing leading whitespace | `PAYMENT_COPY.Hindi.welcomeHeadline` | Open |
| 7 | `getDynamicSceneRatios` uses account-notice scene keys; payment_guidance scenes have different copy density | `videoData.js:378` | Open |

---

## Differences vs. Account Notice Template

| Aspect | Account Notice | Payment Guidance |
|---|---|---|
| Background | Dark `#020817`, floating orbs, radial gradients | White `#f8fafc`, plain light gradients |
| Top bar | `BrandHud` (client name + breathing pulse dot) | `PaymentTopBar` (white pill, purple brand) |
| Scene 4 (action) | `ActionScene` (urgency CTA, bouncy contact number) | `PaymentPhoneWalkthroughScene` (4-step phone mock) |
| Scene payload builder | `build_scene_payload()` | `build_payment_guidance_scene_payload()` |
| `ui_copy.formalNotice` | "Formal Notice" | "Payment Guidance" |
| Focus | Debt collection / legal notice | Customer self-service payment assistance |
| Phone mock UI | Not present | PhonePe 4-step mock screen with tap animation |
| Progress track | `ProgressTrack` (6 segments at bottom) | Not present |
| Floating orbs | Present | Not present |
