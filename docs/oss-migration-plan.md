# Migration Plan: Beyond HeyGen + Smarter Remotion

Companion to [system-design-improvements.md](system-design-improvements.md) and
[fault-tolerance.md](fault-tolerance.md). Those cover scaling and durability of
the current stack. This one covers swapping the **engines** underneath:

- **Track A** — replace the HeyGen API with self-hosted open-source avatar models.
- **Track B** — turn Remotion from a text+subtitle compositor into a multi-scene,
  AI-asset-driven compositor.

Both tracks reuse the existing SQS + worker + S3 + MongoDB skeleton. The public
FastAPI surface (`/generate/direct`, `/generate/template`, `/generate/remotion`,
`/videos/{id}/status`) stays unchanged through the entire migration.

---

## Messaging architecture decision: SQS stays, Kafka is not the right tool

**Decision:** Keep AWS SQS as the job queue. Do not replace or supplement it with
Kafka for the generation pipeline.

### Why SQS fits this workload

Each message is one heavyweight unit of work: render a video. A worker claims it,
spends 30s–10 minutes on it, uploads to S3, and deletes the message. This is the
textbook **task queue** pattern — competing consumers pulling independent jobs —
not an event stream.

SQS provides the exact primitives the fault-tolerance design depends on:

| Requirement | SQS | Kafka |
|---|---|---|
| Per-message visibility timeout (redelivery on crash) | Native | None — offset-based only |
| Dead Letter Queue for poison messages | Native | Must be built manually |
| `maxReceiveCount` retry counter | Native | Must be built manually |
| Ack/delete a single finished job | Native | Requires offset management |
| Autoscale on queue depth (CloudWatch → ASG/ECS) | Native metric | Needs KEDA or custom exporter |
| Priority lanes (interactive vs batch) | Separate FIFO queues | Partitions don't model priority |

### Why Kafka actively hurts here

1. **Head-of-line blocking.** Kafka parallelism is capped at partition count and
   partitions are strictly ordered. One 10-minute Hunyuan render blocks every job
   behind it in that partition. SQS has no ordering constraint — any free worker
   grabs any message. With 20× variance in job duration, this is the dealbreaker.

2. **No per-message lifecycle.** Kafka cannot make one message reappear after a
   120s visibility timeout. The atomic-claim + reaper + DLQ design in
   [fault-tolerance.md](fault-tolerance.md) §3.1 and §3.6 is built on at-least-once
   redelivery with per-message acks — a model Kafka discards.

3. **Ops weight is disproportionate.** This is a single FastAPI process with two
   in-process workers. Kafka requires brokers, KRaft/Zookeeper, partition
   rebalancing, and retention tuning. SQS is zero-ops and pay-per-request. The
   real bottlenecks are webpack re-bundling and CPU-bound renders
   ([system-design-improvements.md](system-design-improvements.md) §0), not message
   throughput.

Kafka is the right tool for millions of small ordered events per second with
replay (clickstreams, log pipelines). Video generation jobs are thousands per day
of minutes-long work. Wrong shape.

### Where a stream does fit later

[system-design-improvements.md](system-design-improvements.md) §4.8 describes
interactive CTA engagement signals (Continue → Proceed → Call) feeding a
next-best-action model. That *is* an event stream: high-volume, append-only,
multiple independent consumers (real-time dashboard + batch ML training) replaying
the same log.

If that analytics loop is built, use **AWS Kinesis** first — same zero-ops
footprint, same IAM/S3 wiring already in place. Only justify Kafka if Kinesis
limits are hit. Add it as a *separate* path alongside SQS, never as a replacement.

---

## Guiding principles

1. **Never break the API contract.** Only the workers and their service-layer
   dependencies change.
2. **Feature-flag every backend.**
   - `AVATAR_BACKEND={heygen|musetalk|hunyuan}`
   - `TTS_BACKEND={edge|chatterbox|xtts}`
   - `REMOTION_PROFILE={text|enriched|cinematic}`
   - Default to current behavior until parity is proven.
3. **Cheap-fast tier first, quality tier second.** Don't block on a perfect
   avatar model when 80% of jobs need MuseTalk-class speed.
4. **One worker, one model.** Avoid mixing model loads across processes — GPU
   memory fragmentation kills throughput.
5. **Keep Remotion as the compositor.** Don't replace it with end-to-end AI
   video. Use AI models to *generate scene assets* that Remotion lays out
   deterministically. You get brand consistency + speed + AI quality together.

---

## Why open-source, why now

