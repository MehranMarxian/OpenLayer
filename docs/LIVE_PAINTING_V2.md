# Live Painting v2 — Technical Specification

Status: **approved direction, not yet implemented.** Written 2026-07-18 with full session context (Fable 5).
Read `docs/ORCHESTRATION.md` first — its safety invariants and Codex protocol apply to every step here.

---

## 1. Vision and tiers

Paint in Photoshop; the panel answers in near real time. Two quality tiers with one mental model:

| Tier | Trigger | Engine | Size | Measured latency (RTX 4070 Ti 12 GB, 2026-07-11) |
|---|---|---|---|---|
| **Live** | every stroke (debounced) | SD 1.5 + LCM LoRA, 5 steps, cfg 1.5, `lcm`/`sgm_uniform`, fixed seed, denoise ~0.35–0.75 | ≤512px capture | gen ~0.5–0.7 s warm; stroke→preview round trip ~1–1.5 s |
| **Refine** | pause timeout OR "Refine Now" button | **Krea2 Turbo img2img** (`krea2_turbo_fp8_scaled.safetensors`, confirmed installed in `diffusion_models/`), same prompt + same seed, full/high res | up to document size (cap 1024² initially) | ~38–48 s at 1024² (12 GB offload) |

The artist paints against the fast tier; whenever they stop, the same scene re-renders beautifully. Same seed + same prompt across tiers keeps the refine recognizably "the same picture."

**Not in scope for v2:** per-frame write-back into the canvas (undo-history pollution — v3 exploration). Refine results import as a normal layer via the existing import path.

## 2. What already exists (verified in code, some host-verified)

- `src/ui/livePaintingSession.ts` — spike session: registers stroke listeners from `STROKE_EVENT_CANDIDATES` (`historyStateChanged`, `paint`, `set`, `move`, `toolModalStateChanged`), serial `markDirty()`/`pump()` loop (max one generation in flight, dirty-flag latest-wins — the drop-frame policy already exists here), per-cycle timing telemetry.
- `src/photoshop/livePaintingCapture.ts` — capture with mode fallbacks and telemetry (`mode: "non-modal" | ...`), `maxDimension` downscale (default 512), stamps `originatingDocument` (A1-compliant).
- `src/comfy/livePainting.ts` — `buildLcmLiveWorkflow` (graph above), `findLcmLoraName`, `LIVE_PAINTING_SAVE_NODE_ID = "9"`.
- UI: Live Painting screen with prompt, denoise slider, start/stop, one persistent-`<img>` preview (the no-flicker pattern), zoom toggle, import-on-stop + auto-import toggle. **Host-verified working end-to-end by Mehran** (sessions run, previews update, import on Stop works).
- Krea2 img2img node tables (`KREA2_TURBO_IMG2IMG_NODES`/`_INJECTIONS`) already in `presetRegistry.ts` — the refine graph does not need to be invented.
- LCM LoRA installed: `loras/lcm/SD1.5/pytorch_lora_weights.safetensors`.

