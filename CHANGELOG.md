# Changelog

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
