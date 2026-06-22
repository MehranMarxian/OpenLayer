# OpenLayer v0.1 Alpha Testing Checklist

Use this checklist after building a new alpha package or changing generation/import code.

## 1. Build The Plugin

Run from the OpenLayer repository:

```powershell
npm install
npm run build
```

Expected result:

- The command completes without TypeScript or Vite errors.
- A `dist` folder exists.
- `dist\manifest.json` exists.

If this fails:

- Confirm Node.js 18 or newer is installed.
- Run `npm install` again and retry `npm run build`.

## 2. Package The Plugin

```powershell
npm run package
```

Expected result:

- A package is created in `packages`.
- For this version, the package should be named `openlayer-v0.1.9-alpha.zip`.

If this fails:

- Run `npm run build` by itself first.
- Confirm PowerShell can create zip archives with `Compress-Archive`.

## 3. Start ComfyUI For OpenLayer

Start ComfyUI on the OpenLayer port:

```powershell
python main.py --listen 127.0.0.1 --port 8190
```

Expected result:

- ComfyUI prints a local URL using port `8190`.
- Opening `http://127.0.0.1:8190` shows the ComfyUI interface.

If this fails:

- Confirm another app is not already using port `8190`.
- Keep other local plugins on their own port if they already use `8188`.

## 4. Load OpenLayer In UXP Developer Tool

1. Open Adobe UXP Developer Tool.
2. Click `Add Plugin`.
3. Select `dist\manifest.json`.
4. Click `Load`.

Expected result:

- OpenLayer shows as loaded in UXP Developer Tool.
- Photoshop shows OpenLayer under the Plugins menu.

If this fails:

- Confirm you selected `dist\manifest.json`, not `src\manifest.json`.
- Run `npm run build` again and reload the plugin.

## 5. Open The Panel In Photoshop

1. Open Photoshop 2024 or newer.
2. Open or create a document.
3. Open `Plugins > OpenLayer > OpenLayer`.

Expected result:

- The OpenLayer panel appears.
- The default ComfyUI server URL is `http://127.0.0.1:8190`.

If this fails:

- Reload the plugin in UXP Developer Tool.
- Check the UXP Developer Tool logs for manifest or runtime errors.

## 6. Check ComfyUI

Click `Check ComfyUI`.

Expected result:

- Status changes while checking.
- Checkpoints load into the checkpoint selector.

If this fails:

- Confirm ComfyUI is still running on `8190`.
- Open `http://127.0.0.1:8190/system_stats` in a browser.
- Confirm your ComfyUI models folder contains checkpoints.

## 7. Generate A Test Image

Use a simple prompt:

```text
a small rabbit in a quiet studio, soft light
```

Suggested settings:

```text
Width: 512
Height: 512
Steps: 8
CFG: 7
Seed: Random
```

Click `Generate`.

Expected result:

- The status changes through submit/generation/retrieval steps.
- If ComfyUI WebSocket previews are available, the preview area may update during generation.
- A final generated image appears in the preview area.
- The seed field updates to the seed used for the run.

If this fails:

- Confirm the selected checkpoint exists.
- Try fewer steps.
- Check the ComfyUI terminal for workflow or model errors.

## 8. Import The Result Into Photoshop

Click `Import Result as New Layer`.

Expected result:

- A new layer appears in the active Photoshop document.
- The layer name starts with `OpenLayer_Generated_`.

If this fails:

- Confirm a Photoshop document is open.
- Confirm a generated preview exists before importing.
- Check UXP Developer Tool logs for Photoshop import errors.

## 9. Final Smoke Test Result

The alpha smoke test passes when:

- ComfyUI connects.
- Checkpoints load.
- A prompt generates a preview.
- The preview imports as a new Photoshop layer.
