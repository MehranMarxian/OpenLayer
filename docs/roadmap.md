# OpenLayer Roadmap

OpenLayer is a local-first Photoshop UXP plugin for artist-friendly ComfyUI workflows. The roadmap favors a trustworthy foundation before larger creative features.

## Current Alpha Features

- Text to Image with `txt2img-basic`
- Image to Image with active-layer or canvas capture
- Sketch to Image with the SD 1.x LINECN starter workflow
- Experimental Inpaint with Photoshop selection detection, selected-region PNG capture, grayscale mask export, aligned context import, SD 1.x `inpaint-basic`, and experimental Flux Fill preset metadata/workflow
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
- Import generated regions aligned to the original selection context (started in v0.4.1-alpha)
- Confirm inpaint mask polarity for SD inpaint and Flux Fill workflows
- Decide between full-canvas import, cropped patch import, transparent outside-mask import, or Photoshop layer-mask import
- Verify inpaint output quality and Photoshop alignment before calling the feature stable
- Preserve and restore selection state
- Add cleaner transparency/layer-mask options for imported inpaint patches

## v0.5 Custom Workflow Importer

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
