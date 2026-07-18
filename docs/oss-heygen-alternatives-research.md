# Deep Research: Open-Source HeyGen Alternatives (May 2026)

Snapshot of the open-source AI video / avatar landscape as it stood when this
project was scoped for a HeyGen migration. Companion document to
[oss-migration-plan.md](oss-migration-plan.md) — that plan picks specific
models from this landscape and sequences the migration; this doc explains
*why* those picks, with the full field of options.

The current project uses HeyGen for **audio-driven avatar video generation**
plus a TTS+Remotion fallback ([README.md](../README.md)). Everything below maps
to that architecture.

---

## TL;DR — recommended replacement stack

For a drop-in HeyGen replacement that matches the current architecture (FastAPI
+ SQS workers + S3), wrap a `HeyGenClient`-shaped interface around:

| Layer | Pick | Why |
|---|---|---|
| **Avatar video** | **HunyuanVideo-Avatar** (Tencent) or **OmniAvatar** (audio-driven, full-body) | Tencent's open weights are the strongest non-HeyGen quality today; OmniAvatar is lighter and adds body animation. |
| **Lip-sync (fast path)** | **MuseTalk v1.5** (Tencent) | 30+ FPS on a single GPU, near-photoreal, the practical workhorse for the Talking-PDF flow. |
| **Voice / TTS** | **Chatterbox** (Resemble, MIT) for English; **F5-TTS** or **XTTS-v2** for multilingual + zero-shot cloning | Chatterbox beat ElevenLabs in 64% of blind tests; XTTS-v2 covers 17 languages with a 6-sec sample, which matches the Hindi/Indic needs in this repo. |
| **Orchestration** | Keep existing SQS + worker pattern, swap only the `heygen_client` calls | No re-architecture needed. |

---

## Tier 1 — Full-stack "HeyGen clones" (closest 1:1 fit)

End-to-end systems you can self-host that already bundle avatar + TTS + a UI.
Easiest migration if you want to replace HeyGen wholesale.