| Layer | Current | Replacement | Why |
|---|---|---|---|
| Avatar video | HeyGen API ([`app/services/heygen_client.py`](../app/services/heygen_client.py)) | HunyuanVideo-Avatar (quality) + MuseTalk (fast) | Self-hosted, no per-minute cost, lipsync-on-Indic, data residency. |
| TTS | `edge-tts` subprocess in [`remotion_service.py`](../app/services/remotion_service.py) and [`audio_service.py`](../app/services/audio_service.py) | Chatterbox (EN) + XTTS-v2 (Hindi/Indic) | Truly self-hosted, voice cloning from 6-sec sample, MIT-licensed. |
| Text-to-video | Remotion with one `TemplateVideo.jsx` scene | Remotion scene-sequence fed by an LLM-generated scene graph + AI assets | Cinematic variety while keeping deterministic brand templating. |

Reference research and the broader model landscape is recorded in the
conversation history that produced this plan; the picks above are the
production-ready subset, not the full field.

---

## Track A — HeyGen → self-hosted avatars

### A1. Avatar backend abstraction *(0.5 day, no model change)*

Goal: make `VideoService` and `AvatarJobWorker` model-agnostic.

- New `app/services/avatar_backends/base.py`:
  ```python
  class AvatarBackend(Protocol):
      def submit(self, req: DirectVideoRequest) -> str: ...      # provider job id
      def poll(self, job_id: str) -> JobStatus: ...              # status + maybe url
      def list_avatars(self) -> list[AvatarMeta]: ...
      def list_voices(self) -> list[VoiceMeta]: ...
  ```
- Move existing HeyGen logic out of [`app/services/video_service.py`](../app/services/video_service.py)
  into `avatar_backends/heygen.py` implementing this Protocol.
- `VideoService` becomes a thin dispatcher that picks the backend by env flag.
- [`app/workers/job_worker.py`](../app/workers/job_worker.py) keeps
  its SQS loop; the only change is `backend = get_backend(settings.AVATAR_BACKEND)`.
- Add a `meta` registry so `/meta/avatars` and `/meta/voices` work for OSS
  backends (which have no remote catalog — return a static list from config).

**Exit criteria:** `AVATAR_BACKEND=heygen` still works exactly like today. Tests
in [`tests/`](../tests/) still pass.

### A2. Tier-1 backend — MuseTalk (fast path) *(2–3 days)*

Why first: MuseTalk gives ~real-time inference on a single 8 GB GPU. Right cost
profile for the **Talking-PDF** flow (short clips, one face). Cheapest way to
get HeyGen out of the loop.

- New `app/services/avatar_backends/musetalk.py`. Takes a reference avatar image
  + audio, returns mp4.
- New `app/workers/musetalk_worker.py` mirroring the existing avatar worker but
  holding a warm GPU model. Reads from a dedicated `MUSETALK_SQS_QUEUE_URL` so
  this tier scales independently.
- Avatar assets: ship 4–6 reference portraits as your "avatar library" in
  `app/static/avatars/`. The OSS world doesn't give you HeyGen's catalog — you
  own the catalog now.
- Voice still goes through edge-tts in this phase (TTS swap is A4).
- Containerize: extend [`docker-compose.yml`](../docker-compose.yml) with a
  `musetalk-worker` service that pulls from a GPU base image. EC2 deployment
  needs a GPU node (`g6.2xlarge` minimum).

**Exit criteria:** flip `AVATAR_BACKEND=musetalk` in staging, generate 20 PDF
talking-head videos, eyeball quality, measure p50 latency vs HeyGen.

### A3. Tier-2 backend — HunyuanVideo-Avatar (quality path) *(3–5 days)*

For long-form / brand-facing avatar videos where MuseTalk's face-only animation
looks stiff.

- New `app/services/avatar_backends/hunyuan.py`. Same interface, much higher
  VRAM (24 GB+) and much longer render time (minutes per clip).
- Separate worker + queue + larger GPU node (`g6.12xlarge` or single `p4d`).
- **Routing** lives in `VideoService`: a `quality_tier` field on
  `DirectVideoRequest`, or auto-route by script length. Keep this routing in
  one place so it's easy to tune.
- Optional: also wire **OmniAvatar** as an alternative tier-2 backend (full-body
  animation, slightly lower VRAM). Same interface, ~1 day extra.

**Exit criteria:** Generate the same 10 scripts on HeyGen, MuseTalk, Hunyuan.
Score on (a) lip-sync, (b) identity stability, (c) p95 latency, (d) cost per
minute of output. Pick a cutover threshold per tier.

### A4. TTS backend swap *(2 days)*

Decouple from `edge-tts` (Microsoft-hosted) and unlock voice cloning.

- New `app/services/tts_backends/{base,edge,chatterbox,xtts}.py` with the same
  Protocol pattern as A1.
