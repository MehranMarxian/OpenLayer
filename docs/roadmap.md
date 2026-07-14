# OpenLayer Roadmap

OpenLayer is a local-first Photoshop UXP plugin for artist-friendly ComfyUI workflows. The roadmap favors a trustworthy foundation before larger creative features.

## Current Alpha Features

- Text to Image with `txt2img-basic`
- Image to Image with active-layer or canvas capture
- Sketch to Image with the SD 1.x LINECN starter workflow
- Experimental Inpaint with Photoshop selection detection, selected-region PNG capture, grayscale mask export, aligned context import, SD 1.x `inpaint-basic`, and experimental Flux Fill preset metadata/workflow
- Experimental Outpaint with active-layer/canvas capture and Flux Fill `ImagePadForOutpaint` canvas expansion
- Prompt from Layer available for alpha testing with Florence-2 PromptGen
- Flux Fill metadata prefers `t5xxl_fp16.safetensors`, accepts `t5xxl_fp8_e4m3fn.safetensors` as a T5 fallback, and validates source/mask dimensions before submit
- Inpaint output diagnostics and best-effort transparent outside-mask import, with aligned context fallback when compositing is unavailable
- Import generated results as new Photoshop layers
- Local ComfyUI connection, checkpoint loading, and status diagnostics
- GPU-aware model recommendations
- Workflow preset registry with disabled future metadata for Flux and Z_image_Turbo

## v0.3 Stabilization

- GitHub Actions CI for install, type-check, tests, and build
- Lightweight unit tests for pure TypeScript workflow logic
- PNG/lossless source capture from raw Photoshop Imaging API pixels
- Clearer workflow validation errors for custom API workflow remapping
- Contributor, security, issue template, and custom workflow docs

## v0.4 Inpainting And Mask Workflows

- Selection bounds capture (started in v0.4.0-alpha)
- Selected-region PNG/lossless source capture (started in v0.4.0-alpha)
- Selection mask export (started in v0.4.1-alpha)
- Experimental `inpaint-basic` preset with real source and mask inputs (started in v0.4.1-alpha)
- Experimental `inpaint-flux-fill-basic` preset for local Flux Fill stacks (started in v0.4.1-alpha)
- Continue Flux Fill testing against real Photoshop selections, including mask polarity, source/context size, and aligned import behavior
- Verify whether the transparent outside-mask import path works reliably across Photoshop UXP environments or should be replaced by Photoshop layer-mask import
- Import generated regions aligned to the original selection context (started in v0.4.1-alpha)
- Confirm inpaint mask polarity for SD inpaint and Flux Fill workflows
- Decide between full-canvas import, cropped patch import, transparent outside-mask import, or Photoshop layer-mask import
- Verify inpaint output quality and Photoshop alignment before calling the feature stable
- Preserve and restore selection state
- Add cleaner transparency/layer-mask options for imported inpaint patches

## v0.6 Compact UXP Interface

- Compact Adobe-style dashboard with grouped tool rows and clearer unavailable states
- Sticky tool headers with stable spacing in the real Photoshop UXP renderer
- Determinate ComfyUI progress driven by the numeric WebSocket progress channel
- Collapsible Advanced settings and compact experimental-info controls
- Larger, scrollable prompt fields without unreliable auto-grow behavior
- Consistent form gutters, status tones, toggle feedback, and import success feedback

## Future Custom Workflow Importer

- Guided API workflow import
- Node mapping UI for prompts, model inputs, source image, seed, steps, CFG, denoise, and outputs
- Validation against local ComfyUI `/object_info`
- Safer workflow preset save/load

## Future Directions

- Dedicated Flux, SD3.5, and Z_image_Turbo workflows
- LoRA browser
- Batch variants
- Contact sheet generation
- Upscaling
- Style reference
- Realtime local preview experiments
- Cancel or interrupt long-running ComfyUI jobs from the panel
- Persistent generation metadata for prompt, seed, checkpoint, source, mask, and workflow
- Future simplified UI once the technical workflow paths are stable
- Better guide previews for lineart, depth, pose, and related control workflows
