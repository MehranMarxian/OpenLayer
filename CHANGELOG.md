# Changelog

## v0.11.0-alpha - 2026-08-01

Everything here is about the distance between installing OpenLayer and being able to generate anything with it. The panel has always known exactly which model files and custom nodes its presets need, and where each one goes, but it only said so one preset at a time, in the middle of a health report, using names like `txt2img-krea2-turbo`. This release turns that knowledge into a screen you can work from: what you still need, where it goes, how big it is, what it unlocks — and, once ComfyUI reports its VRAM, which of the presets your card will actually run well.

### Added

- **A Setup screen**, on Home under Preferences. It lists every model file and custom node package the presets need, each with the folder it belongs in, its download size, which tools it unlocks, and its live status: Installed, Wrong folder, Missing, or Not checked. Rows for things you already have collapse into a one-line summary, so what is left on screen is what you still have to do.
- **Models are the list, not presets.** The 13 runnable presets share 13 model files with heavy overlap — a preset-first list prints `ae.safetensors` four times and reads as roughly 18 GB of downloads that do not exist. The remaining-download figure is therefore the sum of what is actually missing, counted once each, and it says "Nothing" when you are done rather than a number.
- **The screen is useful with ComfyUI stopped.** The requirement list is static and the status is an overlay on top of it, so every name, folder, size and link is still there when nothing can be checked — which is the state most people are in when they go looking for what to download. The tallies show a dash rather than 0 in that case, because "0 missing" against a server that never answered reads as good news.
- **A file in the wrong folder is not a download.** `CheckpointLoaderSimple` reads `models/checkpoints/` and `UNETLoader` reads `models/diffusion_models/`; a file in the wrong one of those is invisible to the workflow and looks exactly like a file you never downloaded. Those rows say you already have the file, name the folder it is sitting in, and contribute zero to the remaining download.
- **Copy Link, Copy Folder Path and Copy Page on each row**, plus notes for the cases that trip people up: licence-gated files that need the licence accepted first, Florence-2's repo-folder layout where the loader opens a directory rather than a file, alternative filenames that also work, and the fact that a newly installed custom node needs a ComfyUI restart rather than a refresh.
- **Filter chips** narrow the list to one tool — the models Inpaint needs, say — while the tallies and the download total keep describing the whole report.
- **"What will run well" ranks the presets against your card**, at the bottom of the Setup screen next to the requirements it describes. Each preset is rated Comfortable, Tight, Will offload, or Not known, best first, using the VRAM ComfyUI reports for the primary device. The rating is based on the **largest single file** in a preset's stack rather than the sum, because ComfyUI loads and offloads components at different stages of a run, so the biggest resident chunk predicts speed better than the total does. The screen says plainly that these are weight sizes and not measured VRAM use, and that a stack too big for the card runs slower rather than failing.

### Changed

- **Presets have artist-facing names now.** Every preset gained a display name, so Workflow Health shows "Krea-2 Turbo" and "Flux Fill" with the tool named alongside, instead of the internal ids `txt2img-krea2-turbo` and `inpaint-flux-fill-basic` that had been on those cards for several releases.
- **The status badge is a squared label in small caps** rather than a rounded pill in sentence case, on both the Setup screen and Workflow Health. It was changed on the shared badge itself so the two screens keep one badge language rather than rendering the same idea two ways.
- Workflow Health's "Missing workflow JSON" is now "Needs workflow JSON" — it describes the two presets whose workflows have not been authored yet, not a file that went missing from your install.

### Fixed

- **A preset with an unpublished model size was ranked as the most comfortable thing on the list.** Florence-2 is one repo-folder model that publishes no size, so its stack measured zero bytes and sorted to the top. An unknown size is not a small size: it now blocks a "Comfortable" rating, while "Tight" and "Will offload" still stand, because the part that *is* known already reaches that much on its own. A stack whose sizes are all unpublished says "Size not published" instead of "At least 0 MB".
- **A fully set up machine was told the remaining download was "unknown".** The formatter that renders model sizes treats zero as "nobody published this size", which is right for a model and exactly backwards for a total that hits zero when everything is installed — the best possible outcome, showing only on machines where setup is complete, which is the one state least likely to be caught by hand.
- Fixed the Setup filter chips rendering as gold rectangles. They are buttons carrying `aria-pressed`, which is correct for them and also opted them into the compact theme's toggle-switch styling, so a chip saying which slice of a list you were looking at was drawn like a switch that was turned on.
- Fixed the same chips then rendering as tall ovals: a 999px radius is only a pill if you control the height, and theirs came out around 28px. Their height is now stated and the radius is half of it.

### Known limitations

- Setup and Workflow Health overlap on purpose for now. Setup answers "what do I need and where does it go"; Health answers "can I run this preset right now". If that turns out to be one screen too many, Health folds into Setup rather than the reverse.
- Nothing on the Setup screen downloads anything. It copies links and folder paths for you to use elsewhere; assisted install through ComfyUI-Manager is the next item on the roadmap. The panel cannot open a browser either — `uxp.shell.openExternal` has never been called in this project — which is why every row offers Copy Link rather than a button that opens the page.
- "What will run well" reads the VRAM ComfyUI reports for its primary device. With ComfyUI stopped, or on a setup it reports oddly, every preset falls back to "Not known" and only the sizes are shown.
- **Live Painting is experimental.** The live tier needs an SD 1.5 LCM LoRA in `models/loras/`, and Start Live Session reports an error naming it if none is found. The Refine tier additionally needs the three Krea-2 Turbo files; without them the live tier still works and Refine reports what is missing. Auto-import fires when you stop the session, by design.
- Installation still requires the UXP Developer Tool. Whether a `.ccx` double-click install works on a machine that has never had developer mode enabled is documented as an open question in `docs/DISTRIBUTION_SPIKE.md` and needs a clean second machine to answer.
- The Layer Tools card on Home does not dim when ComfyUI is unreachable, unlike the generation tools. Saving to a file works with ComfyUI stopped; Send to ComfyUI will fail and report the connection error on the Layer Tools status line.
- Layer, canvas, selection, and mask capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- The Preview panel offers each tool's primary import only.
- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.10.0-alpha - 2026-07-31

The first OpenLayer release whose plugin zip is built to the ZIP specification, which matters more than a packaging note usually would: every release from v0.1.0 to v0.9.0-alpha wrote its entry paths with backslashes, and macOS refuses to unpack those into folders. Everything else here follows from the same question — what happens to somebody setting this up without anyone to ask. Workflow health now tells you which folder your "missing" model is actually sitting in, missing nodes name the package that provides them, and Live Painting stops looking half-finished.

### Added