1. **HeyGem AI** — [GuijiAI/HeyGem.ai](https://github.com/GuijiAI/HeyGem.ai) —
   explicitly positioned as a free, offline HeyGen clone. Docker-based,
   includes voice cloning + lip-sync. Top of the
   [Show HN open-source HeyGen alternative thread](https://news.ycombinator.com/item?id=43994791).
2. **Duix-Avatar** — [duixcom/Duix-Avatar](https://github.com/duixcom/Duix-Avatar)
   — markets itself as a "truly open-source AI avatar / digital human toolkit
   for offline video generation and digital human cloning." Runs without a
   cloud account.
3. **Linly-Talker** — [Kedreamix/Linly-Talker](https://github.com/Kedreamix/Linly-Talker)
   — modular pipeline: ASR → LLM → TTS → talking-head. Lets you swap each
   layer (Wav2Lip / SadTalker / MuseTalk / ER-NeRF for the face;
   EdgeTTS / GPT-SoVITS / CosyVoice for audio). Closest in spirit to this
   repo's "HeyGen + EdgeTTS + Remotion" wiring.
4. **HeyGenClone** — [BrasD99/HeyGenClone](https://github.com/BrasD99/HeyGenClone)
   — older, simpler reference implementation; useful as a code reference for
   the API shape.

**Recommendation:** Use **Linly-Talker** as a reference architecture, but don't
deploy it as-is — its bundled models are dated. Reuse its pipeline shape and
swap in the Tier 2 models below.

---

## Tier 2 — Best-in-class avatar models (the "engine")

If you only need to replace HeyGen's `/v1/video/generate` step, these are the
SoTA audio-driven avatar models. All self-hostable.

| Model | License | Strength | Min VRAM | Notes |
|---|---|---|---|---|
| **HunyuanVideo-Avatar** (Tencent) | Custom (commercial use OK) | Highest fidelity, identity-stable, broadcast quality | ~24 GB | Built on HunyuanVideo base; weights on HuggingFace. |
| **OmniAvatar** | Apache-2.0-style | Audio-driven full-body (not just head) | ~16 GB | [Omni-Avatar/OmniAvatar](https://github.com/Omni-Avatar/OmniAvatar), Dockerized fork available. |
| **EchoMimic V3** (Ant Group, AAAI 2026) | Apache-2.0 | 1.3 B params, multi-task, low VRAM | ~12 GB | [antgroup/echomimic_v3](https://github.com/antgroup/echomimic_v3) — best size/quality ratio. |
| **Hallo3 / Hallo2** (Fudan) | MIT | High dynamic range portrait, long-duration, 4K | 16–24 GB | [fudan-generative-vision/hallo2](https://github.com/fudan-generative-vision/hallo2). |
| **FantasyTalking** | Open weights | Built on Wan 2.1 DiT, supports cartoon + realistic | 24 GB | Best for stylized avatars. |
| **MuseTalk v1.5** (Tencent) | MIT | Real-time 30+ FPS, face-region only | 8 GB | Right choice when latency matters more than face motion (e.g., Talking-PDF). |
| **LatentSync 2** | Apache-2.0 | Latent-space lip-sync, fast + identity-preserving | 12 GB | Good Wav2Lip successor for dubbing existing footage. |
| **SadTalker / Wav2Lip** | MIT | The classic baselines | 4–8 GB | Use as fallbacks; quality now well behind the diffusion models. |

For a fuller catalog with daily updates, see
[liutaocode/talking-face-arxiv-daily](https://github.com/liutaocode/talking-face-arxiv-daily).

---

## Tier 3 — Voice / TTS layer (replacing the edge-tts dependency)

Current code uses `edge-tts` (Microsoft-hosted, not truly self-hosted) — see
[`app/services/remotion_service.py`](../app/services/remotion_service.py) and
[`app/services/audio_service.py`](../app/services/audio_service.py). Open-source
picks:

- **Chatterbox** (Resemble AI, MIT) —
  [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox). 23
  languages, zero-shot voice cloning, top of HuggingFace TTS trend list.
  **Use as primary.**
- **XTTS-v2** (Coqui) — 17 languages, clones from 6-sec sample. Project
  orphaned but community-maintained. Strong Hindi support — relevant given the
  `legal_notice_raw_hi.txt` template.
- **F5-TTS** — flow-matching architecture, very natural prosody, MIT.
- **CosyVoice 2** (Alibaba) — strongest Mandarin + good multilingual; bundled
  in Linly-Talker.
- **GPT-SoVITS** — best-in-class for low-resource voice cloning from a few
  seconds of reference.

---

## Tier 4 — Base video models (for building a custom avatar pipeline)

For text/image-to-video as a backbone (replaces Remotion for cinematic output,
not just avatars):

- **Wan 2.2** ([Wan-Video/Wan2.2](https://github.com/Wan-Video/Wan2.2)) —
  currently the most cinematic open-source video model. 1.3 B variant runs on
  8 GB VRAM, 14 B on 24 GB.
- **HunyuanVideo** — the base model under HunyuanVideo-Avatar; useful for
  general I2V.
- **LTX-Video** — fastest inference, lower quality ceiling.
- **Wan2GP** ([deepbeepmeep/Wan2GP](https://github.com/deepbeepmeep/Wan2GP))
  — "Wan for the GPU poor" wrapper, runs Wan/Hunyuan/LTX/Flux on consumer
  cards.

---

## Migration plan for *this* repo

Concrete steps to swap HeyGen out without disturbing the rest of the stack
([`app/main.py`](../app/main.py),
[`app/services/sqs_service.py`](../app/services/sqs_service.py), worker layout).
The full sequenced plan with exit criteria per phase is in
[oss-migration-plan.md](oss-migration-plan.md); a summary:

1. **Introduce an `AvatarBackend` interface** alongside the existing HeyGen
   client. Methods: `submit(script, voice_id, avatar_id) → job_id` and
   `poll(job_id) → status, video_url`. Keep `/generate/direct` and
   `/generate/template` API contracts intact.
2. **First backend: `MuseTalkBackend`.** Wrap MuseTalk in a worker that mirrors
   `AudioJobWorker`: pulls from a new `AVATAR_SQS_QUEUE_URL`, generates locally,
   uploads to the `vishvarupa` S3 bucket, writes the URL back to MongoDB.
   MuseTalk's real-time speed means a single GPU worker can match HeyGen's
   perceived latency for short clips.
3. **Second backend: `HunyuanAvatarBackend`** for high-quality renders on a
   beefier GPU node. Same interface, longer queue. Route requests by quality
   tier or video length.
4. **TTS swap:** replace `edge-tts` calls in
   [`app/services/audio_service.py`](../app/services/audio_service.py) with
   Chatterbox (English) and XTTS-v2 (Hindi/Indic), behind a `TTSBackend`
   interface. The Talking-PDF flow won't notice.
5. **Keep Remotion** for the structured/branded text-to-video flow — it solves
   a different problem (deterministic compositional rendering) than HeyGen
   does. See [oss-migration-plan.md](oss-migration-plan.md) Track B for how to
   enrich it.
6. **Feature-flag the cutover.** `AVATAR_BACKEND=heygen|musetalk|hunyuan` env
   var; default to `heygen` until parity is validated.

Hardware floor for self-hosting all three backends in production: 1× A10G/L4
(24 GB) for MuseTalk + TTS, plus 1× A100/H100 for HunyuanVideo-Avatar. On AWS,
`g6.2xlarge` + `g6.12xlarge` covers it.

---

## Honest caveats

- **Quality gap is closing but not zero.** HunyuanVideo-Avatar and Hallo3 are
  competitive on faces; HeyGen still wins on full-body presenter realism + the
  polish of their backend pipeline (auto-framing, b-roll, stock backgrounds).
  EMO and VASA-1 are *better* than open source but remain closed.
- **Ops cost.** HeyGen's $99/mo replaces a GPU box that easily costs $400+/mo
  on-demand. The open stack pays off only at scale or when data residency
  matters.
- **Licensing.** Most weights are research-or-permissive, but read each model
  card — Hunyuan's license has specific commercial-use clauses, and some
  research models forbid commercial deployment.

---

## Sources

- [The 6 Best HeyGen Alternatives in 2026 — Synthesia](https://www.synthesia.io/post/heygen-alternatives-competitors)
- [8 Best Open Source Lip-Sync Models in 2026 — Pixazo](https://www.pixazo.ai/blog/best-open-source-lip-sync-models)
- [5 Best Open-Source Lip Sync Tools (2026) — lipsync.com](https://lipsync.com/blog/open-source-lip-sync)
- [Image-to-Video AI on GPU Cloud: Wan 2.2 / Hunyuan Avatar — Spheron](https://www.spheron.network/blog/image-to-video-gpu-cloud-ltx-wan-hunyuan/)
- [Best Open Source Video Models 2026 — wavespeed.ai](https://wavespeed.ai/landing/models/best-open-source-video-models-2026)
- [HeyGem AI Show HN — Hacker News](https://news.ycombinator.com/item?id=43994791)
- [HeyGem.ai DEV post](https://dev.to/heygem/heygem-open-source-alternative-to-heygen-4d21)
- [BrasD99/HeyGenClone — GitHub](https://github.com/BrasD99/HeyGenClone)
- [duixcom/Duix-Avatar — GitHub](https://github.com/duixcom/Duix-Avatar)
- [Kedreamix/Linly-Talker — GitHub](https://github.com/Kedreamix/Linly-Talker)
- [Omni-Avatar/OmniAvatar — GitHub](https://github.com/Omni-Avatar/OmniAvatar)
- [antgroup/echomimic_v3 — GitHub](https://github.com/antgroup/echomimic_v3)
- [fudan-generative-vision/hallo2 — GitHub](https://github.com/fudan-generative-vision/hallo2)
- [FantasyTalking project page](https://fantasy-amap.github.io/fantasy-talking/)
- [Wan-Video/Wan2.2 — GitHub](https://github.com/Wan-Video/Wan2.2)
- [resemble-ai/chatterbox — GitHub](https://github.com/resemble-ai/chatterbox)
- [Best Open Source TTS — Resemble AI](https://www.resemble.ai/best-open-source-ai-voice-cloning-tools/)
- [liutaocode/talking-face-arxiv-daily — GitHub](https://github.com/liutaocode/talking-face-arxiv-daily)