- **Chatterbox** for English, **XTTS-v2** for Hindi/Indic — your
  `legal_notice_raw_hi.txt` template needs the latter. Both expose zero-shot
  cloning; store reference samples in S3 keyed by `voice_id`.
- Update [`app/services/audio_service.py`](../app/services/audio_service.py)
  and the TTS step inside
  [`app/services/remotion_service.py`](../app/services/remotion_service.py) to
  call through `TTSBackend`.
- [`app/workers/audio_job_worker.py`](../app/workers/audio_job_worker.py) SQS
  contract doesn't change.

**Exit criteria:** Same VTT / MP3 outputs as edge-tts (so Remotion subtitle
parsing keeps working), passable Hindi prosody, ability to clone from a 6-sec
sample.

### A5. Decommission HeyGen *(1 day)*

- Once Tier-1 and Tier-2 cover all production traffic for 2+ weeks: drop
  `HEYGEN_*` env vars from [`.env.example`](../.env.example) and
  `app/config.py`.
- Remove `app/services/avatar_backends/heygen.py` and HeyGen-only fields.
- **Keep** [`app/services/media_styling_service.py`](../app/services/media_styling_service.py)
  — its FFmpeg subtitle/logo overlay is engine-agnostic and still useful.

---

## Track B — Remotion: text-only → enriched scenes

Today, [`Remotion/src/TemplateVideo.jsx`](../Remotion/src/TemplateVideo.jsx)
renders text + subtitles + logo over a flat background. A long script becomes
one wall of words. The fix isn't to throw out Remotion — it's to feed Remotion
a **scene graph** instead of a script blob, with AI-generated visuals per scene.

### B1. LLM-driven scene segmentation *(2 days)*

- New `app/services/script_to_scenes.py`. Input: script + language. Output:
  ```python
  Scene { id, text, voice_segment, visual_prompt, duration_hint, type }
  ```
- Reuse the Grok client from
  [`app/services/llm_clients.py`](../app/services/llm_clients.py) with a prompt
  that:
  1. Splits the script into 5–15 scenes by semantic break (~6–10s each).
  2. Writes a one-line visual prompt per scene (subject + style).
  3. Tags scenes as `text_card | image | broll | avatar_inset`.
- Persist the scene graph in MongoDB alongside the video doc.

**Exit criteria:** A 60-second script becomes a reviewable 10-scene plan,
exposed via a new admin endpoint.

### B2. Per-scene asset generation *(3–4 days)*

For each scene, generate a visual based on its `type`:

| Type | Generator | Notes |
|---|---|---|
| `text_card` | Existing Remotion text component | Free, fast — use for openers / quotes / CTAs. |
| `image` | **FLUX.1-dev** or **SDXL** local, or `fal.ai` if you don't want a GPU | One image per scene; cache by prompt hash. |
| `broll` | **Wan 2.2 I2V** (img→video, 3–5 sec) on a GPU worker, or curated stock library | Run on the same GPU node as Hunyuan; queue separately. |
| `avatar_inset` | The Track-A avatar pipeline rendered at 1/3 width | Picture-in-picture during voiceover sections. |

- New `app/services/scene_asset_service.py` orchestrates per-scene jobs. Each
  asset job goes on SQS (`SCENE_ASSET_SQS_QUEUE_URL`) so Remotion render only
  starts when assets are ready.
- Cache aggressively: prompt-hash → S3 key. Re-renders of the same brand
  template hit cache.

**Exit criteria:** A test script renders with 4 distinct visual scenes (1 text
card, 2 AI images, 1 b-roll clip) instead of one talking-head wall.

### B3. Remotion compositor upgrade *(2–3 days)*

Update [`Remotion/src/`](../Remotion/src/) to consume the scene graph:

- Replace the monolithic `TemplateVideo.jsx` with a `SceneSequence` that takes
  the scene array and renders a `<Series>` of typed scene components:
  `<TextCardScene>`, `<ImageScene>`, `<BRollScene>`, `<AvatarInsetScene>`.
- Add transition primitives: `<Fade>`, `<Slide>`, `<KenBurns>` — Remotion
  supports all of these natively, no new libraries.
- Subtitles stay global (existing `<SubtitleBox>` is fine), but anchor them to
  the audio timeline rather than per-scene to avoid jitter.
- [`Remotion/src/videoData.js`](../Remotion/src/videoData.js) reads a
  `scenes.json` produced by B1+B2 instead of the current `leads.json` blob.

**Exit criteria:** A 60-second script renders as a sequence of varied scenes
with transitions, in <2× the current Remotion render time.