- **Check Workflow Health now answers "the file is missing, or is it just in the wrong folder?"** When a preset's model is absent from the folder its loader reads, the report searches the other model folders and names where it found it: "Found <model> in models/diffusion_models/, but this workflow reads it from models/checkpoints/. Move the file, then refresh ComfyUI." `CheckpointLoaderSimple` reads `models/checkpoints/` and `UNETLoader` reads `models/diffusion_models/`, and a file in the wrong one of those is invisible to the workflow while looking exactly like a file that was never downloaded. This has already been the real cause of several reported "bugs".
- **A missing custom node now names the repository that provides it**, and where to put it, instead of only naming the class that was absent. Nodes that ship with ComfyUI itself say so instead, because for those the answer is an outdated or partially broken install rather than a download.
- **Live Painting has a negative prompt**, collapsed behind a disclosure button like the one on Text to Image. Both live tiers already had a CLIP text encoder wired into the sampler as its negative conditioning with the text hardcoded to empty; this makes it an input. Left blank, it produces exactly the workflow earlier releases submitted.

### Fixed

- **Release zips now store entry paths with forward slashes, as the ZIP specification requires.** Packaging used to shell out to PowerShell's `Compress-Archive`, which writes backslashes. Windows Explorer and the UXP Developer Tool tolerate that, which is how it survived nine releases unnoticed; macOS `unzip` does not, and treats the whole string as a single filename, unpacking a flat directory with no `assets/` folder so the panel cannot render. Both archives now come from the same spec-correct writer the setup pack already used, and neither depends on a platform binary being installed. **If you are on macOS and an earlier release gave you a blank panel, this was why — use this release.**
- Fixed Start Live Session and Stop Live Session rendering flush against each other, at different heights. They were the only button pair in the panel with no container, and the compact theme gives a top margin to primary buttons and nothing to plain ones.
- Fixed both of Live Painting's explanatory hints being cut off after their first clause. The shared status-line style truncates to one line with an ellipsis, which is correct for the eight status bars it was written for and wrong for a paragraph, so the two hints now opt out on their own class rather than the shared style being loosened.
- Fixed the gap above "Import Refined as Layer", which had the same cause as the Start/Stop pair one section further down.

### Changed

- Live Painting's dependency hint now says which model the live tier will use and what to do when none is chosen, instead of implying the dependency. It runs whatever is selected in the Model dropdown on Text to Image, and until this release the sentence explaining that was one of the ones being truncated.

### Known limitations

- **Live Painting is experimental.** The live tier needs an SD 1.5 LCM LoRA in `models/loras/`, and Start Live Session reports an error naming it if none is found. The Refine tier additionally needs the three Krea-2 Turbo files (diffusion model, text encoder, VAE); without them the live tier still works and Refine reports what is missing. Auto-import fires when you stop the session, by design.
- Installation still requires the UXP Developer Tool. Whether a `.ccx` double-click install works on a machine that has never had developer mode enabled is documented as an open question in `docs/DISTRIBUTION_SPIKE.md` and needs a clean second machine to answer.
- The Layer Tools card on Home does not dim when ComfyUI is unreachable, unlike the generation tools. Saving to a file works with ComfyUI stopped; Send to ComfyUI will fail and report the connection error on the Layer Tools status line.
- Layer, canvas, selection, and mask capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- The Preview panel offers each tool's primary import only. Live Painting's second action, "Import Refined as Layer", is not on the panel, because the refined result is a separate image and the panel shows one at a time.
- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.9.0-alpha - 2026-07-27

Adds the eighth tool, and finishes the status cleanup the 0.8 releases started. Layer Tools is the first thing OpenLayer does that is not a generation: it moves pixels *out* of Photoshop, into a file or into ComfyUI's input folder, which is the step that has until now meant leaving the panel.

### Added

- Added **Layer Tools**, the Home card that has said "coming soon" since it was written. Three exports — the active layer, the current selection, the selection mask — each to two destinations: a file you pick with a real Photoshop save dialog, or straight into ComfyUI's input folder where a workflow can reference it by name. Photoshop can already export a layer as PNG; what it cannot do is put one where ComfyUI can see it, and the selection mask — the export that is genuinely awkward to produce by hand — is exactly what an inpainting workflow wants.
- The selection export uses the selection's own bounds, not the padded and snapped context bounds Inpaint uses. Inpaint pads because the model needs surrounding context; an artist exporting a selection wants what they selected.
- Send to ComfyUI reuses the same `/upload/image` call every generation already makes, rather than new plumbing.

### Changed

- `exportSelectionMask` in the Photoshop adapter had been fully implemented, working, and completely unreachable for several releases — no caller anywhere in the source. Layer Tools is its first caller. The two neighbouring functions, `exportActiveLayerAsPNG` and `exportSelectionAsPNG`, were stubs that threw, carrying TODOs that named v0.4 and v0.5; both are now implemented on the existing capture path.
- Layer Tools is the first tool written to the per-tool module shape the project has been moving toward: `src/ui/tools/layerTools.ts` takes its capture, save, upload, and message-formatting collaborators as parameters, so it contains no Photoshop, no `fetch`, and no DOM. The decisions worth arguing about — which capture runs, what the artist is told, what happens when they cancel — are unit-tested instead of being unreachable inside `renderApp`. A cancelled save is treated as neither success nor error, because colouring a change of mind red is how red stops meaning anything.
- `readActiveSelectionInfo` now takes a label for the caller, so its no-selection message names what the artist was actually doing. It used to tell every caller to make a selection "before using Inpaint", including callers that had nothing to do with Inpaint.

### Fixed

- Fixed one tool's diagnostics and error text appearing on the other tools' screens, the last part of the v0.7 status bleed. `setDiagnostics` wrote all eight diagnostics lines and `setError` wrote both the Text to Image and the Settings error line, because Text to Image owns the unprefixed elements from when it was the only tool in the panel — so "Generate pressed at 09:14:22.", "Seed used: 12345." and "Enter a prompt before generating." were broadcast to Inpaint, Upscale, Outpaint, Sketch to Image, Image to Image and Prompt from Layer. Each tool now writes its own diagnostics line plus the Settings line, which stays the panel-wide log, and keeps its errors to its own screen. Panel-wide diagnostics — the port scan, the GPU report, workflow health — report on Settings, where they are actionable. One visible consequence: each tool screen now keeps its opening hint ("Capture a Photoshop selection to prepare inpainting.") until that tool is actually used, instead of losing it to the first unrelated message.

### Known limitations

- The Layer Tools card on Home does not dim when ComfyUI is unreachable, unlike the generation tools. Saving to a file works with ComfyUI stopped; Send to ComfyUI will fail and report the connection error on the Layer Tools status line.
- Layer, canvas, selection, and mask capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- The Preview panel offers each tool's primary import only. Live Painting's second action, "Import Refined as Layer", is not on the panel, because the refined result is a separate image and the panel shows one at a time.
- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.8.1-alpha - 2026-07-27

A small follow-up to v0.8.0 carrying two changes that missed that tag. The reason it exists as its own release rather than waiting for v0.9 is the first entry below: the separated Preview panel gained its Import buttons the day after v0.8.0 shipped, and handing testers a build without them would spend a round of feedback on the panel's least finished state.

### Added

