# Changelog

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
