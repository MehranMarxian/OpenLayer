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

`App.ts` was 8,149 lines and is now 5,842. The step 5 per-tool file split was evaluated and
**deliberately skipped** — relocation-only, no de-dup value, high risk on the untested closure;
don't redo that analysis.

**That decision is narrower than it reads, and this sentence used to say the file "stops shrinking on
purpose", which is wrong.** What was rejected was carving up `renderApp` — the closure that runs from
line 249 to roughly 3,300, where the handlers share mutable state and no test can reach them. The
~2,500 lines *below* that closure are already module-level functions taking everything as parameters,
and moving those is import-rewiring in a different risk class. v0.8 does exactly that, one slice at a
time: `toolErrorMessages.ts` (279 lines, done), `statusBars.ts` (~347), `appBindings.ts` (~561).
Extract from below `renderApp`; leave the closure alone.

- `src/ui/App.ts` — renderApp shell: state, handlers, wiring. Handlers are thin: prep → `generation.runPipeline({...})` → post-success.
- `src/ui/generationController.ts` — owns active-run state + the pipeline. 8 fake-client tests cover cancellation/stale/error semantics.
- `src/ui/toolDescriptors.ts` — busy tables grouped per tool + global; compile-checked element keys; tests freeze the inventory.
- `src/ui/previewState.ts` — owned-URL slots, source/result preview panels; live frames reuse one `<img>` (flicker fix).
- `src/ui/appMarkup.ts` / `appConstants.ts` — HTML builders + `AppElements`; shared constants/tool cards.
- `src/ui/inpaintReadiness.ts` — pure readiness contract, `generate`/`import` modes.
- `src/comfy/*` — client, preset registry (the source of truth for workflows/nodes/models), workflow builder, compatibility/health, Flux Fill defaults (+ `presetLocksSamplerControls` UI lock predicate).
- `src/photoshop/*` — the host adapter. **Everything here is unverifiable outside Photoshop.** Change with extreme care and always give Mehran a specific smoke checklist. Capture and import are different risk classes; see §5a before delegating any of it.
- `src/styles.css` — ~7,000 lines, TWO themes; **`theme-compact` is the active one**, and it redeclares selectors many times, some with `!important`. Known trap: a base-theme rule that "should" work is often overridden by a compact `!important` block deeper in the file (this bit us twice). Always grep for `theme-compact <selector>` and check what wins. Theme consolidation is wanted but unscheduled.

  Four specific traps, each of which has now cost real time — check all four before writing panel CSS:
  1. **A single-class base rule loses to `.app-shell.theme-compact <class>`**, which is both more specific and usually `!important`. New wrapping paragraphs and non-full-width buttons need a duplicated compact rule. `.live-hint` and `.setup-paragraph` are the precedents.
  2. **Flex `gap` is not honored reliably in the compact panel.** Use explicit margins; the file says so in its own comments.
  3. **Attributes style things too.** `theme-compact button[aria-pressed]` styles *any* button carrying that attribute as a gold toggle switch. Adding `aria-pressed` to a filter chip for accessibility silently made it look like an Import Automatically switch. Grep for attribute selectors, not just class ones.
  4. **A `999px` radius is only a pill if you control the height** — otherwise it renders as a stretched ellipse. State the height and set the radius to half of it. Applies to any badge or chip.

  When a change is about size or clipping, **measure it**: load a snippet in a browser at the panel's real 356px content width, in the shell's Arial, and read `getBoundingClientRect()`. That is how the uppercase badge cap was set (worst label 136px) and how the chips were confirmed at a uniform 22px. Browser metrics are not UXP, but they catch the arithmetic errors, and they caught two here.

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

### 5a. Two models, one roadmap (agreed 2026-07-26)

Mehran's framing, and it is the right one: **treat each model as a different teammate's opinion, not
as a second driver.** Two assistants pulling in different directions is the failure mode; two
assistants disagreeing *about a specific diff* is the value.