- Added the Import buttons to the separated Preview panel, so a result can be placed into the document from the large preview where it is actually being judged, instead of only from the thumbnail on the dashboard. The panel does not import anything itself — it forwards the request to the same seven import handlers the dashboard uses, because those handlers own the document-identity binding, the mask-ordering assertion, the transactional cleanup, and Inpaint's readiness contract. A preview image on its own carries no record of which document it came from, so importing it directly would place pixels into whichever document happened to be active.
- The panel's buttons follow the image on screen rather than the pinned tool, stay disabled during a run and on mid-generation live frames, and report the outcome on their own status line so the result is visible when the dashboard is docked out of sight. The auto-import toggle appears only for the three tools that have that setting — Text to Image, Image to Image, and Live Painting.

### Fixed

- Re-exported `img2img-z-image-turbo`'s editable source workflow, which held the vendor's Z-Image *text-to-image* demo graph rather than the image-to-image graph OpenLayer submits — no `LoadImage` or `VAEEncode`, an `EmptySD3LatentImage` generating a blank latent, one prompt encoder instead of two, and a bypassed LoRA loader. Nothing failed at runtime, because OpenLayer submits the API workflow and never the source; the cost was that anyone opening the file to learn the workflow got a graph that cannot do image to image. This was the last entry in the equivalence checker's known-mismatch list, so the list is now empty and the setup pack advertises an editable source for all eleven presets that claim one.

### Known limitations

- The Preview panel offers each tool's primary import only. Live Painting's second action, "Import Refined as Layer", is not on the panel, because the refined result is a separate image and the panel shows one at a time.
- The status fix from v0.8.0 still covers the status bars only. The diagnostics line and the error text continue to mirror across tools: `setDiagnostics` writes all eight diagnostics lines, and `setError` writes both the Text to Image and the Settings error line. Same shape of fix, still deferred.
- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.8.0-alpha - 2026-07-27

Correctness-and-maintainability release with no new generation capability: it stops one tool's status appearing in another's status bar, fixes the error-details crash and the progress bar painting over the form, closes the preview-pinning and missing-source-workflow limitations from v0.7, and continues breaking up `App.ts`.

### Added

- Added a tool selector to the separated Preview panel so it can stay pinned to one tool instead of always following the latest publisher. The selection has its own `localStorage` key and survives restarts.
- Added a workflow-pair checker that compares every editable GUI source workflow with its API-format twin. The previous checks could catch a missing file or a mismatch with the preset registry, but could not detect source/API drift.
- Exported the four editable GUI source workflows that registered presets named but the repository did not contain: `txt2img-basic`, `img2img-basic`, `sketch2img-linecn-basic`, and `inpaint-basic`. Ten of the eleven presets that claim an editable source now ship one.
- Added ESLint to CI, including a rule that rejects `TextEncoder` and `TextDecoder` in `src/`. Node provides those globals, so TypeScript and Vitest could accept code that would fail in Photoshop UXP.
- Added `npm run audit-css` and `docs/css-audit.md` to measure the current stylesheet before consolidation. This release records the duplication but deliberately changes no CSS.

### Changed

- Continued decomposing `App.ts` by extracting tool error messages, status-bar handling, and the DOM event wiring into `toolErrorMessages.ts` (296 lines), `statusBars.ts` (383), and `appBindings.ts` (631). `App.ts` has fallen from 6,112 lines at v0.7.0 to 4,922, and from a peak of 8,149, making these behaviors easier to test and change in isolation.
- Wrote down how the two assistants working on this project divide the work, in `docs/ORCHESTRATION.md`: one implements, the other reviews, and each contribution is a separate commit so a pull request shows who did what.
- Bumped plugin, package, visible UI, and landing page metadata to `0.8.0` / `v0.8.0-alpha`.

### Fixed

- Fixed `getTechnicalErrorDetails` crashing while trying to explain another failure. Extracting the error-message helpers exposed the bad path and allowed it to be covered directly.
- Fixed Text to Image progress appearing in Inpaint, Upscale, and the other tool status bars. The old `setStatus` wrote the global bar and all seven tool and Settings bars on every call; global and Text to Image status now have separate update paths.
- Fixed the home-screen status row rendering on every tool screen and colliding with the sticky header during generation. It now stays on Home because each tool already shows the same message in its own status bar.
- Fixed the progress bar painting over the first section of the form during a run. Since v0.6 the bar had been moved up into the sticky screen header, which made the header change height the moment a run started, and Photoshop UXP does not reflow the panels below a sticky element that resizes. The bar now stays where the markup puts it, in the generation status panel under the status text it describes, and the sticky header holds the navigation and nothing else, at a constant height on every screen. The trade-off is that progress no longer stays pinned while the form is scrolled.
- Removed the hairline below the screen navigation, which Photoshop UXP drew as a stray part-width line rather than the full-width rule a browser draws. The header's own opaque background already separates it from the form.

### Known limitations

- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.
- `img2img-z-image-turbo` is the one preset whose editable source workflow does not match its API twin — the new checker reports the differing nodes and omits that source from the setup pack's `REQUIREMENTS.md` until it is re-exported. The preset itself still runs, because the API workflow is what OpenLayer submits.
- The status fix covers the status bars only. The diagnostics line and the error text still mirror across tools: `setDiagnostics` writes all eight diagnostics lines, and `setError` writes both the Text to Image and the Settings error line. Same shape of fix, deferred to a later release.
- Progress is no longer visible while a tool's form is scrolled past the status panel, which is the accepted cost of taking the bar out of the sticky header.

## v0.7.0-alpha - 2026-07-25

Release focused on getting previews out of the cramped side panel and getting a new machine to a working ComfyUI without guesswork.

### Added

- Added a second dockable Photoshop panel, **OpenLayer Preview**, showing the current generation at whatever size you drag it to. It mirrors every preview surface — Text to Image, Image to Image, Sketch to Image, Inpaint, Outpaint, Upscale, and Live Painting — with a tool badge that marks frames still arriving, a 1:1 / Fit toggle, and a checkerboard backdrop so transparent results read correctly.
- Added a generated ComfyUI setup pack, `npm run setup-pack`, producing `packages/openlayer-comfyui-setup-<version>.zip`: the workflows, an exact per-model requirements list, and a PowerShell downloader that fetches each model into the folder ComfyUI actually reads it from. Generated from the preset registry, so it cannot drift from the presets it describes.
- Added download URLs, verified sizes, and derived install folders for all 13 models the runnable presets need. Every URL was checked with a live request, and where the model was already installed locally the served size matched the working file byte for byte.
- Added licence gating for the two Flux weights. The downloader refuses to fetch them without an explicit acknowledgement and prints the non-commercial terms first.

### Changed

- Prompt from Layer no longer needs the `comfyui-custom-scripts` custom-node pack. Its caption is now published by core ComfyUI's `PreviewAny`, leaving `comfyui-florence2` as the only requirement for that tool.
- Moved UXP panel-entrypoint registration into a small standalone script loaded ahead of the application bundle. Adobe's `entrypoints.setup()` throws when called more than about 20ms after plugin start (their PS-57605), which a deferred bundle can never satisfy.
- The build now asserts that early script is present, undeferred, and ahead of the bundle, because a missing one fails as a silently blank panel in Photoshop rather than a build error.
- Bumped plugin, package, visible UI, and landing page metadata to `0.7.0` / `v0.7.0-alpha`.

