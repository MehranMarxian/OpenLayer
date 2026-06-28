# OpenLayer Model And VRAM Guide

OpenLayer is local-first, so the best model depends on your ComfyUI setup and your graphics card memory.

## What VRAM Means

VRAM is the memory on your graphics card. Image models use VRAM while loading the model, encoding prompts, sampling, decoding images, and running extra guidance nodes such as ControlNet.

More VRAM usually means you can use larger models, higher resolution, more complex workflows, or faster iteration. Less VRAM does not mean OpenLayer is unusable. It means you should start with smaller and more reliable workflows.

## Why OpenLayer Uses ComfyUI Hardware Detection

OpenLayer runs inside Photoshop UXP, which is sandboxed. Instead of trying to inspect your Windows hardware directly, OpenLayer asks the active local ComfyUI server for `/system_stats`.

That is the right source of truth because ComfyUI is the program that actually loads and runs the AI model.

## Recommended Model Families By VRAM

These are practical starter guidelines, not strict rules.

| VRAM range | OpenLayer recommendation |
| --- | --- |
| Under 8 GB | Start with SD 1.x checkpoints at 512px. Keep steps modest. |
| 8-12 GB | SD 1.x is comfortable. SDXL can be tested carefully. |
| 12-24 GB | SDXL is a good quality default. Heavier families can be tested with dedicated presets. |
| 24 GB or more | Good for SDXL and serious testing of Flux, SD3.5, and future Z_image_Turbo workflows. |

## Current OpenLayer Workflow Support

| Task | Recommended current family | Notes |
| --- | --- | --- |
| Text to Image | SD 1.x or SDXL | Uses `txt2img-basic`. |
| Image to Image | SD 1.x or SDXL | Uses `img2img-basic`. |
| Sketch to Image | SD 1.x | Uses `sketch2img-linecn-basic` with LineArt ControlNet. |
| Z_image_Turbo Text/Image | Z_image_Turbo | Experimental dedicated presets in v0.4.3-alpha. |
| Prompt from Layer | Florence-2 PromptGen | Foundation only; text generation workflow is not enabled yet. |
| Future Realtime Preview | To be tested | Likely needs a very fast dedicated workflow. |

## Why Z_image_Turbo Does Not Appear In The Checkpoint Selector

Some models are not checkpoints.

`Z_image_Turbo` is a diffusion model stack in ComfyUI. In a typical graph it may use:

- `Load Diffusion Model` for `z_image_turbo_bf16.safetensors`
- `Load CLIP` for a matching CLIP model such as `qwen_3_4b.safetensors`
- `Load VAE` for a matching VAE such as `ae.safetensors`

OpenLayer's SD/SDXL starter workflows use `CheckpointLoaderSimple`, so they only list checkpoint files in the checkpoint selector.

The experimental Z_image_Turbo presets use a separate diffusion-model-stack path. When one of those workflows is selected, OpenLayer asks ComfyUI for models from `UNETLoader` instead of `CheckpointLoaderSimple`.

## How OpenLayer Chooses Recommendations

The Settings advisor combines:

- GPU and VRAM reported by ComfyUI
- model families detected from ComfyUI model loader lists
- current workflow presets
- known model family compatibility
- whether a model stack is only detected or actually runnable through an OpenLayer preset

OpenLayer does not auto-switch your model yet. Recommendations are advisory so artists stay in control.

## Practical Starting Advice

For reliable testing today:

1. Use SDXL for general Text to Image quality if your GPU can handle it.
2. Use SD 1.x for the current Sketch to Image LINECN workflow.
3. Treat Z_image_Turbo as experimental and Flux/SD3.5 as future dedicated preset work until OpenLayer has matching API workflow JSON files for each family.
4. Use the Settings button `Detect GPU & Recommend Models` after starting ComfyUI.
