# OpenLayer Roadmap

OpenLayer is a local-first UXP plugin for Photoshop that runs artist-friendly ComfyUI workflows. The roadmap favors a trustworthy foundation before larger creative features.

## Where it is now

Fourteen generation tools, all running against a local ComfyUI: Text to Image, Image to Image, Edit Image,
Sketch to Image, Inpaint, Outpaint, Upscale, Remove Background, Layer Maps, Prompt from Layer,
Live Painting, Style Reference, Multi-Reference and Unflatten, plus Layer Tools, History, the
Prompt Wallet, Enhance Prompt beside every prompt field, Workflow Presets, custom workflow checking,
and a Setup screen that checks what you have against what each preset needs and can download what
is missing.

Four of those carry a caveat rather than a clean bill of health, and the list is deliberately
honest rather than short: Inpaint, Outpaint, Multi-Reference and Unflatten. What each one does and
does not do is in [known limitations](known-limitations.md), which is the document to read before
this one.

The foundations under all of it: a preset registry nearly every other surface is derived from (Live
Painting's graphs and the hardware advisor's text are the two exceptions), a workflow
health check, GPU-aware model recommendations, LoRA support, results imported as real named layers
with masks and alignment, generation history, cancellation, themes, and an optional MCP bridge that
lets an agent drive the panel.

## What is being worked on

- **Making the experimental four less experimental.** Reliability before reach: nothing new is worth
  as much as one of these becoming something a person can rely on.
- **Unflatten's background quality.** The gate found the bottleneck is not segmentation but what the
  model paints into the hole a subject leaves. Flat ground reconstructs well; a complex scene does
  not. Raising the resolution makes it worse, so the likely route is a masked inpaint pass over the
  background using the crop-and-stitch stacks already shipped.
- **First-run friction.** Every step between downloading the plugin and seeing it work once.
- **Editing just a selection with Qwen-Image 2.1.** Built for v0.35 and cut: the join is invisible on
  busy content but shows in a smooth sky, because the model repaints untouched areas a few levels
  darker. Matching colour across the whole crop made it worse; the next thing to try is matching from
  the untouched ring around the selection only.
- **Structure.** Moving the pure helper functions out of `App.ts` (about a quarter of its nearly 10,000 lines),
  splitting the preset registry by model family, and giving the Agent Bridge a per-session token.

## Prioritised plan (from the v0.37 codebase review)

Every item below comes from [the codebase review](codebase-review.md) (finding numbers in
brackets). Sizes: **S** is one small PR, **M** is one larger PR or two small ones, **L** is several
PRs. Each item ships as its own branch and PR, and anything touching panel markup, CSS or
Photoshop calls waits for a real Photoshop check before merge.

### Do next, in this order

1. **Cancel only our own prompt** (R1). It is the one way OpenLayer can break someone else's work.
2. **Close the Agent Bridge to web pages** (R2). A small change that removes the only remote-ish
   attack path.
3. **Fix the landing-page and README wording, with a test that keeps it fixed** (E1). Blocks the
   Exchange resubmission and is what LLMs quote.
4. **Explain rejected workflows in plain words** (E2). The most common first-run failure.
5. **Safe model downloads** (R3). A truncated file that looks like a model is the hardest failure
   for an artist to diagnose.

### Reliability