### Fixed

- Fixed the separated preview panel opening blank and refusing to resize. It was never being initialised, so Photoshop collapsed it to its minimum size.
- Fixed a preview listener that threw on its first render being able to break whatever attached it.

### Known limitations

- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- The preview panel always follows whichever tool published most recently. Pinning it to one tool is designed but not built.
- Four presets name an editable GUI workflow that was never exported. The setup pack reports them and omits them rather than advertising files it does not contain.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.6.0-alpha - 2026-07-13

UXP interface release focused on a denser Photoshop-native workflow, dependable progress feedback, and final real-panel rendering fixes.

### Added

- Added a compact Adobe-style dashboard with grouped tool rows, richer icons, clearer availability states, and a restored Workflow disclosure.
- Added sticky tool headers and determinate ComfyUI progress driven by the dedicated numeric WebSocket progress channel.
- Added collapsible Advanced settings, status-pill tones, toggle chips, import success feedback, and compact experimental-info controls.

### Changed

- Standardized form gutters, panel spacing, tool-screen headers, preview zoom behavior, and progress placement across the compact theme.
- Enlarged prompt editors for Photoshop UXP, including a three-times-taller Prompt from Layer generated-text field, while retaining normal scrolling and manual resize behavior.
- Dimmed unavailable dashboard tools more clearly and switched compact controls to UXP-safe typography and explicit pixel spacing.
- Removed obsolete `control_after_generate` fields from bundled workflow JSON files.
- Bumped plugin, package, visible UI, landing page, and archive metadata to `0.6.0` / `v0.6.0-alpha`.

### Fixed

- Fixed panel actions firing twice from overlapping UXP click and pointer events.
- Fixed UXP header icons, titles, and Back to Tools controls touching or collapsing together.
- Fixed the header progress bar rendering as a short or malformed strip in Photoshop.
- Removed unreliable textarea auto-grow behavior that could make long prompt entry appear to stop accepting text in UXP.

### Known limitations

- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- Prompt from Layer still requires the local Florence-2 PromptGen workflow, custom nodes, and model files.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.5.5-alpha - 2026-07-11

Correctness and trust release: working inpaint uploads, safe cancel, aligned inpaint context, and honest status copy.

### Fixed

- Fixed ComfyUI uploads losing their filenames in Photoshop UXP. UXP's FormData saved every upload as a file named `blob`, so the Inpaint mask upload overwrote the source upload and both LoadImage nodes read the mask. Uploads now build the multipart body manually with an explicit filename per file, and inpaint-basic composites over the real captured source again.
- Fixed the Photoshop "Make is not currently available" alert during Inpaint Import to Layers. Photoshop's place command clears the active selection, so the layer mask import now restores a selection from the captured Inpaint bounds and falls back to aligned context import cleanly when no selection can be restored.
- Fixed inpaint misalignment caused by ComfyUI VAE rounding: the captured inpaint context now snaps to multiples of 8 so the generated result matches the captured context size exactly.
- Fixed multipart encoding to work without TextEncoder, which Photoshop UXP does not expose.

### Added

- Added per-preset recommended generation defaults. `txt2img-basic` now starts at 20 steps, and switching workflow presets applies that preset's recommended steps and CFG/guidance values.
- Added queue-aware Cancel Generation: prompts still waiting in the ComfyUI queue are removed with a queue delete instead of interrupting whatever job is currently running, and diagnostics report whether the prompt was dequeued or interrupted.
- Added a 16-megapixel capture guard so very large layer/canvas/mask captures fail fast with a friendly message instead of risking UXP memory failures.
- Added the `clipboard` and `launchProcess` manifest permissions used by Copy Diagnostics, Copy Prompt, and the footer links.

### Changed

- ComfyUI WebSocket preview frames are now received as arraybuffer for UXP reliability. Live KSampler step previews appear in the result preview when ComfyUI is started with `--preview-method auto`.
- The Outpaint and Sketch to Image tool cards now show the Experimental badge to match their preset status, and Z_image_Turbo warnings plus the hardware advisor no longer claim those presets are disabled.
- Bumped plugin/package metadata to `0.5.5`.

### Known limitations

- Live sampler previews require ComfyUI to be started with `--preview-method auto`, and the preview panel may flicker between steps until the planned UI polish pass.
- Capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.

## v0.5.3-alpha - 2026-07-05

Release checkpoint for the current public alpha package and landing page.

### Release status

- Verified package and manifest metadata are aligned at `0.5.3`.
- Synced README, landing page copy, release checklist, and release notes around `v0.5.3-alpha`.
- Confirmed the current tester focus: Text to Image, Image to Image, Z_image_Turbo, experimental Flux1-dev fp8 Text to Image, Prompt from Layer, Upscale, Workflow Health, Cancel Generation, session History metadata, and experimental Flux Fill Inpaint.
- Kept Outpaint clearly marked Experimental.

### Known limitations

- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- `inpaint-basic` may not match the source as reliably as the experimental Flux Fill path.
- Prompt from Layer requires the local Florence-2 PromptGen workflow, custom nodes, and model files.
- Upscale is pixel/model upscale only. It does not include latent upscale, tiled diffusion, prompt-based enhancement, or creative upscale yet.
- Custom workflow import, LoRA browser, batch variants, ControlNet panels, and true persistent Photoshop layer metadata remain future work.
- CI does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

### Not changed

- No generation logic, workflow JSON, ComfyUI client behavior, model loading, Photoshop import behavior, Inpaint/Outpaint behavior, or UI redesign changes are included in this checkpoint.

## v0.5.1-alpha - 2026-07-02

Technical stabilization for AI layer metadata and setup diagnostics.

### Added

- Added a typed OpenLayer AI layer metadata model for prompt, negative prompt, workflow preset, model, seed, dimensions, source mode, source/context bounds, import timestamp, experimental status, and diagnostics summary.
- Added pure metadata helpers for creating, sanitizing, serializing, and summarizing generated/imported result metadata.
- Added a best-effort Photoshop layer metadata writer that reports a clear unsupported fallback when safe UXP layer persistence is not exposed.
- Added inpaint/outpaint debug contract helpers for source mode, source dimensions, mask dimensions, mask polarity, context bounds, output kind, and import mode.
- Added unit coverage for layer metadata helpers, inpaint/outpaint debug contracts, and the layer metadata fallback writer.

### Changed

- Reused the new metadata helper for session history entries so current history and future persistent AI layer metadata share one data shape.
- Improved Workflow Health wording with beginner-friendly next checks for missing model files, missing ComfyUI nodes, missing workflow JSON, setup-required presets, and missing Photoshop inputs.
- Bumped plugin/package metadata to `0.5.1`.

### Not Changed

- No workflow JSON, generation behavior, ComfyUI client behavior, import behavior, Inpaint/Outpaint quality, or UI redesign changes are included in this checkpoint.
- Photoshop layer metadata persistence remains fallback-only until a safe host-supported route is verified.

## Unreleased / v0.5.0-alpha draft - 2026-07-02

