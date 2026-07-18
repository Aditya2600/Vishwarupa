# Integrating Avataar Varya into the Migration Plan (June 2026)

Companion to [oss-migration-plan.md](oss-migration-plan.md) and
[oss-heygen-alternatives-research.md](oss-heygen-alternatives-research.md). Those
docs scoped the HeyGen replacement around **audio-driven avatar models**. This
doc evaluates **Avataar Varya** — launched June 2026 under the IndiaAI Mission —
and places it precisely in (and out of) that plan.

---

## TL;DR

- **Varya is a text/image → video generative model** (a 14B distilled
  **Wan 2.2**), culturally tuned for India. It is **not** an audio-driven
  lip-sync / talking-head engine.
- It is therefore **not a 1:1 HeyGen replacement**. HeyGen's core job —
  script/audio + avatar identity → lip-synced presenter — is something Varya
  does not do.
- It **is a strictly better pick than the raw Wan 2.2** already named in
  [oss-migration-plan.md](oss-migration-plan.md) Track B (per-scene assets +
  cinematic tier): ~10× faster, ~20× cheaper, open-weight, and tuned for the
  exact Indic / festival / payments content this repo generates.
- It can also participate in the avatar path only via a **hybrid composite**
  (Varya generates the presenter visual → a lip-sync model drives the mouth from
  TTS audio).

**Recommended first step:** adopt Varya as the **Track B engine** (hosted API,
no GPU ops). Treat the hybrid talking-head as a later, optional experiment.

---

## What Varya actually is

| Attribute | Varya |
|---|---|
| Type | Text-to-video + image-to-video (reference image) generative model |
| Base | Distilled **Wan 2.2** (14B), 4 inference steps vs Wan's 50 |
| Audio-driven lip-sync | **None** |
| Output (documented) | 720p, ~5-second clips |
| Speed | 5s / 720p clip in ~45s on a single **NVIDIA H200** |
| Cost (hosted) | ~₹0.48 / $0.005 per second (vs $0.10+/sec for Veo/Kling/Luma/Runway) |
| Licensing | Open-weight on India's **AIKosh** portal (with training data); hosted API + enterprise access |
| Cultural tuning | Indian festivals, food, clothing, architecture, public spaces |
| Demo | `varya.avataar.ai` |

### Varya vs HeyGen — different tasks

| | HeyGen (being replaced) | Varya |
|---|---|---|
| Task | audio/script + avatar → **lip-synced talking presenter** | text/image → **generic video clip** |
| Input | script/audio + `avatar_id` | text prompt or reference image |
| Lip-sync | ✅ core | ❌ none |
| Output | talking head | short cinematic/scene clip |

This single distinction is why Varya lands in Track B, not Track A.

---

## Architecture 1 — Varya as the Track B engine *(recommended)*

[oss-migration-plan.md](oss-migration-plan.md) Track B (B2 per-scene assets, B5
cinematic tier) already names **Wan 2.2** for `image` / `broll` generation and
the cinematic profile. Varya *is* a distilled, India-tuned Wan 2.2 — swap the
engine, keep the architecture. This touches the **Remotion enrichment** path,
not the avatar path, so the public API contract is untouched.

```
script ──► script_to_scenes.py (LLM) ──► scene graph (MongoDB)
                                            │
              ┌─────────────────────────────┼───────────────────────┐
          text_card                       image / broll           avatar_inset
       (Remotion native)             VARYA (T2V / I2V)          Track A pipeline
                                  via SCENE_ASSET_SQS_QUEUE_URL       │
                                            │                         │
                                       S3 (vishvarupa)  ──────────────┘
                                            │
                              Remotion SceneSequence compositor ──► final mp4
```

- New `app/services/scene_asset_service.py` dispatches scene jobs to a
  `VaryaBackend` (hosted API first; self-hosted H200 worker later).
- Cache by prompt-hash → S3 key, exactly as B2 specifies.
- **Why it wins here:** for this repo's Hindi/Indic/festival/PhonePe/loan-offer
  content, Varya's cultural tuning is a genuine *quality* edge over raw Wan 2.2,
  on top of the cost/speed advantage.

---

## Architecture 2 — Hybrid talking-head *(optional)*

Because Varya has no lip-sync, the only way it touches the avatar path is a
**two-stage composite**: Varya animates the presenter visual, then a lip-sync
model (MuseTalk / LatentSync 2) drives the mouth region from the TTS audio.

```
reference portrait ──► VARYA I2V ──► presenter clip (no mouth sync)
TTS audio (Chatterbox / XTTS) ─────────────┐
                                           ▼
                            MuseTalk / LatentSync 2  (mouth region)
                                           │
                                           ▼
                                    lip-synced avatar mp4
```

- Implement as `app/services/avatar_backends/varya_hybrid.py` behind the
  existing `AvatarBackend` Protocol; `submit()` chains Varya → lip-sync in one
  GPU worker.
- **Trade-offs:** extra latency, identity drift at the stitch, quality ceiling
  below a purpose-built audio-driven model.
- **Use only** when you want a *moving, scene-rich* presenter rather than a
  static-background bust. For pure talking-head, **HunyuanVideo-Avatar /
  MuseTalk remain the Track A picks.**