**Spike questions now answered by usage:** stroke events fire and sessions work (which specific events registered on Mehran's build is logged in-panel via `Listening for: ...` — capture it once and record here). Non-modal capture works (mode telemetry shows per-cycle). Remaining unknown: none blocking; §10 lists measurements to confirm during implementation.

## 3. Architecture

### 3.1 Module layout (new code goes in tool modules, per ORCHESTRATION §6.7)

```
src/ui/tools/livePainting.ts     — session state machine v2 (replaces livePaintingSession.ts)
src/comfy/livePainting.ts        — + buildKrea2RefineWorkflow(options) reusing KREA2 node tables
src/photoshop/livePaintingCapture.ts — + full-res capture variant for refine (maxDimension param already supports it)
```

### 3.2 Session state machine

```
      start()                 stroke event            cycle done
idle ────────► listening ──────────────► pending ──────────────► listening
                   │  ▲                     │(one in flight,           │
                   │  └─────────────────────┘ dirty=latest wins)       │
                   │        pause timer (no strokes for N s, default 4)│
                   │                        ▼                          │
                   │                    refining ──────────────────────┘
                   │                        │ "Refine Now" forces this too
      stop()/teardown                       │ stroke during refine → cancel refine? NO:
                   ▼                        │ finish refine, queue live cycle after
                 stopped                    ▼
                                     refined (preview swap + "Import Refined" enabled)
```

Rules, in priority order:
1. **Max one ComfyUI job in flight per session** (live OR refine). The dirty flag holds the latest canvas state; intermediate states are dropped (existing pump behavior — keep it).
2. A stroke during `refining` does NOT cancel the refine (Krea2 runs are expensive; cancelling wastes 30+ s of progress and thrashes VRAM). It sets dirty; a live cycle runs after the refine completes. Exception: a second explicit "Refine Now" press cancels-and-restarts refine via `client.cancelPrompt`.
3. Pause detection: a timer armed on every stroke event; firing when `state === listening && !dirty` triggers auto-refine **only if the "Auto Refine on Pause" toggle is on** (default OFF in v2.0 — opt-in until latency feel is tuned).
4. Fixed seed per session (current behavior). "New Seed" button reseeds and marks dirty.

### 3.3 Relationship to the generation controller (the key design decision)

The live session stays **outside** `generationController` — it is a session, not a run; its cycles must not flip global busy state 60 times a minute or fight the A4 single-run slot. BUT the current spike has a real hole: a regular Generate can run concurrently with live cycles (two ComfyUI jobs, VRAM thrash). v2 closes it with **mutual exclusion at the edges**:

- `handleStartLivePainting` refuses to start while `isBusy` (any tool run active): "Finish the current generation before starting a live session."
- Every regular generate handler refuses (readiness-style early return) while `livePaintingSession?.isRunning()`: "Stop the live session before generating." Implement as one shared guard used by all handlers; add `livePaintingActive` to the busy-table design if visual locking of Generate buttons is wanted (nice-to-have).
- Panel teardown (`disposeAppResources`) already stops the session — keep, and also interrupt any in-flight live/refine prompt via `cancelPrompt` (currently the poll is abandoned, ComfyUI finishes the orphan job).

### 3.4 Latency engineering (live tier budget: ≤1.5 s stroke→preview)

| Stage | Now | v2 action |
|---|---|---|
| Stroke → capture start | event debounce | keep `markDirty` immediate; the pump serializes anyway |
| Capture ≤512 | tens of ms (non-modal) | keep; record `mode` per session start in diagnostics |
| PNG encode | pure JS `encodeRgbaPng` | fine at 512²; if profiling shows >100 ms, consider raw-RGB upload later — measure first |
| Upload | per-cycle new file | reuse ONE filename per session (`openlayer-live-<seed>.png`, already done) — ComfyUI overwrites; confirm no cache-stale issue (LoadImage caches by filename+mtime; if stale frames appear, append a cycle counter and delete old uploads on stop) |
| Submit+gen | ~0.5–0.7 s warm | fixed graph structure keeps the checkpoint+LoRA cached server-side; do not vary node ids between cycles |
| Poll | 250 ms interval | v2: subscribe to the existing WebSocket progress watcher for the SaveImage output instead of polling; fall back to 250 ms poll. (`watchProgress` already exists — reuse.) |
| Download+display | object URL swap into persistent img | keep (A5 owned-URL slot) |

### 3.5 Refine tier build

`buildKrea2RefineWorkflow({ prompt, sourceImageName, seed, denoise, width, height })`:
- Graph: exactly the `KREA2_TURBO_IMG2IMG_NODES` shape from `presetRegistry.ts` (UNETLoader `krea2_turbo_fp8_scaled.safetensors` + CLIPLoader + VAELoader + LoadImage→VAEEncode→KSampler→VAEDecode→SaveImage). Verify the required CLIP/VAE models present via `getModelInventory` at session start; if the Krea2 stack is incomplete, hide/disable the refine tier with a setup hint (ORCHESTRATION §6.1 diagnostics pattern) — the live tier still works alone.
- Refine capture: same capture path, `maxDimension` = min(1024, doc long edge) initially. Refine denoise default 0.45 (preserves composition more than the live tier; expose in Advanced later).
- Refine runs INSIDE the session (state `refining`), not through `runPipeline` — but its result import ("Import Refined") goes through the normal `importGeneratedImageAsLayer` with the session's `originatingDocument` (A1 applies; already how live import works).

### 3.6 UI (Live Painting screen v2)

Existing screen plus: tier indicator (LIVE ⚡ / REFINING ✨ badge on the preview), "Refine Now" button, "Auto Refine on Pause" toggle + pause-seconds field (Advanced), "Import Refined as Layer" (separate from live import; enabled once a refine result exists), last-cycle timings line (exists). The separate resizable preview panel (roadmap feature #4) is the natural home for the live preview — design that panel with this consumer in mind, but do NOT couple the two deliveries.

## 4. Failure handling

- Cycle failure (live): show in status line, stay `listening`, next stroke retries — existing behavior, keep.
- Refine failure: status + re-enable Refine Now; do not kill the session.
- ComfyUI went away mid-session: after 3 consecutive cycle failures, stop the session with a clear message (avoid infinite failing pump).
- Stop/teardown: remove listeners (exists), cancel in-flight prompt (add), release preview URL on teardown only (exists via registry).

## 5. Implementation plan (incremental, each step = validation trio + Mehran smoke)

| Step | Content | Status |
|---|---|---|
| 1 | Mutual exclusion guards (live vs regular generates) + in-flight cancel on stop/teardown | **Done** — merged in PR #19 |
| 2 | `buildKrea2RefineWorkflow` + inventory gate + unit tests (pure) | **Done** — merged in PR #19 |
| 3 | Session state machine v2 in `src/ui/tools/livePainting.ts` (port pump, add refine states, pause timer, telemetry) with unit tests against a fake client | **Done** — merged in PR #20 |
| 4 | UI: refine controls + badges + wiring | **Done** — merged in PR #21; refine tier host-verified working by Mehran 2026-07-21 |
| 5 | WebSocket preview instead of polling for live cycles | Pending — reuse `watchProgress`; folded into the v2.5 plan below |
| 6 | Latency profiling pass on Mehran's machine; tune denoise/pause defaults; record real numbers back into this doc | Pending (Human + any model) |

Review checkpoints for whoever orchestrates: A1 (originatingDocument on every capture), A5 (all preview URLs through the registry/owned slots), single-job-in-flight invariant, and the mutual-exclusion guard on BOTH sides.

## 6. Open measurements (record answers here)

1. Which stroke events actually register on Mehran's Photoshop build (read the session-start status line once).
2. Which capture mode wins (`mode` telemetry) and its ms at 512².
3. LoadImage filename-reuse staleness: yes/no on his ComfyUI version.
4. Krea2 refine wall-clock at 768² and 1024² with the fp8 model (decide default refine size from this).
5. Whether `historyStateChanged` fires during a drag or only on mouse-up (affects debounce need; current pump absorbs either).

## 7. Realtime gap and the v2.5 plan (DEFERRED — do not start without Mehran's go)

Status after v2 shipped (2026-07-21): the two-tier design works — live tier repaints in ~0.5–0.7 s, refine tier delivers a Krea-2 Turbo pass in ~38–48 s at 1024² on the RTX 4070 Ti (12 GB). Mehran confirmed refine works but noted the expectation gap: this is not krea.ai/realtime. That gap is structural, not a bug:

- **The refine tier can never be the realtime engine on 12 GB.** Krea-2 Turbo at 38–48 s/frame is physics, not tuning. Realtime feel must come from the live tier.
- **`historyStateChanged` only fires on mouse-up**, so previews update per-stroke, not during a drag.
- **Disk + poll overhead** adds ~300–500 ms per cycle on top of sampling.

v2.5 scope (in order of impact, each step = validation trio + smoke):

1. **Continuous capture timer** (~400 ms) while the pointer is likely painting, instead of waiting for `historyStateChanged` — previews update mid-drag.
2. **`SaveImageWebsocket`** output node + binary WS frames — removes disk write + HTTP poll from the loop (plan step 5 above folds in here).
3. **1–2 step models** (SD-Turbo / SDXL-Turbo / LCM at 1–2 steps, denoise-tuned) for the live tier.
4. **v3, separate track:** StreamDiffusion sidecar process for true 10 fps+ — different architecture, not an increment of this pipeline.

Do not begin any of this until Mehran explicitly asks; v2 is the released baseline.