Compact Adobe-style UI stabilization pass.

### Added

- Added a Settings theme selector with `Compact Adobe Dark` as the default and `Classic v0.4` as an optional legacy visual style.
- Added persisted theme preferences so the selected panel theme survives reloads.

### Changed

- Redesigned the Home screen into a compact single-column tool launcher with smaller icons, clearer tool rows, status badges, and navigation affordances.
- Applied shared spacing, typography, button height, input height, preview, panel, footer, and diagnostic polish across existing tool screens.
- Bumped plugin/package metadata to `0.5.0`.

### Not Changed

- No generation logic, workflow JSON, ComfyUI client logic, model detection, import behavior, Inpaint behavior, Outpaint behavior, History behavior, or Settings diagnostics behavior changed in this checkpoint.

## Unreleased / v0.4.10-alpha draft - 2026-07-01

Image to Image auto-import and experimental pixel Upscale foundation.

### Added

- Added an Image to Image `Import Automatically` toggle so successful Image to Image results can be imported into Photoshop as a new layer without a second click.
- Added an experimental Upscale dashboard card and Upscale screen.
- Added the experimental `upscale-basic` preset using ComfyUI `LoadImage`, `UpscaleModelLoader`, `ImageUpscaleWithModel`, and `SaveImage`.
- Added source capture, source preview, upscale model selection, result preview, import, optional auto-import, cancel support, and history metadata for Upscale.
- Added ComfyUI model inventory support for `UpscaleModelLoader` model lists.
- Added unit coverage for `upscale-basic` preset registration and workflow injection.

### Changed

- Bumped plugin/package metadata to `0.4.10`.
- Kept Inpaint and Outpaint marked Experimental and unchanged.

### Known Limitations

- Upscale is pixel/model upscale only. It does not use prompts, latent upscale, tiled diffusion, or creative enhancement yet.
- Upscale needs a local model such as `4x-UltraSharp.pth` or `RealESRGAN_x4plus.pth`.
- No Inpaint, Outpaint, Prompt from Layer, Z_image_Turbo, or Flux workflow behavior changed in this checkpoint.

## Unreleased / v0.4.9-alpha draft - 2026-06-30

Global generation safety and richer session history checkpoint.

### Added

- Extended Cancel Generation from Text to Image to the other active tools: Image to Image, Sketch to Image, Inpaint, Outpaint, and Prompt from Layer.
- Added shared ComfyUI interrupt handling for active generation tools, including watcher/polling cleanup and a clear `Generation cancelled.` status.
- Expanded session history metadata with tool type, workflow preset, model, prompt, seed, dimensions, source mode, timestamp, and import status.
- Added a safe History `Reuse Settings` action for generated-image entries.
- Added unit coverage for History metadata formatting helpers.

### Changed

- Bumped plugin/package metadata to `0.4.9`.
- Kept Inpaint and Outpaint marked Experimental; no inpaint/outpaint workflow behavior changed in this checkpoint.

### Known Limitations

- Cancel Generation uses ComfyUI's local interrupt endpoint, but it cannot undo work ComfyUI has already completed.
- History remains session-local and does not persist generation metadata into Photoshop layers yet.

## Unreleased / v0.4.8-alpha draft - 2026-06-30

Build hygiene and Outpaint availability checkpoint.

### Changed

- Bumped plugin/package metadata to `0.4.8`.
- Rebuilt the production bundle so the experimental Outpaint screen and workflow assets are included in `dist`.
- Confirmed pnpm cache/workspace artifacts are ignored and removed the local `.pnpm-store` cache from the workspace.

### Known Limitations

- Outpaint remains experimental and should be tested carefully with the local Flux Fill stack.
- No generation behavior, ComfyUI workflow behavior, or UI redesign changes are included in this checkpoint.

## Unreleased / v0.4.7-alpha draft - 2026-06-29

Flux1-dev fp8 Text to Image preset and safe generation cancellation foundation.

### Added

- Added experimental `txt2img-flux1-dev-fp8` as a runnable Text to Image preset based on the attached checkpoint-style ComfyUI workflow.
- Added `src/workflows/api/txt2img-flux1-dev-fp8.json` and preserved the GUI source workflow as `src/workflows/source/txt2img-flux1-dev-fp8.workflow.json`.
- Added experimental `prompt-from-layer-florence2` as a runnable Prompt from Layer text workflow based on the attached Florence-2 PromptGen graph.
- Added `src/workflows/api/prompt-from-layer-florence2.json` and preserved the GUI source workflow as `src/workflows/source/prompt-from-layer-florence2.workflow.json`.
- Added ComfyUI text-output polling and history parsing so OpenLayer can read `ShowText`/Florence caption output.
- Added Prompt from Layer controls for task selection and `num_beams`, defaulting to `detailed_caption` and `12`.
- Added experimental `outpaint-flux-fill-basic` as a runnable Outpaint preset based on the attached Flux Fill outpaint workflow.
- Added `src/workflows/api/outpaint-flux-fill-basic.json` and preserved the GUI source workflow as `src/workflows/source/outpaint-flux-fill-basic.workflow.json`.
- Added Outpaint controls for source capture, Flux Fill model selection, padding sides, feathering, prompt, seed, guidance, denoise, preview, and import.
- Added Workflow Health metadata for `flux1-dev-fp8.safetensors`, `CheckpointLoaderSimple`, `EmptySD3LatentImage`, `FluxGuidance`, `KSampler`, `VAEDecode`, and `SaveImage`.
- Added a Text to Image `Cancel Generation` button that appears only while generation is active.
- Added ComfyUI `/interrupt` support plus local watcher/poll cancellation handling.
- Added unit coverage for Flux1-dev fp8 and Prompt from Layer preset registration, workflow injection, workflow health, text-output parsing, and cancel request helpers.

### Changed

- Bumped plugin/package metadata to `0.4.7`.
- Kept `txt2img-basic`, `txt2img-z-image-turbo`, Image to Image, Sketch to Image, Inpaint, Settings, and imports unchanged.
- Flux1-dev fp8 maps the UI CFG control to `FluxGuidance.guidance`; the sampler CFG stays at `1` to match the attached ComfyUI workflow.

### Known Limitations

- Flux1-dev fp8 Text to Image is experimental and should be tested against the user's local ComfyUI setup.
- Prompt from Layer is experimental and requires `comfyui-florence2`, `comfyui-custom-scripts`, and `Florence-2-base-PromptGen-v2.0`.
- Outpaint is experimental and requires the Flux Fill stack: `flux1-fill-dev.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors` or the accepted T5 fp8 fallback, and `ae.safetensors`.
- Cancel Generation asks ComfyUI to interrupt and stops OpenLayer polling, but it cannot undo a job ComfyUI already completed.
- Inpaint and Flux Fill remain experimental and were not redesigned or fixed in this run.

## Unreleased / v0.4.6-alpha Flux Fill follow-up - 2026-06-29

Experimental Flux Fill inpaint workflow alignment with a tested ComfyUI reference graph.

### Added