### B4. Brand template system *(2 days)*

Make the enriched output brand-consistent at scale — this is what HeyGen sells.

- New `app/templates/brands/{brand_id}.json` defining color palette, font
  stack, logo placement rules, default transitions, lower-third style,
  intro/outro templates.
- `scene_asset_service` merges brand config into each scene before handing off
  to Remotion.
- Expose `POST /brands` admin endpoint to upload a brand pack (logo, colors,
  fonts).

**Exit criteria:** Same script renders correctly under two different brand
packs without code changes.

### B5. Optional — pure-AI video tier *(spike, 2 days)*

For users who want cinematic HeyGen-killer output and don't need brand
templating, add a third profile `REMOTION_PROFILE=cinematic` that generates the
entire clip with **Wan 2.2 T2V** instead of compositing scenes. Reuses the
SQS + S3 path. Position as a premium tier — slow and expensive, but matches
what no template-based system can do.

---

## Sequencing & rough effort

| Order | Task | Effort | Depends on |
|---|---|---|---|
| 1 | A1 — backend interface | 0.5 d | — |
| 2 | A4 — TTS interface + Chatterbox | 1 d | A1 pattern |
| 3 | B1 — scene segmentation | 2 d | — (parallel) |
| 4 | A2 — MuseTalk worker | 3 d | A1, GPU node |
| 5 | B2 — per-scene assets | 4 d | B1 |
| 6 | B3 — Remotion compositor v2 | 3 d | B2 |
| 7 | A4 cont. — XTTS for Hindi | 1 d | A4 |
| 8 | A3 — Hunyuan worker | 5 d | A2 |
| 9 | B4 — brand templates | 2 d | B3 |
| 10 | A5 — decommission HeyGen | 1 d | A2+A3 in prod 2 wks |
| 11 | B5 — cinematic spike | 2 d | optional |

**Critical path: ~3 weeks of focused work** to get to "HeyGen turned off +
Remotion produces multi-scene branded video." A1 and B1 are unblockers and
should run in parallel from day one.

---

## Risks worth flagging now

- **GPU ops cost.** A 24-hour idle `g6.12xlarge` is ~$30/day. Build worker
  auto-scaling (SQS depth → ASG) before cutover, or you'll burn cash on idle
  Hunyuan boxes.
- **Avatar identity drift.** OSS models can flicker on long clips. Mitigate by
  capping clip length at 30s and stitching, or stick to MuseTalk for >30s.
- **Indic prosody.** XTTS-v2 Hindi is OK but not great. Pilot it on a real
  `legal_notice_raw_hi.txt` render and have a human grade before fleet-wide
  cutover.
- **Remotion render time** grows with scene count + video assets. Budget 3–5×
  current renders. Pre-render assets in parallel SQS jobs (B2) to hide the
  tail.
- **Don't migrate the API surface yet.** Keep `/generate/direct` etc.
  unchanged. A v2 API can come *after* the engines are stable.

---

## Reference model picks

These are the production-ready picks at time of writing; the broader field is
moving fast — re-evaluate before each phase starts.

**Avatar / lip-sync**
- [HunyuanVideo-Avatar](https://github.com/Tencent/HunyuanVideo) — quality tier.
- [MuseTalk v1.5](https://github.com/TMElyralab/MuseTalk) — fast tier.
- [OmniAvatar](https://github.com/Omni-Avatar/OmniAvatar) — alternative
  quality tier, adds body animation.
- [Hallo2](https://github.com/fudan-generative-vision/hallo2) — long-duration
  portrait, fallback option.

**TTS**
- [Chatterbox](https://github.com/resemble-ai/chatterbox) — EN, MIT.
- XTTS-v2 (community-maintained) — multilingual + Hindi/Indic.
- [F5-TTS](https://github.com/SWivid/F5-TTS) — alternative, very natural
  prosody.

**Video generation (for scene assets / cinematic tier)**
- **[Avataar Varya](varya-integration.md)** — distilled, India-tuned Wan 2.2;
  ~10× faster / ~20× cheaper, open-weight. **Preferred T2V/I2V engine for
  Track B** — see [varya-integration.md](varya-integration.md) for placement,
  architecture, and integration steps.
- [Wan 2.2](https://github.com/Wan-Video/Wan2.2) — cinematic T2V / I2V (the base
  Varya is distilled from; use directly only if Varya weights are unavailable).
- FLUX.1-dev / SDXL — per-scene still images.

**Reference architectures**
- [Linly-Talker](https://github.com/Kedreamix/Linly-Talker) — closest pipeline
  shape to ours (ASR → LLM → TTS → talking-head); useful as a wiring reference,
  not a deployment target.