---

## How it bolts into this repo

Reuse the abstractions [oss-migration-plan.md](oss-migration-plan.md) already
defines — no re-architecture.

### 1. Backend interface

Add a scene-asset backend (Architecture 1) and/or an avatar backend
(Architecture 2) behind the Protocol patterns from Track A1:

```python
# app/services/scene_asset_backends/base.py
class SceneAssetBackend(Protocol):
    def generate(self, prompt: str, *, ref_image_url: str | None = None,
                 duration_s: float = 5.0) -> str: ...   # returns S3 url
    def supports_image_to_video(self) -> bool: ...
```

```python
# app/services/scene_asset_backends/varya.py
class VaryaBackend:
    """Hosted Avataar Varya (T2V / I2V). Swap to self-hosted H200 worker later."""

    def __init__(self, settings):
        self._api_key = settings.VARYA_API_KEY
        self._base_url = settings.VARYA_BASE_URL   # e.g. varya.avataar.ai API

    def generate(self, prompt, *, ref_image_url=None, duration_s=5.0) -> str:
        # 1. POST prompt (+ optional ref image) -> provider job id
        # 2. poll until done -> provider video url
        # 3. download, re-upload to the `vishvarupa` S3 bucket, return our url
        ...

    def supports_image_to_video(self) -> bool:
        return True
```

### 2. Feature flags

Extend the existing env-flag pattern; default off until parity is proven:

- `SCENE_ASSET_BACKEND={none|varya|wan}` — selects the B2 engine.
- `REMOTION_PROFILE=cinematic` — routes B5 clips through Varya.
- `VARYA_API_KEY`, `VARYA_BASE_URL` — hosted credentials (add to
  [`.env.example`](../.env.example) and `app/config.py`).

### 3. Worker + queue

Mirror [`app/workers/job_worker.py`](../app/workers/job_worker.py):
a Varya worker pulling from `SCENE_ASSET_SQS_QUEUE_URL`, writing outputs to the
`vishvarupa` S3 bucket and the URL back to MongoDB. **Start with the hosted API
(zero GPU ops)**; only stand up a self-hosted H200 node once the open weights
are published on AIKosh and volume justifies it.

### 4. Phasing

| Step | Work | Effort | Notes |
|---|---|---|---|
| 1 | `SceneAssetBackend` + `VaryaBackend` (hosted) | ~1 d | on top of B1/B2 |
| 2 | Wire into `scene_asset_service.py` (B2) | ~1–2 d | `broll` + `image` scene types |
| 3 | `REMOTION_PROFILE=cinematic` via Varya (B5) | ~1 d | premium tier |
| 4 | *(optional)* `varya_hybrid` avatar backend | spike | needs lip-sync layer + GPU |
| 5 | *(optional)* self-host weights on H200 | — | gated on AIKosh release |

---

## Caveats

- **Open-weight timing.** Weights are *slated* for AIKosh with training data, but
  confirm they're actually published before planning self-host — until then you
  depend on the hosted API.
- **No native audio-drive.** Confirmed. Any talking-head use needs the lip-sync
  layer in Architecture 2.
- **Spec gaps.** Public specs only confirm 720p / ~5s clips on H200. Max clip
  length, higher resolutions, and I2V controllability are undocumented — pilot
  before fleet-wide use (same posture as the XTTS-Hindi caveat in the migration
  plan).
- **Cultural fit is the real edge.** For this repo's Hindi/Indic, festival, and
  India-payments content, Varya's tuning is where it beats raw Wan 2.2 on
  *quality*, not just cost.

**Bottom line:** use Varya to *upgrade Track B* (it's a better Wan 2.2) and
optionally as the visual stage of a *hybrid* avatar. Do **not** treat it as a
1:1 HeyGen replacement — that role still belongs to an audio-driven model
(HunyuanVideo-Avatar / MuseTalk).

---

## Sources

- [Cheaper, faster, and culturally aware — Avataar's Varya | TechCrunch](https://techcrunch.com/2026/06/11/cheaper-faster-and-culturally-aware-avataars-video-ai-is-built-for-indias-scale/)
- [Avataar Launches Varya, India's First Distilled Video AI Model | Outlook Business](https://www.outlookbusiness.com/deeptech/avataar-launches-varya-indias-first-distilled-video-ai-model-under-indiaai-mission)
- [Peak XV backed Avataar launches Varya | Business Today](https://www.businesstoday.in/technology/artificial-intelligence/story/peak-xv-backed-avataar-launches-indigenous-video-model-varya-bets-on-low-cost-ai-video-generation-536488-2026-06-12)
- [India's MeitY Launches Varya AI Video Model | Free Press Journal](https://www.freepressjournal.in/tech/india-launches-varya-ai-video-model-heres-what-it-does-how-to-use-it)
- [Avataar.ai launches indigenous video model Varya | ANI News](https://www.aninews.in/news/business/avataarai-launches-indigenous-video-model-varya-to-drive-cost-efficient-ai-accessibility-across-india20260612123332/)
</content>
</invoke>
