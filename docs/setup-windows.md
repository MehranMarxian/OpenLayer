# OpenLayer Windows Setup

## Install Dependencies

```powershell
npm install
```

## Build The Plugin

```powershell
npm run build
```

The compiled UXP plugin is written to:

```text
dist
```

## Load In Adobe UXP Developer Tool

1. Open Adobe UXP Developer Tool.
2. Choose `Add Plugin`.
3. Select `dist\manifest.json`.
4. Click `Load`.
5. Open Photoshop 2024 or newer.
6. Open the OpenLayer panel from Photoshop Plugins.

## Start ComfyUI

Start ComfyUI using your normal Windows launch command. The default OpenLayer URL is:

```text
http://127.0.0.1:8190
```

OpenLayer uses `8190` by default so it does not interfere with another plugin that may already be using ComfyUI on `8188`.

If your other plugin is already using ComfyUI on `8188`, start a second ComfyUI instance for OpenLayer on `8190`, for example:

```powershell
python main.py --listen 127.0.0.1 --port 8190
```

## First Test

1. Open a Photoshop document.
2. Click `Check ComfyUI`.
3. Optional: open Settings and click `Detect GPU & Recommend Models`.
4. Enter a prompt.
5. Click `Generate`.
6. After the preview appears, click `Import Result as New Layer`.

If generation fails, confirm the checkpoint name in `src/workflows/txt2img-basic.json` exists in your ComfyUI models folder.

## GPU And Model Recommendations

The Settings button `Detect GPU & Recommend Models` asks ComfyUI for `/system_stats`, then shows the GPU, available VRAM, detected model families, and practical recommendations.

This is advisory only. OpenLayer does not auto-switch models yet.

If `Z_image_Turbo` is installed as a diffusion model, it may not appear in the checkpoint selector. That is expected because the current stable starter workflows use `CheckpointLoaderSimple`. See `docs/model-guide.md` for the beginner model guide.

## Sketch To Image LINECN Test

The first Sketch to Image preset is intentionally narrow and uses a SD 1.x LineArt ControlNet workflow.

Required ComfyUI setup:

- Checkpoint: `epicrealism_naturalSinRC1VAE.safetensors`
- ControlNet model: `control_v11p_sd15_lineart_fp16.safetensors`
- Node classes: `LineArtPreprocessor`, `ControlNetLoader`, and `ControlNetApplyAdvanced`

Quick test:

1. Open a Photoshop document with a visible layer or canvas.
2. Open OpenLayer and choose `Sketch to Image`.
3. Click `Capture Active Layer` or `Capture Canvas`.
4. Keep the workflow set to `sketch2img-linecn-basic`.
5. Choose `epicrealism_naturalSinRC1VAE.safetensors`.
6. Enter a prompt and click `Generate Sketch to Image`.
7. Click `Import to Layers`.

If this fails with a setup message, install the required LineArt preprocessor/custom nodes or the SD 1.5 LineArt ControlNet model, then restart ComfyUI and click `Check ComfyUI` again.