- Added `src/workflows/source/inpaint-flux-fill-basic.workflow.json` as the GUI-editable source reference for the Flux Fill preset.
- Added a pure TypeScript Flux Fill source/mask bridge that embeds OpenLayer's white repaint mask into the uploaded PNG alpha channel for ComfyUI `LoadImage`.
- Added unit coverage for the Flux Fill alpha-mask bridge and the ported reference graph mapping.
- Added separate Inpaint source capture modes for Visible Canvas and Active Layer, plus diagnostics for accidental visible OpenLayer result layers.
- Added an experimental Photoshop-native layer-mask import attempt for Inpaint with aligned context fallback if Photoshop rejects the mask command.

### Changed

- Replaced the guessed `inpaint-flux-fill-basic` API workflow with the reference-style graph using `UNETLoader`, `DifferentialDiffusion`, `DualCLIPLoader`, `FluxGuidance`, `ConditioningZeroOut`, `InpaintModelConditioning`, regular `KSampler`, `VAEDecode`, and `SaveImage`.
- Corrected Flux Fill `DualCLIPLoader` mapping to use `clip_l.safetensors` on `clip_name1` and `t5xxl_fp16.safetensors` on `clip_name2`, while keeping `t5xxl_fp8_e4m3fn.safetensors` as an accepted T5 fallback.
- Removed the Flux Fill `ImageCompositeMasked` output path from the experimental API workflow so the saved result comes directly from the decoded inpaint result.

### Known Limitations

- Inpaint and Flux Fill remain experimental.
- Flux Fill still needs manual Photoshop + ComfyUI testing for final output quality, mask polarity, and aligned import behavior.
- OpenLayer still imports the Flux Fill result as an aligned context layer; Photoshop-native layer-mask import remains future work.
- Photoshop-native layer-mask import is experimental and must be verified in real Photoshop documents before it can replace fallback behavior.

## Unreleased / v0.4.6-alpha draft - 2026-06-28

Settings diagnostics readability and public alpha release-readiness pass.

### Added

- Added Workflow Health summary cards for Ready, Experimental, Missing setup, and Needs workflow counts.
- Added collapsed technical details for workflow health cards so artists see short readable messages first.
- Added a public alpha release checklist in `docs/release-checklist.md`.
- Added clearer local permission notes for filesystem, local ComfyUI network access, and local-only diagnostics.
- Added Flux Fill preflight validation for source/mask presence, matching dimensions, and selection context before submitting the experimental inpaint workflow.
- Added Flux Fill debug diagnostics showing preset, source size, mask size, model stack, and the current white-mask-means-repaint assumption.
- Added Inpaint output diagnostics for source, mask, raw result dimensions, output kind, mask polarity, and import mode.
- Added temporary local debug copies for Inpaint source PNG, mask PNG, and raw generated result PNG.
- Added Inpaint output selection by expected `SaveImage` node so uploaded source/mask images are not mistaken for final ComfyUI results.

### Changed

- Bumped plugin/package metadata to `0.4.6`.
- Rebuilt the Settings diagnostic layout with UXP-safe block and flex rules so panels and buttons stack cleanly in narrow Photoshop panels.
- Moved Settings actions into one full-width action stack: Check ComfyUI, Find ComfyUI Active Port, Detect GPU, Check Workflow Health, Copy Diagnostics, Save Settings, and Reset Defaults.
- Simplified Hardware Advisor rows and shortened the Z_image_Turbo / Flux explanation in Settings.
- Updated the experimental Flux Fill model-stack metadata to prefer `t5xxl_fp16.safetensors` while accepting `t5xxl_fp8_e4m3fn.safetensors` as a local T5 fallback.
- Updated `inpaint-flux-fill-basic.json` to use the wiki-style DualCLIPLoader mapping with T5 on `clip_name1` and CLIP-L on `clip_name2`.
- Disabled the active transparent mask compositing import path for now so Photoshop UXP cannot get stuck on `Preparing transparent inpaint patch...`.
- Kept Inpaint import fallback explicit: generated Inpaint results now import with aligned context fallback until a Photoshop-native layer mask strategy is implemented.
- Synced the GitHub Pages landing page with the v0.4.6-alpha release story, including PNG/lossless capture, GPU/VRAM diagnostics, Workflow Health, Copy Diagnostics, Z_image_Turbo experiments, Prompt from Layer foundation, and experimental Inpaint/Repaint Selection.
- Kept Inpaint, Flux Fill, Prompt from Layer, and custom workflow import messaging honest for public alpha testing.

### Known Limitations

- This release-readiness pass does not change generation behavior, workflow JSON files, model loading, ComfyUI requests, or import behavior.
- Workflow Health remains advisory and technical details are still meant for setup/debugging, not everyday artist controls.
- Inpaint/Repaint Selection remains experimental and output quality/alignment are not confirmed stable.
- Flux Fill remains experimental and still needs real Photoshop + ComfyUI testing for quality, mask polarity, and aligned import behavior.
- Transparent outside-mask import is disabled in the active Photoshop path because UXP canvas/blob compositing is not trusted yet. OpenLayer uses aligned context fallback and reports that in diagnostics.
- CI does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## Unreleased / v0.4.5-alpha draft - 2026-06-28

Settings diagnostics stabilization for readable workflow health testing.

### Added

- Added a Copy Diagnostics action in Settings that prepares a compact local setup report for tester feedback.
- Added clearer Settings guidance explaining that `Z_image_Turbo` is a diffusion model stack, not a checkpoint, and that Flux presets still need matching workflow JSON.

### Changed

- Bumped plugin/package metadata to `0.4.5`.
- Reworked the Settings diagnostics layout so panels, buttons, hardware rows, and workflow health cards remain readable in narrow Photoshop panels.
- Grouped Workflow Health results into readable preset cards with artist-facing summaries and secondary technical detail.
- Improved workflow health summary wording, including missing workflow JSON counts.
- README tester notes now include Copy Diagnostics and Settings readability checks.

### Known Limitations

- This is a diagnostics polish release. It does not change generation behavior, workflow JSON files, model loading, or import behavior.
- Workflow Health remains advisory and does not auto-install models, remap workflow node IDs, or enable future Flux presets.

## Unreleased / v0.4.4-alpha draft - 2026-06-28

Workflow health diagnostics foundation for safer local setup testing.

### Added

- Added a Settings workflow health checker that evaluates every registered preset against local ComfyUI node classes and installed model files.
- Added compact readiness states for Ready, Experimental, Missing model, Missing ComfyUI node, Missing workflow JSON, and Setup required.
- Added ComfyUI node-availability inspection through `/object_info` without changing any generation paths.
- Added unit coverage for workflow health states, including Z_image_Turbo stack readiness and future Flux missing-workflow behavior.

### Changed

- Bumped plugin/package metadata to `0.4.4`.
- README tester notes now include the Settings workflow health check.

### Known Limitations

- Workflow health is diagnostic only. It does not auto-install missing models, remap node IDs, or enable future Flux presets.
- Existing generation behavior, workflow JSON files, imports, and panel design are unchanged.

## Unreleased / v0.4.3-alpha draft - 2026-06-28

