# Sketch to Image LINECN Setup

OpenLayer v0.2.1 adds the Sketch to Image screen and capture/import foundation. The first target workflow is a simple SD 1.x LineArt ControlNet setup.

## Recommended First Workflow

- Checkpoint: `epicrealism_naturalSinRC1VAE.safetensors`
- ControlNet style: SD 1.5 LineArt
- ControlNet model: `control_v11p_sd15_lineart_fp16.safetensors`
- Preprocessor: `LineArtPreprocessor`
- OpenLayer preset id: `sketch2img-linecn-basic`

## Workflow File

OpenLayer includes a first candidate API workflow at:

```text
src/workflows/sketch2img-linecn-basic.json
```

This workflow was built from the local ComfyUI `/object_info` schema on the first tested Windows setup, then wired through `src/comfy/presetRegistry.ts`.

## Required Local ComfyUI Nodes

The preset requires these ComfyUI node classes:

- `CheckpointLoaderSimple`
- `LoadImage`
- `CLIPTextEncode`
- `LineArtPreprocessor`
- `ControlNetLoader`
- `ControlNetApplyAdvanced`
- `VAEEncode`
- `KSampler`
- `VAEDecode`
- `SaveImage`

## Required Models

- Checkpoint: `epicrealism_naturalSinRC1VAE.safetensors`
- ControlNet: `control_v11p_sd15_lineart_fp16.safetensors`

The workflow is intended for SD 1.x / SD 1.5 checkpoints. SDXL, SD3, Flux, and Z-Image need separate workflows because their loaders, text encoders, VAE paths, or sampler requirements may differ.

## Registry Injection Targets

OpenLayer injects runtime values into these workflow nodes:

- checkpoint: node `4`, input `ckpt_name`
- source image: node `10`, input `image`
- positive prompt: node `6`, input `text`
- negative prompt: node `7`, input `text`
- seed: node `3`, input `seed`
- steps: node `3`, input `steps`
- CFG: node `3`, input `cfg`
- denoise: node `3`, input `denoise`
- ControlNet strength: node `14`, input `strength`

If a user's ComfyUI install does not include the LineArt preprocessor or SD 1.5 LineArt ControlNet model, OpenLayer should show a setup error instead of submitting a broken graph.
