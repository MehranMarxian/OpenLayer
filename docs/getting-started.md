# Getting started

Walkthroughs for your first run with each tool. Install the plugin first — see the
[README](../README.md#installation).

## Starting ComfyUI

Start ComfyUI locally using your normal ComfyUI launch command. Confirm the server is reachable:

```bash
curl http://127.0.0.1:8188/system_stats
```

In OpenLayer, keep the default server URL or enter your own:

```text
http://127.0.0.1:8188
```

`8188` is the port ComfyUI starts on by default, so if you have not deliberately moved yours, this
already matches and there is nothing to configure.

**If your ComfyUI is somewhere else, you do not have to move it.** Open **Settings** and click
**Find ComfyUI Active Port**. OpenLayer scans the common local ports, connects to the server it
finds, and reports `Ready`. Keep using your normal launch command and leave the server where it is.
On a first run with nothing saved yet, the panel does this scan on its own when the default address
does not answer.

> Upgrading from v0.20 or earlier? The default used to be `8190`. If you had ever connected
> successfully, your address was saved and nothing changes. If the panel does come up pointing at
> `8188` and your server is on `8190`, **Find ComfyUI Active Port** puts it back in one click.

A launch command with the default port spelled out, for reference:

```bash
python main.py --listen 127.0.0.1 --port 8188 --preview-method auto
```

`--preview-method auto` is optional but recommended: it makes ComfyUI stream live KSampler step previews into the OpenLayer result preview while generating.

Click `Check ComfyUI` before generating.

## Start here: FLUX.2 Klein 4B

On a fresh ComfyUI, start with **FLUX.2 Klein 4B**. It is three files, 12.5 GB, Apache-2.0 (fine for
client work), with no sign-in and no add-ons, and it runs Text to Image, Image to Image, Edit Image,
Inpaint and Multi-Reference. From v0.39 the panel downloads it for you:

1. Start ComfyUI, open a Photoshop document, and open the OpenLayer panel.
2. Open **Setup**. The **Start here** card at the top checks what ComfyUI already has.
3. Click **Download starter (12.5 GB)**. The box that opens lists each file, its size, the folder it
   goes in, and where it comes from (`huggingface.co`). Click **Download**.
4. If OpenLayer asks for a folder, choose ComfyUI's **`models`** folder, the one with
   `diffusion_models`, `text_encoders` and `vae` inside. It asks once and remembers, and each file
   goes into its own folder inside it.
5. The files download one after another, smallest first, each checked against the size and checksum
   Hugging Face publishes. **Stop** is safe: pressing **Download starter** again resumes.
6. When the last file is in, the card disappears and the status line says which tools can run now.

Already have some of the files? The card counts only what is missing. The text encoder,
`qwen_3_4b.safetensors`, is shared with Z-Image Turbo. If a file is on disk in the wrong folder, the
card says to move it rather than download it again.

Two honest caveats: **Inpaint** also needs the `comfyui-inpaint-cropandstitch` node pack, which you
install through ComfyUI-Manager, and **Inpaint** and **Multi-Reference** are experimental.

## First Image

1. Open a Photoshop document.
2. Open the OpenLayer panel and choose `Text to Image`.
3. Once the starter is installed, the workflow is already `txt2img-flux2-klein` and the model
   `flux-2-klein-4b-fp8.safetensors`. Without it, the workflow is `txt2img-basic`, which needs an
   SD 1.x checkpoint.
4. Enter a prompt.
5. Optionally enter a negative prompt.
6. Click `Generate`.
7. Wait for the preview.
8. Click `Import Result as New Layer`, or enable `Import Result Automatically` before generating.

If ComfyUI is not found, open Settings and click `Find ComfyUI Active Port` or `Check ComfyUI`.

Picking a different workflow is always yours to make: choose it from **Workflow** and OpenLayer
keeps it, the next time too, instead of switching back to Klein.

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
7. Keep the workflow OpenLayer opens on: `img2img-flux2-klein` once the starter is installed,
   otherwise `img2img-basic` with an SD 1.x checkpoint.
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
