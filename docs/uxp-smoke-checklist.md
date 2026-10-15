# UXP smoke checklist

Ten minutes in real Photoshop, the same steps every time. Green tests, a clean build and a correct
browser preview do not prove the panel works: UXP has missing DOM methods (issue 127), ignored CSS
properties and its own event timing, and only Photoshop shows them.

**When to run it**

- Every PR that touches `src/ui/`, `src/photoshop/`, `src/styles.css`, `src/index.html`,
  `src/panelBootstrap.js` or `src/manifest.json`: run **block 0 and every block for the area you
  changed**, then paste the ticked list into the PR.
- Before every release: run **all of it**, on the newest Photoshop and on Photoshop 2024 (the oldest
  version the manifest claims, `minVersion 25.0.0`). Record the result at the bottom.
- When Adobe ships a Photoshop update: all of it, once, on the new version (roadmap U6).

**What it needs**

- ComfyUI running on `127.0.0.1:8188`.
- `epicrealism_naturalSinRC1VAE.safetensors` in `models/checkpoints/` (SD 1.5, fast).
- `4x-UltraSharp.pth` in `models/upscale_models/`.
- BiRefNet for Remove Background (Setup lists the file).
- A test document: File › New, 1024 × 1024, with one painted layer that has a clear subject on a
  plain background. Never run this on a document you care about.

Each step lists what you should see. Anything different is a failure: write down the step number
and what happened, and stop there.

---

## Block 0: the panel starts (1 minute). Always run this.

- [ ] 0.1 Build the branch (`npm run build`) and load `dist/manifest.json` in UXP Developer Tool:
      Add Plugin › Load. Plugins › OpenLayer opens the panel. **See:** the Home screen with tool cards.
- [ ] 0.2 Click the **Settings** card, then **Back to Tools**. **See:** Settings opens, then Home again.
      (A panel where nothing responds is issue 127: something threw during startup.)
- [ ] 0.3 Settings › **Check ComfyUI**. **See:** a Ready status within a few seconds.
- [ ] 0.4 The panel footer shows the version in `package.json`.
- [ ] 0.5 Plugins › OpenLayer › **OpenLayer Preview**. **See:** the Preview panel draws its header
      and a Fit button.

## Block 1: generate and import (2 minutes)

Text to Image, the generation controller, the progress bar, cancel, import.

- [ ] 1.1 Home › **Text to Image**. Workflow: **Standard checkpoint**, model
      `epicrealism_naturalSinRC1VAE.safetensors`, 512 × 512, a short prompt. **Generate**.
      **See:** progress moves, a preview appears in the panel and in OpenLayer Preview.
- [ ] 1.2 **Import to Layers**. **See:** a new named layer in the document, at the right size.
- [ ] 1.3 **Generate** again and click **Cancel Generation** while it runs. **See:** "Generation
      cancelled", no layer added. Then **Generate** once more and it completes.
- [ ] 1.4 Clear the prompt and **Generate**. **See:** a message that a prompt is needed, nothing sent.

## Block 2: capture from the document (2 minutes)

Layer and canvas capture, a selection, alignment on import.

- [ ] 2.1 Home › **Image to Image** › **Capture Active Layer** on the painted layer. **See:** a source
      preview of that layer. **Generate**, then **Import to Layers**. **See:** the result sits exactly
      over the source.
- [ ] 2.2 Draw a rectangular selection on part of the layer. Home › **Inpaint** › **Capture
      Selection**. **See:** the source and mask previews match the selection. (Generating is
      optional here: Inpaint needs heavier models.)
- [ ] 2.3 Home › **Upscale** › **Capture Active Layer**, then **Generate Upscale** and **Import to
      Layers**. **See:** a larger layer named as an upscale.

## Block 3: tools that write their own layers (2 minutes)

- [ ] 3.1 Home › **Remove Background** › **Capture Active Layer**, then generate and import.
      **See:** a cut-out layer with transparency over the original, original untouched.
- [ ] 3.2 Home › **Layer Maps** › capture the layer, choose Line art, generate and import.
      **See:** a line-art layer aligned to the source.

## Block 4: screens with lists and controls (2 minutes)

The parts built element by element, which is where UXP's missing DOM methods bite.

- [ ] 4.1 **Setup** › **Check Again**. **See:** rows of models with Installed or Missing, and the
      buttons on a Missing row respond.
- [ ] 4.2 Settings › **Check Workflow Health**. **See:** grouped health cards.
- [ ] 4.3 On Text to Image, use the sliders and the seed dice. **See:** values change and snap.
- [ ] 4.4 Prompt Wallet: save the current prompt with the green **+**, open the wallet, use the
      saved entry. **See:** the prompt comes back into the field.
- [ ] 4.5 Home › **History**. **See:** the generations from block 1 with their settings.
- [ ] 4.6 Settings › change the theme and back. **See:** the panel restyles both times.

## Block 5: Live Painting (1 minute)

Socket-per-cycle and Photoshop event listeners.

- [ ] 5.1 Home › **Live Painting** › **Start Live Session**, paint two strokes. **See:** the preview
      updates after each stroke.
- [ ] 5.2 **Stop Live Session**. **See:** it stops, and painting no longer triggers anything.

## Block 6: Agent Bridge (optional, 1 minute)

Only for PRs that touch the bridge or `src/ui/agent*`.

- [ ] 6.1 In a terminal, `node bridge/src/hub.mjs`. Setup › **Agent Bridge** on. **See:** the hub
      prints "Accepted a connection (...)". Copy that line into the PR.
- [ ] 6.2 Ask your AI client for the panel state. **See:** an answer naming the current screen.

---

## Results

One row per full run. Partial runs for a PR go in that PR, not here.

| Date | Photoshop | OS | OpenLayer | Blocks | Result | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |
