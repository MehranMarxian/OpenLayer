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
3. Enter a prompt.
4. Click `Generate`.
5. After the preview appears, click `Import Result as New Layer`.

If generation fails, confirm the checkpoint name in `src/workflows/txt2img-basic.json` exists in your ComfyUI models folder.