**Division of labour.** Codex implements, Claude reviews. Neither role is a rubber stamp: Codex is
expected to push back when a brief is wrong, and Claude is expected to find things a brief could not
anticipate. What keeps them from diverging is not politeness, it is that both work from the same
written plan — the numbered task list with per-task acceptance criteria, agreed with Mehran before
any code is written. **The roadmap is the shared contract; the diff is where the opinions meet.**

**Make the two contributions separately visible.** When Codex implements a task, its work is the
first commit on the branch and any review fixes are a second commit on top. The PR then shows who
did what, and Mehran can compare them on GitHub rather than taking a merged blob on trust. This
mirrors the pattern already used for a mechanical change plus the bug it exposed: the extraction in
one commit, the fix in the next.

**What to delegate.** Work that is well specified and mechanical, where the acceptance criteria can
be written down in advance and checked by `typecheck`/`lint`/`test`: relocations, table-driven
refactors, adding coverage to pure functions. `appBindings.ts` is the canonical example.

**What not to delegate.** Anything requiring host judgement or safety context: the invariants in §2,
UXP-specific traps, and any change where deciding *what* to build is the hard part. A cold-started
worker cannot know that `placeEvent` clears the selection or that UXP has no `TextEncoder`, and a
brief long enough to convey it is longer than the change.

**The Photoshop adapter is not one thing, and this rule used to say it was.** v0.9 delegated the
capture half of `photoshopAdapter.ts` successfully, so the line is drawn finer than "never touch
`src/photoshop/*`":

- **Import is not delegable.** It carries the invariants — mask ordering (A2), transactional
  snapshot and cleanup (A3), document-identity binding (A1). It mutates the artist's document, and
  every one of those invariants exists because something already went wrong once.
- **Capture is delegable with an explicit boundary in the brief.** It is read-only: no document
  mutation, no layer-stack changes, nothing to roll back if it fails. `exportActiveLayerAsPNG` and
  `exportSelectionAsPNG` were implemented by Codex in PR #50 and the review pass found a divergence
  worth keeping, not a safety problem — Codex used the selection's own bounds where the brief said
  context bounds, and was right, because padding exists for the inpaint model and not for an artist
  exporting what they selected.

The boundary has to be stated in the brief, not assumed. "Work in `photoshopAdapter.ts`" is not a
scope; "implement these two capture functions on the existing capture path, do not touch the import
functions or `photoshopTransaction.ts`" is.

Note also what made this safe beyond the read-only property: the capture path already existed and
was proven by `exportActiveLayerForImageToImage`. Delegating *new* host code, against an API nobody
has called from this project yet, is a different risk — spike it yourself first, as in PR #49.

**Do not delegate for the sake of it.** Briefing costs real time and a cold start costs about eight
minutes; below roughly a hundred lines of mechanical work, writing the brief costs more than doing
the work. Delegation is a tool for scale, not a ritual.

**On isolation — settled, and worth restating because it keeps getting re-litigated.** An isolated
`OpenLayer-codex` clone was tried and abandoned: the `codex-rescue` subagent forwards to
`codex-companion.mjs task` with no `--cwd` override anywhere in its interface, so Codex always
launches rooted at this session's working directory. `config.toml` `trust_level` does not help —
trust and the write-sandbox root are unrelated settings. The clone and its git remote were deleted on
2026-07-18. **Do not spend another session rediscovering this.**

What protects the repository is therefore procedural, not structural, and all four rules matter:
snapshot `.git/HEAD` and `refs/heads/` before launching; never edit while a Codex task runs; verify
`HEAD`, branch and last commit survived before touching anything afterwards; and require a reported
diff rather than a commit, a push, or any contact with `.git`.

## 6. Roadmap (state as of 2026-08-01, during the v0.11.0-alpha release)