Workflow compatibility checkpoint for Z_image_Turbo and future layer captioning.

### Added

- Added experimental `txt2img-z-image-turbo` and `img2img-z-image-turbo` API workflows using `UNETLoader`, `CLIPLoader`, `VAELoader`, `ModelSamplingAuraFlow`, and `KSampler`.
- Added diffusion-model-stack model selector refresh so Z_image_Turbo presets can list `UNETLoader` models such as `z_image_turbo_bf16.safetensors` instead of checkpoint files.
- Preserved the attached ComfyUI GUI workflow exports under `src/workflows/source/` as editable source references.
- Added a new Prompt from Layer dashboard card and foundation screen with PNG source capture, generated-prompt text area, Copy Prompt, and Send to Text to Image controls.

### Changed

- Z_image_Turbo presets are now experimental runnable presets instead of disabled future metadata when required local nodes/models are available.
- Documentation now explains why Z_image_Turbo does not appear in checkpoint-only selectors.

### Known Limitations

- Z_image_Turbo support is experimental and should be tested with the user's local ComfyUI setup before release.
- Prompt from Layer does not run Florence-2 PromptGen yet; it is a foundation screen until a validated API workflow and text-output reader are added.
- Flux Text to Image and Image to Image remain setup-required future presets.

## Unreleased / v0.4.2-alpha draft - 2026-06-27

End-of-week stabilization checkpoint for honest inpaint testing.

### Changed

- Marked Inpaint/Repaint Selection as experimental in the Home dashboard while keeping it available for testing.
- Added a small Inpaint screen warning explaining that output quality and Photoshop alignment are still being tested.
- Added a clearer Flux Fill warning for workflow tuning around guidance, denoise, mask blur, and context size.
- Documented the current Inpaint limitations and next debugging checklist.
- Began using the workflow intelligence layer for UI diagnostics in Text to Image, Image to Image, Sketch to Image, Inpaint, and Settings.
- Added artist-facing workflow readiness messages for model-family mismatch, setup-required presets, missing source/selection inputs, and experimental workflows without changing generation behavior.

### Known Limitations

- No major inpaint algorithm, alignment, or workflow rewrite was attempted in this checkpoint.
- Inpaint output may still appear incorrect, gray, partial, or not artist-usable until the source/mask/workflow behavior is verified more deeply.
- Flux Fill remains experimental and may require dedicated workflow tuning before it becomes a dependable OpenLayer preset.

## v0.4.1-alpha - 2026-06-25

Real experimental mask-based Inpaint path for SD 1.x testing.

### Added

- Photoshop selection mask export using a temporary white-filled selection layer inside `executeAsModal`, captured back as a PNG/lossless grayscale mask.
- Runnable `inpaint-basic` ComfyUI API workflow using `LoadImage`, `ImageToMask`, `InpaintModelConditioning`, `KSampler`, `VAEDecode`, `ImageCompositeMasked`, and `SaveImage`.
- Experimental `inpaint-flux-fill-basic` workflow preset for local Flux Fill stacks using `UNETLoader`, `DualCLIPLoader`, `VAELoader`, Flux sampler nodes, and `flux1-fill-dev.safetensors` when available.
- Inpaint generation path that uploads both selected-region source PNG and mask PNG to ComfyUI.
- Aligned Inpaint import path that places the generated context patch back over the captured Photoshop selection context.
- Inpaint mask preview, live progress preview, final result preview, history entry, and existing `Import to Layers` support.
- Unit coverage for `inpaint-basic` preset registration and workflow injection.

### Changed

- Bumped plugin/package metadata to `0.4.1`.
- `inpaint-basic` is now an experimental runnable SD 1.x preset instead of a disabled placeholder.
- `inpaint-basic` now uses `InpaintModelConditioning` so SD inpaint checkpoints receive source and mask context more directly.
- Inpaint errors now explain missing mask export, missing ComfyUI inpaint nodes, or checkpoint/workflow mismatches without flooding the panel with raw logs.

### Known Limitations

- Inpaint is currently safest with SD 1.x checkpoints such as `epicrealism_naturalSinRC1VAE.safetensors`.
- Flux Fill inpainting is experimental and requires `flux1-fill-dev.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors` or accepted fallback `t5xxl_fp8_e4m3fn.safetensors`, and `ae.safetensors` in the matching ComfyUI model folders.
- Selection mask export uses a temporary-layer fallback path. If Photoshop rejects that path, OpenLayer keeps source capture available and shows a friendly mask error.
- Selection preservation remains future work.
- CI does not run Photoshop, UXP, or ComfyUI integration tests.

## v0.4.0-alpha - 2026-06-25

Selection-aware inpainting foundation for safe Photoshop alpha testing.

### Added

- Available Inpaint launcher card and a new Inpaint tool screen using the existing OpenLayer design language.
- Safe Photoshop selection detection with friendly no-selection errors.
- Selected-region PNG/lossless capture using Photoshop Imaging API source bounds when available.
- Source preview, mask preview placeholder, prompt, negative prompt, workflow selector, checkpoint selector, denoise, steps, CFG, seed, status, errors, result preview, and guarded `Import to Layers` action for Inpaint.
- Placeholder experimental `inpaint-basic` workflow preset registered in the preset system.
- Unit tests for pure selection bounds normalization and status-friendly formatting.

### Changed

- Bumped plugin/package metadata to `0.4.0`.
- README and docs now explain the current Inpaint foundation and its mask/export limitations.
- Photoshop adapter TODO paths now describe selection mask export, aligned regional import, and selection preservation more clearly.

### Known Limitations

- `inpaint-basic` is intentionally disabled until a validated ComfyUI API workflow JSON and mask mapping exist.
- True grayscale selection mask export is not available yet.
- Selection preservation and aligned regional import remain future work.
- CI does not run Photoshop, UXP, or ComfyUI integration tests.

## v0.3.0-alpha - 2026-06-25

Stabilization release focused on reliability, testability, source capture quality, and repo maturity.

### Added

- GitHub Actions CI for pull requests and pushes to `main`.
- `npm test` using Vitest for pure TypeScript unit tests.
- Unit tests for workflow building, preset registry behavior, settings validation, model compatibility, and error helpers.
- PNG/lossless Photoshop source capture path for Image to Image and Sketch to Image using raw Imaging API pixels.
- Explicit source capture metadata for format, filename, MIME type, dimensions, and source name.
- Internal PNG encoder with unit coverage for lossless source-image upload.
- Contributor, security, issue template, roadmap, and custom workflow docs.
- Future inpainting architecture types for selection bounds, mask export, aligned regional import, and preserved selection operations.

### Changed

- Image to Image and Sketch to Image source previews now report PNG/lossless source capture.
- Workflow validation errors now include clearer preset remapping guidance for custom ComfyUI API workflows.
- README release notes now describe the v0.3.0-alpha stabilization focus and test commands.
- Bumped plugin/package metadata to `0.3.0`.

### Known Limitations

