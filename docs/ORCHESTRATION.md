# OpenLayer Orchestration Guide

Written 2026-07-18 by the Claude (Fable 5) session that ran the Phase A audit through the v0.6 polish pass.
Audience: **any AI assistant or human continuing this project** — future Claude sessions on any model, Codex/GPT, or Mehran himself. Read this before touching code.

---

## 1. What this project is

OpenLayer is a Photoshop UXP panel plugin driving a local ComfyUI server (default `http://127.0.0.1:8190`). Seven tools: Text to Image, Image to Image, Sketch to Image, Inpaint, Outpaint, Upscale, Prompt from Layer, plus an experimental Live Painting spike. TypeScript + Vite, no framework. Tests are Vitest, node environment, **pure logic only** — there is no DOM or Photoshop in CI. Anything host-dependent is verified manually by Mehran in a real Photoshop.

Validation trio, run after every change, all must stay green:

```
npm run typecheck
npm test
npm run build
```

## 2. The safety invariants (Phase A/B) — never regress these

These were built across PRs #7–#12 and are the project's spine. Every one has a story; breaking them silently is the worst failure mode possible here.

| Invariant | Where it lives | What it prevents |
|---|---|---|
| A1: results are bound to their originating Photoshop document (frozen identity, validated on import, three times for masked inpaint) | `src/photoshop/documentContext.ts`, `assertActiveDocumentMatchesOrigin` in `photoshopAdapter.ts` | importing into the wrong document |
| A2: exact grayscale mask on inpaint import; the black+mask "sandwich" is built **above the whole layer stack** and its order is asserted (`isMaskSandwichTopmost`) before the composite selection is read | `photoshopAdapter.ts` `importImageAlignedToSelectionWithLayerMask`, `photoshopTransaction.ts` | mask contamination from visible layers above the active layer (was a real, host-reproduced bug) |
| A3: transactional import — selection snapshot/restore via alpha channel, two-pass cleanup driven by `planImportFinalization`/`planImportRecovery`, failures aggregated | `photoshopTransaction.ts` + adapter | leaving artist documents dirty after failures |
| A4: exactly ONE active generation run; stale/cancelled runs cannot publish UI updates or commit results (runId gating) | `src/ui/generationIntegrity.ts` (pure predicates) + `src/ui/generationController.ts` (single owner) | older/cancelled runs overwriting newer results |
| A5: all object URLs go through one registry; owned-URL slots revoke on replacement; panel teardown revokes everything | `objectUrlRegistry.ts`, `previewState.ts` | memory leaks in a long-lived panel |
| B1: inpaint readiness contract evaluated **before** upload/submit; source snapshotted at **submission time** (`submittedSource`), not read from mutable state at completion | `src/ui/inpaintReadiness.ts` + `handleGenerateInpaint` | pairing a new selection with an old result |
| B2: temp PNGs deleted after `placeEvent`; startup sweep of stale `OpenLayer_*`/`__OpenLayer_*` PNGs; panel close cancels in-flight polling | `fileUtils.ts`, `temporaryFileCleanup.ts`, `disposeAppResources` | disk/temp accumulation, orphan polls |

**Consequences for new work:** all generate/import buttons stay locked while any run is active (single-run contract). Source capture during a run is safe *because* of submission-time snapshotting. If you add a tool, wire it through `generationController.runPipeline` — do not hand-roll the submit→watch→poll→retrieve→commit sequence; that copy-paste era caused the bugs Phase A fixed.

## 3. Architecture map (post-decomposition)

`App.ts` was 8,149 lines; it is now ~5,800 and stops shrinking on purpose (step 5 per-tool file split was evaluated and **deliberately skipped** — relocation-only, no de-dup value, high risk on the untested closure; don't redo that analysis).

- `src/ui/App.ts` — renderApp shell: state, handlers, wiring. Handlers are thin: prep → `generation.runPipeline({...})` → post-success.
- `src/ui/generationController.ts` — owns active-run state + the pipeline. 8 fake-client tests cover cancellation/stale/error semantics.
- `src/ui/toolDescriptors.ts` — busy tables grouped per tool + global; compile-checked element keys; tests freeze the inventory.
- `src/ui/previewState.ts` — owned-URL slots, source/result preview panels; live frames reuse one `<img>` (flicker fix).
- `src/ui/appMarkup.ts` / `appConstants.ts` — HTML builders + `AppElements`; shared constants/tool cards.
- `src/ui/inpaintReadiness.ts` — pure readiness contract, `generate`/`import` modes.
- `src/comfy/*` — client, preset registry (the source of truth for workflows/nodes/models), workflow builder, compatibility/health, Flux Fill defaults (+ `presetLocksSamplerControls` UI lock predicate).
- `src/photoshop/*` — the host adapter. **Everything here is unverifiable outside Photoshop.** Change with extreme care and always give Mehran a specific smoke checklist.
- `src/styles.css` — ~7,000 lines, TWO themes; **`theme-compact` is the active one**, and it redeclares selectors many times, some with `!important`. Known trap: a base-theme rule that "should" work is often overridden by a compact `!important` block deeper in the file (this bit us twice). Always grep for `theme-compact <selector>` and check what wins. Theme consolidation is wanted but unscheduled.

## 4. Working protocol with Mehran

- Gated, task-by-task: build → validate → **he smoke-tests in real Photoshop** → he says pass → merge → next. Never merge host-touching changes before his check.
- He uses GitHub Desktop; `gh` CLI is available to the assistant for PRs/merges (he usually says "merge it" or "checks passed").
- One commit per task, PR per task (or small PR per couple of related commits). Commit messages explain *why*, in prose.
- `.claude/settings.local.json` is local — never commit it.
- Smoke checklists in PR descriptions must be concrete click-paths, not "verify it works."
- ComfyUI at `127.0.0.1:8190` is often up — you can (read-only) query `object_info` etc. to verify node/model availability instead of guessing. That resolved several "bugs" that were actually environment issues (models in the wrong folder: `CheckpointLoaderSimple` reads `models/checkpoints/`, `UNETLoader` reads `models/diffusion_models/`).

## 5. Codex delegation protocol (hard-won — follow exactly)

Codex (GPT, via the `codex:codex-rescue` agent / `codex-companion.mjs task`) is the implementation worker; the orchestrating assistant reviews, validates, commits, pushes, opens PRs. Mehran wants Codex used for every well-scoped implementation task.

**Incidents that shaped these rules:** Codex's sandbox (separate Windows user, read-only `.git`) once zeroed `.git/HEAD` + a branch ref improvising a clone workaround (recovered via `.git/logs/HEAD`); another time it ran concurrently with the orchestrator's own edits and overwrote committed work. Isolation via a separate clone was tried and is **impossible** — the bridge always roots Codex at the session's working directory, no override exists.

The protocol:
1. **Before launching:** snapshot `cp .git/HEAD` and `.git/refs/heads/` somewhere safe. Create the branch yourself; tell Codex it exists.
2. **Brief self-contained:** Codex starts cold. Give exact file paths, line anchors, verified facts ("do not re-diagnose"), the required behavior, what NOT to touch, the validation trio, and: *do not commit, do not push, do not touch `.git`, report the diff*. (It cannot push — no credentials — and letting it try wastes ~8 min.)
3. **Never edit the repo while a Codex task runs.** Wait or cancel. No exceptions — this is what caused the overwrite.
4. **After completion:** verify integrity FIRST (`git rev-parse --is-inside-work-tree`, `branch --show-current`, `log -1`, `cat .git/HEAD`), then review its diff line-by-line against the invariants in §2, then run the validation trio yourself, then commit/push/PR with co-author credit.
5. Codex jobs: check with `/codex:status`; the job registry sometimes wipes on app restart — if a "completed" task left no report, look for its edits in the working tree before re-running (it may have finished the work silently).
6. Codex is genuinely good: it caught a CSS-specificity bug and a missed call site the orchestrator introduced. Review its work seriously in both directions.

## 6. Roadmap (state as of 2026-07-18, main = 66c3bb2)

**Done & merged:** Phase A1–A5 audit fixes, B1 readiness, B2 lifecycle, App decomposition steps 1–4, error-color fix, preview flicker + fixed-height panels, Florence2 fork tolerance, Flux Fill locked controls, per-tool busy lockout.

**Queued next (roughly in order):**
1. **ComfyUI setup diagnostics, Phase 1** — when a preset's model is missing, scan the *other* model folders and say "found X in diffusion_models/ — this workflow needs it in checkpoints/"; name exact missing custom-node repos. Foundation exists (`getModelInventory`, `workflowCompatibility`, health report). Mostly delegable to Codex with a good brief.
2. **Setup tab / requirements manifest (Phase 2)** — per-workflow: model names, download URLs, target folders, node repos, live ✅/❌ against the running server. Product-shaped; needs design taste up front, then delegable.
3. **GPU-aware recommendations (Phase 3)** — extend `hardwareAdvisor` to rank runnable workflows by VRAM.
4. **Assisted install (Phase 4)** — ComfyUI-Manager API behind explicit user approval. Biggest surface; last.
5. **Outpaint canvas expansion + aligned import** — currently outpaint imports centered without resizing the canvas. Proper fix = batchPlay canvas resize + coordinate-shift for alignment. **Hardest host work on the list**; touches the same adapter machinery as A2/A3. Needs the strongest available model + careful Mehran verification.
6. **Live Painting v2 (two-tier: SD1.5-LCM fast tier / Krea2-turbo quality tier)** — design exists in the assistant's memory notes; the current spike (event-candidate listeners, serial pump loop in `livePaintingSession.ts`) works but is primitive. Flagship feature. Architecture first, then incremental delegation.
7. **Layer tools & new-tool pattern** — new tools go in their own `src/ui/tools/<name>.ts` modules (the forward-looking half of skipped step 5); wire through `generationController` + a new busy-table group + `generationToolUi` row + preset registry entry.
8. **Housekeeping:** theme/CSS consolidation; untrack `dist/`+`packages/`; ESLint in CI.

## 7. Advice for sessions without a frontier model

Honest guidance from the model writing this:

- **Safe with any competent model:** Codex-brief writing from this doc's templates, reviewing Codex diffs against §2, CSS/markup tweaks (mind the §3 theme trap), copy changes, preset-registry additions for new workflows (follow an existing entry byte-for-byte), test additions to existing suites, merging after Mehran's pass.
- **Do with care (mid-tier model):** new pure modules following existing patterns (readiness-contract style), new tool wiring that copies the img2img handler shape exactly, diagnostics features on top of existing inventory plumbing.
- **Defer to the strongest available model (or split into reviewed micro-steps):** anything in `src/photoshop/*` (batchPlay semantics, transaction ordering, coordinate math — items 5 and 6 above), anything touching `generationController`/`generationIntegrity`, refactors of `renderApp` state, and any "the test passes but does it prove the host behavior?" judgment call — that class of gap caused the original composite-mask bug.
- **Process beats model:** the validation trio, Mehran's smoke gate, byte-identical-move verification for refactors, and the Codex protocol in §5 were what actually prevented disasters. A weaker model following this process is safer than a stronger one skipping it.
- **When unsure whether a change is behavior-preserving: measure, don't argue.** Diff executed orderings, count inventories in tests, verify moved blocks byte-identical. That habit is transferable to any model.
- The assistant's persistent memory (Claude-side) holds compressed session context, but THIS file is the durable cross-assistant source of truth. Update it when the roadmap moves.

## 8. Known open items / warts

- Sketch/upscale/outpaint/prompt-layer readiness is still ad-hoc in handlers (B1 built the contract only for inpaint). Same pattern could be extended.
- `handleGenerateInpaint` is still the longest handler (~250 lines of prep) — fine, but don't let it grow.
- Two `todo` presets (`txt2img-flux1-dev`, `img2img-flux1-dev`) await authored workflow JSONs.
- Live Painting auto-import only fires on the Stop button — by design, but revisit in v2.
- CSS: seven+ redeclarations of the same selectors across themes; consolidation pending.
