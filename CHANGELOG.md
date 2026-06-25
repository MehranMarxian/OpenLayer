# Changelog

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