| Id | Item | Why | Size | How it is verified |
|---|---|---|---|---|
| R1 | Cancel only OpenLayer's own prompt: dequeue it if pending, send a targeted `/interrupt` with `prompt_id` only if it is the one running, otherwise do nothing. Live Painting stops cancelling prompts that already finished. | Today's fallback is a global interrupt that stops whatever is running on a shared ComfyUI [1, 2]. | S | Unit tests with a fake client: no `/interrupt` call when the prompt is neither pending nor running, and the body always carries `prompt_id`. Photoshop: queue a long job from the ComfyUI web page, start and stop Live Painting several times, and the web job still finishes. First confirm the installed ComfyUI honours `prompt_id`. |
| R2 | Agent Bridge: refuse WebSocket upgrades from browser origins, then add a per-session token the panel and agent must present. | Any web page can currently connect to `127.0.0.1:8199` and drive the panel or bump it off [3]. | S, then M | Router test: a connection presenting a web `Origin` is closed. Manual: from a browser console on any site, `new WebSocket("ws://127.0.0.1:8199")` is refused while the panel and Claude still connect. `npm run test:e2e` passes. |
| R3 | Download models to `<name>.part`, rename on completion, and check the SHA-256 that Hugging Face publishes, recorded in the registry. | An interrupted download currently leaves a truncated file under the real name, which ComfyUI lists as a model; size alone does not prove the right bytes [6, 7]. | M | Unit tests with a fake destination: an interrupted run leaves no final-name file, a wrong hash fails. Photoshop: cancel a download halfway, confirm Check ComfyUI does not list it, resume, confirm it completes. |
| R4 | Timeouts on every `ComfyClient` request (short for status and `object_info`, longer for uploads). | A hung ComfyUI currently hangs Check ComfyUI and Generate with no message [9]. | S | Unit test with a never-resolving `fetch`. Manual: pause the ComfyUI process, press Check ComfyUI, get a clear message within the timeout. |
| R5 | Bridge in CI: `npm ci` in `bridge/`, run its tests against its own dependencies, run `npm run test:e2e`, clear the 4 bridge advisories. | The bridge ships zod 3 but is tested with the root's zod 4, and its end-to-end suite never runs [5, 12]. | S | The new CI job's log; `npm audit` in `bridge/` reports 0. |
| R6 | Type-check `tests/` (a second tsconfig plus `@types/node`) and fix the 102 errors. | A renamed type can leave a test passing while it asserts the wrong shape [11]. | M | `npm run typecheck` includes tests and CI stays green. |
| R7 | A written UXP smoke checklist (`docs/uxp-smoke-checklist.md`): ten minutes, fixed steps, one per tool family, used in every PR that touches the host. | Green tests do not prove the panel works, and each PR currently invents its own checklist. | S | Mehran runs it once on the current release and it catches nothing new; it is then linked from every host-touching PR. |
| R8 | Move tool handlers out of `App.ts` into `src/ui/tools/<tool>.ts`, one tool per PR, behind the existing `generation.runPipeline` contract. Remove the dead code the review lists first. | `App.ts` has regrown to 9,976 lines and none of it can be tested [10, 15]. | L | Each PR: the four checks, byte-identical moved blocks, a new test for the moved handler's pure part, and the smoke checklist for that tool. |

### Ease of use

| Id | Item | Why | Size | How it is verified |
|---|---|---|---|---|
| E1 | Fix "Photoshop UXP plugin" in the landing-page meta description and JSON-LD, README, CONTRIBUTING and the bridge package, and add a test that fails on "Photoshop plugin" or "Photoshop UXP" in public copy. | Adobe rejected a submission over this and the meta description is what search engines and LLMs quote [4, 16]. | S | The new test fails on the current `docs/index.html` and passes after the fix. |
| E2 | Decode ComfyUI's HTTP 400 body: a model name "not in list" becomes "Model X is not in the checkpoints folder" (reusing the wrong-folder diagnosis in `modelPlacementDiagnostics.ts`), a missing node class names its node pack. Applies to every tool, Text to Image included. | Artists currently read "ComfyUI rejected the workflow with HTTP 400" [8]. | M | Fixture tests from real 400 bodies captured from ComfyUI. Photoshop: put a model in the wrong folder, generate, and read a sentence that says where to move it. |
| E3 | A first-run path to one working image: find ComfyUI (port discovery already exists), and if nothing usable is installed, offer the smallest Apache-2.0 starter (FLUX.2 Klein 4B) with one download click. | Activation is where testers drop off; every step between install and first image costs users. | M | A fresh-profile walk-through in Photoshop, timed, with the step count written in the PR. |
| E4 | Copy Diagnostics includes the ComfyUI version, the preset, and which required nodes and models were found. | Bug reports from non-developers rarely include what is needed to reproduce. | S | Unit test on the diagnostics text; one real report pasted in the PR. |
| E5 | Correct the contributor docs: Node 20+ (22 in CI), `npm run lint` in the check list. | CONTRIBUTING says Node 18, which cannot run the test suite [18]. | S | Following CONTRIBUTING on a clean machine runs all four checks. |

### Productivity

| Id | Item | Why | Size | How it is verified |
|---|---|---|---|---|
| P1 | Batch variations, per the existing draft in [BATCH_GENERATION.md](BATCH_GENERATION.md): N results from one Generate, pick one to import. | Exploring today means clicking Generate repeatedly and losing each previous result. | M | Unit tests for batch injection on the 8 presets that already expose `batch_size`. Photoshop: 4 variations at a fixed seed arrive, and importing one places exactly that one. |
| P2 | Cache the `object_info` model lists per session (refreshed by Check ComfyUI and after a download) instead of re-querying before every Generate. | Every run starts with extra round trips before the prompt is even queued. | S | Timing log before and after on the same preset; a test that the cache refreshes after Check ComfyUI. |
| P3 | Load workflow JSON lazily and stop copying the GUI source workflows into `dist/`. | One 698 KB bundle is parsed at every panel open [17]. | S | Build output sizes in the PR; panel open time in Photoshop before and after. |

