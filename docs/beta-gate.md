# Beta gate

What has to be true before OpenLayer is tagged as a beta instead of an alpha. Each line can pass or
fail, and each says how it is checked. Nothing on this list is about adding tools: the tools are
there. It is about OpenLayer working on a machine that is not the author's, against the ComfyUI a new
user installs today.

The beta is tagged when every **Required** line passes. **Wanted** lines go in the beta's release
notes as known limitations if they are still open.

Status is as of **2026-11-04, after v0.40.0-alpha**. Each PR that closes a line updates its row in
the same change.

## Required

| # | Gate | How it is checked | Status |
|---|---|---|---|
| G1 | **Runs on a current ComfyUI.** Every runnable preset's nodes and inputs match a recorded `/object_info` from the newest ComfyUI release, and a test fails when they drift. | Roadmap U2: a snapshot in the repo, a test of every preset's `requiredNodes` against it, and a script that diffs a live ComfyUI against the snapshot. Its output against a current ComfyUI is pasted in the PR. | **Open.** Every preset has been checked only against ComfyUI 0.37.0, the version on the test machine. ComfyUI 0.40 was out by 2026-10-13. |
| G2 | **Finds Comfy Desktop.** The port scan includes Comfy Desktop's default port. | A test on `COMFY_PORT_CANDIDATES`, plus Settings › Find ComfyUI Active Port against a ComfyUI started on that port. | **Done in v0.41.** 8000 is scanned second, right after 8188, with a test. Not yet run against a real Comfy Desktop: on the test machine a ComfyUI on 8188 always answers first. A clean-install tester (G6) using Comfy Desktop checks it for real. |
| G3 | **Says so when there is no GPU.** When ComfyUI reports only a CPU device, the panel says which tools will be too slow to use, rather than failing or hanging. | A unit test with a CPU-only `/system_stats` fixture, plus one run against ComfyUI started with `--cpu`. | **Done in v0.41.** Check ComfyUI says "ComfyUI is online, but on CPU only." with the reason underneath, and Detect Hardware reports "Processor only, no graphics card", VRAM none, tier No GPU. A CPU device no longer counts its system RAM as VRAM. Checked in Photoshop 2025 on 2026-11-04 against a real Comfy Desktop instance started with `--cpu` (ComfyUI 0.38.1, port 8189), and against a GPU ComfyUI 0.44.0 on 8188, which still reports normally. |
| G4 | **Passes the full smoke checklist on the release build.** All blocks of [the UXP smoke checklist](uxp-smoke-checklist.md) on the build that will be tagged, with a row in its Results table. | The Results table. | **Open.** The only recorded full run is from v0.37.1. v0.38 to v0.40 were checked per feature, in their own PRs. |
| G5 | **Works on Photoshop 2024.** Someone other than the author runs blocks 0 to 2 of the smoke checklist on Photoshop 2024 with the beta candidate. | Their report, linked here. | **Open.** One tester confirmed the panel works on Photoshop 2024 with v0.37.1 ([issue 127](https://github.com/MehranMarxian/OpenLayer/issues/127)). Nothing newer has been run on 2024. |
| G6 | **A first image on a clean install.** From an empty ComfyUI to a first layer by following [Getting started](getting-started.md), on a machine that is not the author's. | The tester's step count and any place they got stuck, linked here. | **Open.** v0.39 timed it at seven clicks on the author's machine only. |

## Wanted

| # | Gate | How it is checked | Status |
|---|---|---|---|
| W1 | **One macOS run.** Blocks 0 to 2 of the smoke checklist on macOS. | The tester's report. | **Open.** macOS has never been run. If it is still open at the beta, the release says "Windows only, macOS untested". |
| W2 | **Exchange listing current.** The Adobe Exchange listing serves the beta, not an older alpha. | The listing's version. | **Open.** It serves an older version. Submit with the beta. |
| W3 | **The Agent Bridge session token.** | Roadmap R2, second half. | **Open.** Not a blocker: the bridge is off by default and already refuses connections from web pages. |

## Order

1. G2 and G3: small, and both decide whether a new user's first minute works.
2. G1: the snapshot test, then a run against a current ComfyUI. On the author's machine this needs a
   second ComfyUI, or an update of the shared one, which is the author's call.
3. G4 on the build that includes all of the above.
4. G5, G6 and W1 need outside testers, so recruit for them while 1 to 3 are being built.

## Not in the gate

New tools (Shots, Relight, Mockup), batch variations and the `App.ts` restructuring all wait until
the beta is tagged. A beta that works on other people's machines is worth more than one more tool
that has only run on the author's.