**v0.11.0-alpha is the release in flight**: the Setup screen (PRs #62, #63), the roadmap-item-3 preset
ranking (#65) and this doc's own update (#64) are all merged to main and were unreleased for three
sessions. Nothing a tester can install contains any of it until the tag is pushed.

**v0.10.0-alpha is published** (tag on `31e21d7`, prerelease, plugin zip + setup pack + `checksums.txt`).
Its headline fix was the release zip: every release from v0.1.0 to v0.9.0-alpha stored entry paths with
backslashes, which macOS unpacks flat with no `assets/` folder. **When verifying a packaging fix, the
control must be the artifact GitHub serves** (`gh release download`), not the local `packages/` copy —
that copy gets silently overwritten by whatever the packager last produced, and it made the historical
bug look like it had never existed. Read the raw central directory; `zipfile`-style readers normalize
separators and cannot see this class of bug.

**`.ccx` one-click install remains open and is not blocked on code.** Building one is ~40 lines
(`writeZip` already exists; a `.ccx` for this plugin is just a zip). Whether a double-click installs
anything depends on Creative Cloud accepting an unsigned non-Marketplace package, which needs a machine
that has never had UDT — nobody on the project has one. It was deliberately left out of v0.10.0 because
release assets can be added to a published release at any time, so deferring costs nothing.

**Roadmap items 1, 2 and 3 are done** (PRs #58, #62, #63, #65). See the entries below.

**v0.8 so far (merged):** version bump to 0.8.0; ESLint in CI (with `TextEncoder`/`TextDecoder`
banned in `src/`, the one rule that catches a UXP failure neither `tsc` nor Vitest can see); preview
panel pin-to-tool; the source↔API workflow equivalence check; the four missing GUI source workflows;
`toolErrorMessages.ts` extracted plus the `getTechnicalErrorDetails` crash it exposed.

**v0.8 remaining:** `statusBars.ts` extraction and the Text-to-Image status bleed (`setStatus` still
writes all seven tool bars, so Text to Image progress appears in Inpaint's status bar); the
`appBindings.ts` extraction; a CSS audit that measures rather than consolidates; release paperwork.
Live Painting refine tier, in-canvas write-back, `.ccx` distribution, custom workflow import and the
LoRA browser are explicitly **out of v0.8 scope**.

**Done & merged earlier:** Phase A1–A5 audit fixes, B1 readiness, B2 lifecycle, App decomposition steps 1–4, error-color fix, preview flicker + fixed-height panels, Florence2 fork tolerance, Flux Fill locked controls, per-tool busy lockout, the generated ComfyUI setup pack, the separated preview panel.

**Queued next (roughly in order):**
1. ~~**ComfyUI setup diagnostics, Phase 1**~~ — **DONE, v0.10.0** (PR #58). `modelPlacementDiagnostics.ts` answers "is the file just in the wrong folder?", and missing nodes name the package that provides them.
2. ~~**Setup tab / requirements manifest (Phase 2)**~~ — **DONE** (PRs #62, #63). A Setup card on Home opens a screen listing every model and node package with folder, size, what it unlocks, and live status. Three things worth carrying forward:
   - **Models are the primary list, not presets.** 13 presets share 13 models with heavy overlap; a preset-first list prints `ae.safetensors` four times and reads as ~18 GB of downloads that do not exist.
   - **Static manifest, live status as an overlay.** Status is four-valued — `not-checked` keeps every name, folder, size and link when ComfyUI is unreachable, because someone asking what to download usually has not started it yet. Tallies show a dash, not 0, when nothing was checked: "0 missing" against a dead server reads as good news.
   - **A wrong-folder model contributes zero to the remaining download**, and its row says the file is already there. `evaluateSetupRequirements` (pure) and `setupTabModel.ts` (pure view model) hold all of this; the DOM layer only draws it.
   Presets also gained a required `displayName`, because `label` was the preset id and the health cards had been showing `txt2img-krea2-turbo` to artists for several releases.
3. ~~**GPU-aware recommendations (Phase 3)**~~ — **DONE** (PR #65). `presetFootprint.ts` ranks every runnable preset against the VRAM `hardwareAdvisor` reports for the primary device, and the "What will run well" block sits at the bottom of the Setup screen next to the requirements it describes. Two decisions worth carrying forward:
   - **Rank on the largest single file, not the sum.** ComfyUI loads and offloads components at different stages, so the biggest resident chunk predicts speed; the sum describes the download instead. Both are computed, and they answer different questions.
   - **An unpublished size is not a small size.** Florence-2 publishes no size, measured as zero bytes, and sorted to the top as the single most comfortable preset on the list. Missing sizes now block a "Comfortable" claim but not "Tight"/"Will offload", because the known part alone already justifies those. Any new size-derived claim needs the same asymmetry.
4. **Assisted install (Phase 4)** — ComfyUI-Manager API behind explicit user approval. **Next up.** The Setup screen already computes the inputs: `SetupModelRequirement` carries the target folder, the download URL, the size and the licence-gated flag, and `evaluateSetupRequirements` already knows exactly which files are missing versus merely misplaced. Biggest surface on the list; nothing may download without per-item confirmation.
5. ~~**Outpaint canvas expansion + aligned import**~~ — **DONE** (commit `b2b8f26`, 2026-07-18). `importOutpaintResultExpandingCanvas` in `photoshopAdapter.ts` does the two-anchor `canvasSize` expansion, aligns the placed layer, asserts it covers the expanded canvas, and reverts through a suspended history state on failure; `outpaintExpansion.ts` holds the pure plan and is unit-tested. **This item stayed on the roadmap as "next" for two weeks after it shipped and cost a later session a full re-investigation.** Two things generalise:
   - **Canvas resize is two anchored steps, not one.** `canvasSize` distributes new space around a single anchor, so left/top padding is added with the content pinned bottom-right, then right/bottom with it pinned top-left.
   - **Never programmatically re-crop.** Reducing canvas size clips pixel data outside the new bounds, and artist layers routinely extend past the canvas.
   The same machinery now also backs **Upscale document resizing** (`upscaleResize.ts` + `importUpscaleResultResizingDocument`), which resamples the whole document up to the upscaled size so existing layers stay in register. Upscale resizes only for a **canvas** capture whose result is a clean uniform scale; every other case keeps the untouched floating-layer import and says why.
6. **Live Painting v2 (two-tier: SD1.5-LCM fast tier / Krea2-turbo quality tier)** — design exists in the assistant's memory notes; the current spike (event-candidate listeners, serial pump loop in `livePaintingSession.ts`) works but is primitive. Flagship feature. Architecture first, then incremental delegation.
7. **Layer tools & new-tool pattern** — new tools go in their own `src/ui/tools/<name>.ts` modules (the forward-looking half of skipped step 5); wire through `generationController` + a new busy-table group + `generationToolUi` row + preset registry entry.
8. **Housekeeping:** theme/CSS consolidation. ESLint in CI landed in v0.8; `dist/` and `packages/` are already gitignored.

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
- ~~Two `todo` presets await authored workflow JSONs.~~ **Removed 2026-08-01.** WFL's first run found bf16 Flux1-dev has no 12 GB story (a 23.8 GB weight plus separate T5/CLIP/VAE), that `txt2img-flux1-dev-fp8` already ships and covers the need, and that `FLUX1_DEV_STACK` only ever held the diffusion weight — no CLIP, T5 or VAE entries — so authoring these was building the stack from scratch rather than finishing a mapping. **Every registered preset is now runnable**, and the `todo` status plus the `missing-workflow` health state are still supported and covered by fixtures rather than by whatever the registry happens to hold. If a further Flux tier is wanted, scope it fresh against FLUX.2 [klein]-4B fp8 (Apache-2.0, ungated, ~4 GB, and `EmptyFlux2LatentImage`/`Flux2Scheduler` are already core node classes) — it needs new node mapping and is not a drop-in for the removed ids.
- **Setup and Workflow Health overlap and both survive on purpose for now.** Setup answers "what do I need and where does it go"; Health answers "can I run this preset". If that turns out to be one screen too many, Health is the one that folds into Setup, not the reverse. They already share the `.workflow-health-item` card and `.workflow-health-state` badge, so they cannot drift visually.
- `uxp.shell.openExternal` has never been called in this project, though `manifest.json` already declares `launchProcess` for `https`. The Setup screen therefore offers Copy Link rather than opening a browser. Opening one is a spike, not a line in a brief.
- Live Painting auto-import only fires on the Stop button — by design, but revisit in v2.
- CSS: seven+ redeclarations of the same selectors across themes; consolidation pending.
