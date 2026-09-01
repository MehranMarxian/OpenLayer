# Getting started

Walkthroughs for your first run with each tool. Install the plugin first — see the
[README](../README.md#installation).

## Starting ComfyUI

Start ComfyUI locally using your normal ComfyUI launch command. Confirm the server is reachable:

```bash
curl http://127.0.0.1:8190/system_stats
```

In OpenLayer, keep the default server URL or enter your own:

```text
http://127.0.0.1:8190
```

OpenLayer uses port `8190` by default so it does not interfere with another tool that may already be
using ComfyUI on port `8188`.

**You do not have to move your server to 8190.** If ComfyUI is already running somewhere else — 8188
or anywhere — open **Settings** and click **Find ComfyUI Active Port**. OpenLayer scans for the running
server, connects to it, and reports `Ready`. Use your normal launch command and leave it where it is.

Starting a dedicated instance on 8190 is the other option, not the required one:

```bash
python main.py --listen 127.0.0.1 --port 8190 --preview-method auto
```

`--preview-method auto` is optional but recommended: it makes ComfyUI stream live KSampler step previews into the OpenLayer result preview while generating.

Click `Check ComfyUI` before generating.

## First Image

1. Open a Photoshop document.
2. Open the OpenLayer panel.
3. Open Settings and click `Find ComfyUI Active Port` or `Check ComfyUI` to load the available checkpoints.
4. Optional: click `Detect GPU & Recommend Models` to see hardware-aware model suggestions.
5. Choose a checkpoint.
6. Enter a prompt.
7. Optionally enter a negative prompt.
8. Keep the workflow preset set to `txt2img-basic`.
9. Click `Generate`.
10. Wait for the preview.
11. Click `Import Result as New Layer`, or enable `Import Result Automatically` before generating.

The imported layer is named like:

```text
OpenLayer_Generated_YYYYMMDD_HHMM
```

## First Image To Image Test

1. Open a Photoshop document.
2. Select the layer you want to use as the source.
3. Open the OpenLayer panel and choose `Image to Image`.
4. Click `Capture Active Layer`, or click `Capture Canvas` to use the visible document.
5. Confirm the source preview appears.
6. Enter a prompt describing how to reinterpret the source.
7. Choose a checkpoint and keep the workflow set to `img2img-basic`.
8. Click `Generate Image to Image`.
9. Wait for the result preview.
10. Click `Import to Layers`.

The imported layer is named like:

```text
OpenLayer_Img2Img_YYYYMMDD_HHMM
```

## First Sketch To Image LINECN Test

1. Install or confirm this SD 1.x checkpoint is available in ComfyUI:

```text
epicrealism_naturalSinRC1VAE.safetensors
```

2. Install or confirm this SD 1.5 LineArt ControlNet model is available in ComfyUI:

```text
control_v11p_sd15_lineart_fp16.safetensors
```

3. Open a Photoshop document with a visible source layer or canvas.
4. Open the OpenLayer panel and choose `Sketch to Image`.
5. Click `Capture Active Layer`, or click `Capture Canvas`.
6. Confirm the source preview appears.
7. Enter a prompt describing the final image.
8. Keep the workflow set to `sketch2img-linecn-basic`.
9. Choose `epicrealism_naturalSinRC1VAE.safetensors`.
10. Click `Generate Sketch to Image`.
11. Wait for the result preview.
12. Click `Import to Layers`.

The imported layer is named like:

```text
OpenLayer_Sketch_YYYYMMDD_HHMM
```

## First Inpaint Test

This alpha includes the first experimental SD 1.x mask-based inpainting path.

1. Open a Photoshop document.
2. Make a rectangular or freeform selection in Photoshop.
3. Open the OpenLayer panel and choose `Inpaint`.
4. Click `Capture Selection`.
5. Confirm the source preview appears and the status shows the selection bounds.
6. Confirm the mask preview appears as a black/white PNG mask.
7. Enter a prompt and click `Generate Inpaint`.
8. Wait for the result preview.
9. Click `Import to Layers`.

The first `inpaint-basic` preset is experimental and intended for SD 1.x inpaint checkpoints first. `inpaint-flux-fill-basic` is also available as an experimental Flux Fill path when your local ComfyUI exposes the required Flux Fill model stack. `inpaint-flux-fill-cropstitch` adds crop-and-stitch sampling at 1024 on top of the same Flux Fill stack, and needs lquesada's `comfyui-inpaint-cropandstitch` node package.

Inpaint output quality, mask interpretation, and Photoshop alignment are still being tested. Use this path for debugging and feedback rather than production work.