### Staying up to date

| Id | Item | Why | Size | How it is verified |
|---|---|---|---|---|
| U1 | A monthly freshness PR with a fixed checklist: dependency updates, `object_info` drift, new models or nodes worth a preset (WFL agent), and setup-pack download URLs. | Nothing currently prompts this work until a user hits a broken link or node [13, 14]. | S to set up | The first monthly PR follows the checklist and lists what it found. |
| U2 | Record a ComfyUI `/object_info` snapshot in the repo and test every preset's `requiredNodes` and inputs against it; add a script that diffs a live ComfyUI against the snapshot. | Node input renames in ComfyUI are only discovered in a user's Workflow Health card today [14]. | M | The test fails when an input is removed from the snapshot; the script's output against Mehran's ComfyUI is pasted in the PR. |
| U3 | A scheduled (not per-PR) GitHub Action that HEAD-checks every registry `downloadUrl` against its recorded size, and checks links in README and `docs/`. | Hugging Face repos move; a broken setup-pack link is found by a tester today. | S | A deliberately broken URL on a test branch makes the job fail. |
| U4 | Dependabot for the root, `bridge/` and GitHub Actions, grouped monthly. | Vite is two majors behind, TypeScript and Vitest one [13]. | S | Dependabot opens its first grouped PR and CI runs on it. |
| U5 | Major upgrades one per PR: Vitest 5, then TypeScript 7, then Vite 8. | Each changes build or test behaviour; together they would be impossible to bisect. | M each | The four checks, the build size, and a Photoshop load of the built plugin for the Vite upgrade. |
| U6 | A Photoshop version check each Adobe release: load the plugin on the new version and run the UXP smoke checklist (R7), recording results beside [photoshop-27-9-compatibility.md](photoshop-27-9-compatibility.md). A macOS tester run is part of this. | Photoshop 27.9 already changed the UI backend once; macOS has never been tested. | S per release | A dated entry per Photoshop version tested. |

The items in "What is being worked on" above stay open; R8 is the concrete form of its
"Structure" point, and the Agent Bridge token there is R2.

## Still ahead, roughly in order of appetite

- Relighting and compositing harmonisation, so an extracted layer can be matched to its new scene
- Creative and tiled upscaling, rather than the pixel/model enlargement Upscale does today
- A LoRA browser, batch variants and contact sheets
- Guided custom workflow import with node mapping and validation against `/object_info`
- Persistent per-layer generation metadata, so a layer remembers how it was made
- Pose guide previews (lineart and depth now ship as Layer Maps)

## History

Earlier milestones, kept because the reasoning in them still explains why parts of the panel are
shaped the way they are. Everything in this section has shipped.

<details>
<summary>v0.3 stabilization, v0.4 inpainting and masks, v0.6 compact interface</summary>

**v0.3 Stabilization** — GitHub Actions CI for install, type-check, tests and build; unit tests for
pure TypeScript workflow logic; PNG/lossless capture from raw Photoshop Imaging API pixels; clearer
validation errors for custom API workflow remapping; contributor, security and custom workflow docs.

**v0.4 Inpainting And Mask Workflows** — selection bounds capture, selected-region lossless capture,
selection mask export, the `inpaint-basic` and Flux Fill presets, aligned import back into the
original selection context, and the long run of mask-polarity and import-shape decisions behind
them.

**v0.6 Compact UXP Interface** — the compact dashboard with grouped tool rows and clear unavailable
states, sticky tool headers, determinate progress from the numeric WebSocket channel, collapsible
Advanced sections, scrollable prompt fields, and consistent gutters and status tones.

**v0.15 MCP Agent Bridge** — an agentic AI drives the panel's tools from natural language over a
loopback-only bridge speaking MCP to the agent and WebSocket to the panel. Bidirectional, so the
panel can ask the agent for a prompt too. Off by default, with an explicit opt-in before anything
connects. Architecture in [`docs/mcp-bridge.md`](mcp-bridge.md).

</details>

---

Anything not listed here is not refused, just unclaimed. The
[Discussions](https://github.com/MehranMarxian/OpenLayer/discussions) board is the place to argue
for something, and a report that one of the four experimental tools failed on a real picture is
worth more to this list than a feature request.