- PNG/lossless capture depends on Photoshop UXP exposing raw `imageData.getData()` pixels. If that API is unavailable, capture now fails clearly instead of falling back to JPEG.
- Dedicated selected-layer PNG export, mask export, selection preservation, and aligned regional import remain future inpainting work.
- Flux, SD3/SD3.5, and Z_image_Turbo dedicated workflows remain disabled until validated API workflow JSON files exist.
- CI does not run Photoshop, UXP, or ComfyUI integration tests.

## v0.2.1-alpha - 2026-06-23

Sketch to Image LINECN foundation for pre-release testing.

### Added

- Available Sketch to Image launcher card and tool screen.
- Photoshop active-layer and canvas capture reuse for Sketch to Image source input.
- `sketch2img-linecn-basic` workflow preset for a simple SD 1.x LineArt ControlNet path.
- Candidate ComfyUI API workflow at `src/workflows/sketch2img-linecn-basic.json`.
- Required ComfyUI setup validation for the LINECN preset before generation.
- Source preview, prompt, negative prompt, checkpoint selector, ControlNet strength, denoise, result preview, and `Import to Layers` action for Sketch to Image.
- Friendly setup errors for missing LineArt preprocessor nodes or the SD 1.5 LineArt ControlNet model.
- Workflow compatibility docs for SD/SDXL defaults, experimental model families, and the LINECN starter preset.

### Changed

- Bumped plugin/package metadata to `0.2.1`.
- Updated alpha docs and landing page copy for Text to Image, Image to Image, Sketch to Image, Settings, History, and current limitations.
- Added the current Home dashboard screenshot to release documentation.

### Required For Sketch To Image LINECN

- Recommended checkpoint: `epicrealism_naturalSinRC1VAE.safetensors`
- Required ControlNet model: `control_v11p_sd15_lineart_fp16.safetensors`
- Required ComfyUI node classes: `CheckpointLoaderSimple`, `LoadImage`, `CLIPTextEncode`, `LineArtPreprocessor`, `ControlNetLoader`, `ControlNetApplyAdvanced`, `VAEEncode`, `KSampler`, `VAEDecode`, and `SaveImage`.

### Known Limitations

- Sketch to Image currently targets one known-good SD 1.x LINECN workflow.
- SDXL, SD3, Flux, and Z-Image Sketch to Image workflows need dedicated future presets.
- The Sketch source capture uses the same JPEG Imaging API path as Image to Image.
- Advanced sketch controls, separate guide previews, inpainting, masks, and selection-aware workflows remain future work.

## v0.2.0-alpha - 2026-06-22

Image-to-image foundation for the next OpenLayer workflow family.

### Added

- Photoshop-dark Home dashboard with tool cards for active tools, history, settings, and future workflow areas.
- Available Image to Image launcher card and tool screen.
- Experimental active Photoshop layer capture using Photoshop UXP Imaging API.
- Source image preview before upload so users can confirm what will be sent to ComfyUI.
- Canvas capture option for using the visible document as the Image to Image source.
- ComfyUI `/upload/image` support for local source images.
- `img2img-basic` workflow preset using built-in ComfyUI nodes.
- Workflow registry and validation coverage for `img2img-basic`.
- Image to Image generation status, result preview, and import as a new Photoshop layer.
- Full checkpoint visibility on Image to Image, with SD 1.x, SDXL, SD3, and Flux compatibility guidance.
- Experimental checkpoint mode for trying SD3/Flux-style checkpoints without hiding them from the selector.
- Short pre-release tester checklist for Photoshop and ComfyUI on port `8190`.

### Changed

- Refined shared header, status row, footer, and Home dashboard card spacing.
- Improved responsive behavior for Home, Text to Image, Image to Image, Settings, and History in narrow and wide Photoshop panels.
- Reduced long technical ComfyUI errors in the Image to Image panel while keeping details in logs.

### Known Limitations

- Active-layer capture is currently encoded as JPEG through Photoshop's Imaging API.
- True PNG selected-layer export, mask export, selection preservation, and aligned regional workflows remain planned future work.
- The Image to Image workflow is a starter preset and may need node ID/checkpoint adjustments for custom ComfyUI setups.
- `img2img-basic` is still the default SD 1.x/SDXL preset. Flux, SD3, and SD3.5 checkpoints usually need dedicated future workflow presets.
- The panel design was not redesigned in this release.

## v0.1.10-alpha - 2026-06-22

Text-to-image usability and pre-release polish.

### Added

- Settings persistence for ComfyUI URL, workflow, checkpoint, and generation defaults.
- Passive local ComfyUI port finder for common local ports, including `8190` and `8188`.
- Session History view for the last five generated images with preview and import actions.
- Optional auto-import toggle after generation completes.
- Collapsible negative prompt section on the Text to Image screen.

### Changed

- Text to Image screen now uses the new launcher flow more consistently.
- Generate and import actions use the OpenLayer orange action color.
- Settings page now includes clearer diagnostics for server URL, checkpoint count, selected checkpoint, and Photoshop document state.
- Panel spacing and scrolling were refined for Photoshop UXP, with remaining narrow-panel polish planned for a later UI pass.

## v0.1.9-alpha - 2026-06-22

Reliability sprint for the MVP engine.

### Added

- Workflow preset registry for `txt2img-basic`.
- Workflow validation before submitting to ComfyUI.
- Generation settings validation and safe clamping.
- Clearer generation state messages for connection, queue, execution, retrieval, and completion.
- Optional ComfyUI WebSocket progress monitoring with best-effort live preview frames.
- Centralized friendly OpenLayer errors.
- Beginner testing checklist in `docs/testing-v0.1-alpha.md`.
- Photoshop-dark tool launcher home screen with an enabled Text to Image card and Coming Soon cards for future tools.
- UXP-safe launcher rendering using flex cards and text icon badges.
- Available Settings page with ComfyUI URL, Check ComfyUI, status, diagnostics, and MVP defaults.
- Tool cards now use block-level rows for icon/title, subtitle, and status to avoid Photoshop UXP flattening text into one line.
- Launcher cards now use div-based controls instead of native button elements to avoid UXP button text flattening.

### Changed

- Package output now follows the current package version and alpha label.
- The generated seed is shown after generation and written back into the seed field.

## v0.1.8-alpha - 2026-06-22

First public MVP preview of OpenLayer.

### Added

- Photoshop UXP panel for OpenLayer.
- Local ComfyUI server URL input and connection check.
- Checkpoint selector loaded from the local ComfyUI server.
- `txt2img-basic` workflow preset.
- Prompt, negative prompt, width, height, steps, CFG, and seed controls.
- ComfyUI prompt submission, history polling, and generated image retrieval.
- Result preview inside the panel.
- Import generated result into the active Photoshop document as a new named layer.
- Official OpenLayer icon assets.
- Static GitHub Pages landing page in `docs/index.html`.

### Known Limitations

- Only text-to-image generation is supported.
- Custom ComfyUI workflows may require node ID changes in `src/comfy/workflowBuilder.ts`.
- Selected layer export, image-to-image, inpainting, masks, upscaling, and ControlNet-style workflows are planned for later versions.
- The UI is functional and UXP-safe, but still early.
