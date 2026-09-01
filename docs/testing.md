# Testing OpenLayer

What to check when you test an OpenLayer alpha, newest release first. If you only have
ten minutes, do the `v0.20.0-alpha` list at the top and skip the rest.

Report what you find in [Discussions](https://github.com/MehranMarxian/OpenLayer/discussions)
or as an [issue](https://github.com/MehranMarxian/OpenLayer/issues). Negative results are as
useful as positive ones — "this worked exactly as described" is a real data point.

For a step-by-step beginner smoke test, see [`testing-v0.1-alpha.md`](testing-v0.1-alpha.md).

## Per-release focus

### v0.20.0-alpha

- **Confirm the panel footer reads `v0.20.0`.** It read the wrong version for the whole of v0.14.0-alpha, so this is worth a glance before anything else.
- **Open Multi-Reference and add three or four layers**, one at a time, with Add Active Layer or Add Canvas. Confirm each row gets its own correct thumbnail — not a repeat of the previous one — and that the count reads "N of 8".
- **Press Up or Down twice, fast.** A reference should move exactly one place per press, not two. Same for Remove: one press, one row gone.
- **Compose from two references at a fixed seed, then reorder them and compose again at the same seed.** The result must change, and the output canvas size must follow whichever reference is now first — that is the one thing reference order is guaranteed to affect. If it comes back identical, the reorder is not reaching ComfyUI.
- **Compose from more than two references captured together.** Two different images uploaded under the same filename overwrite each other in ComfyUI, and it happened once in testing before this release — the symptom is a background that resembles neither reference and an output sized to the wrong one.
- **Try a real photograph as one of the references** — of yourself, or anyone you can judge the likeness of. Confirm what the panel's own info note says: clothing and setting carry across, the face does not. This is expected, not a bug; report back only if a face *does* come through recognisably, since that would contradict what 48 test generations found.
- **Add a ninth reference.** It should be refused with a message naming the limit, not silently dropped or ignored.

### v0.18.0-alpha

- **Switch to Artist-Friendly Dark** in Settings. The panel should restyle into the softer dark theme. Switch back to Compact Adobe Dark and confirm it looks exactly as it did before — nothing about it should have changed.
- **In Artist-Friendly Dark, confirm the numeric parameters are sliders.** Drag Detail (steps) or Strength (denoise), confirm the number updates, and generate — the value the slider shows must be the value used. In Compact Adobe Dark the same parameters must still be number boxes.
- **Press the dice button on a seed field.** Each press should roll a different seed, and the field must never show `214748.36`. Then **load an entry from session History and generate from it** — its seed must load and run, not fail with "Seed must be a whole number". That failure hit every History load before this release.
- **Expand Advanced settings on one tool, collapse it on another, and reopen the panel.** Each screen must remember what you left it as. Then Reset Settings — it must not re-collapse a screen you chose to keep open.
- **Open Inpaint, make a selection, switch to `inpaint-flux2-klein`, and generate.** Confirm the repaint blends into the surrounding image. It is strongest at *adding* something to a small selection — try that, and try replacing a larger region. It needs the `comfyui-inpaint-cropandstitch` node pack; if it is missing, Workflow Health should name it.

### v0.15.0-alpha

- **Generate with `txt2img-flux2-klein`.** It should complete in under 15 seconds on a 4070 Ti at 1024x1024. Confirm the result is coherent and the prompt was followed.
- **Open Image to Image, switch to `img2img-flux2-klein`, capture a layer, and generate.** The result should follow your layer. Then switch to `edit-flux2-klein`, enter a change instruction ("make the sky orange"), and generate again — the edit should apply the instruction while keeping the rest of the scene.
- **Open Inpaint, make a selection, and switch to `inpaint-flux-fill-cropstitch`.** Generate and confirm the inpainted area blends into the surrounding image. Compare with `inpaint-flux-fill-basic` at the same selection — crop-and-stitch should produce sharper detail on small selections in large documents.
- **Generate an Image to Image result from a layer that is not at the canvas origin**, then import it. The imported layer must land where the source layer was, not centred on the canvas.
- **Confirm ordinary use is unaffected if you never turn the Agent Bridge on.** Text to Image gains one new button, "Ask the Agent for a Prompt" — clicking it with the bridge off should show a clear "not connected" status, not an error or a broken panel. Everything else should behave exactly as it did in v0.14. This is the most important check in the list: everything below is opt-in.
- Open **Setup** and find the **Agent Bridge** section at the bottom. With nothing running, press **Turn Agent Bridge On** — it must report that no bridge is listening and tell you how to start one, not hang or claim to be connected.
- Start the hub (`cd bridge && npm install && npm run hub`), then turn the toggle on. It should connect **without any AI client running at all** — the hub is independent of them.
- Register the bridge with Claude Code or Codex (`bridge/README.md` has the line), then ask it to call `get_panel_state`. It should report `connected: true` and list all seven tools.
- Ask it to generate something. The prompt should appear in the panel by itself and run exactly as if you had typed it. Then ask for a model or size it has not used — the panel's own dropdowns should follow.
- **Start a generation by hand, and while it runs, ask the assistant to generate something.** It must refuse with "OpenLayer is busy", not start a second run. This is the safety rule most worth confirming in the real app.
- Ask for one of the capture-based tools (**Upscale**, **Inpaint**, **Image to Image**) with nothing captured. It should come back with the same clear "capture a source first" refusal you would get from clicking Generate too early.
- Try **Ask the Agent for a Prompt** under the Text to Image prompt box. If your AI client supports MCP sampling it fills the box; if not it should refuse instantly with an explanation, and that refusal is the correct behaviour rather than a bug. Report which client you used either way — that answer is genuinely unknown for most clients.
- Close your AI client mid-generation. Photoshop should finish the job normally.

### v0.14.0-alpha

- Open **Sketch to Image** and switch the Workflow dropdown to **Z-Image Fun ControlNet Union (Lite)**. The **Checkpoint** dropdown must repopulate and offer `z_image_turbo_bf16.safetensors`.
- Draw with a pencil or soft brush on a **toned or off-white** background, not pure white, and generate with each Z-Image preset. The result must follow your drawing without your strokes appearing on the finished image.
- Generate from a **small document**, under 1024px on the long edge. The imported layer must come back at your canvas size and must not show a maze-like texture or bare glowing lines on black.

### v0.13.0-alpha

- Open **Text to Image**, pick `txt2img-krea2-turbo`, and confirm a **LoRA (optional)** row appears with `None` selected and no strength field. Generate once with `None` — it must succeed — then pick a LoRA and generate again at the same seed. The two images must differ.
- Switch the Workflow dropdown across every preset in Text to Image, Image to Image and Sketch to Image and confirm the LoRA row appears for all of them. Confirm it does **not** appear on Inpaint, Outpaint or Upscale.
- Pick a LoRA whose name mentions a different model family than the preset. It should still be selectable, marked `(name suggests another model)`, and generating should **succeed with a visibly unchanged image** — that is the silent failure the warning describes, not a bug.

### v0.11.0-alpha

- Open **Setup** from Home *before* starting ComfyUI. Confirm every model and node package is still listed with its folder, size and links, that the three tallies show a dash rather than 0, and that nothing claims you are set up.
- Start ComfyUI, click **Check Again**, and confirm the list splits into what you have and what you are missing, with the installed rows collapsed. The remaining download figure should count each file once even though several presets share it — and should say "Nothing" if you have everything.
- Move one model into the wrong folder — a checkpoint into `models/diffusion_models/`, say — check again, and confirm its row says you already have the file, names the folder it is in, and does not add its size to the remaining download.
- Use the filter chips to narrow the list to one tool, and confirm the tallies and the download total keep describing everything rather than only the filtered slice.
- Read **"What will run well"** at the bottom of Setup. Confirm the VRAM figure matches your card, that the order runs best-first, and that the Florence-2 preset is *not* claimed to be the most comfortable one on the list.
- Look at the status badges on both Setup and **Check Workflow Health**: they should be the same squared uppercase label on both screens, with no text cut off by an ellipsis. The longest ones are NEEDS WORKFLOW JSON and MISSING COMFYUI NODE.
- Confirm the filter chips read as flat outlined pills of uniform height — not gold switches, not stretched ovals.
- Confirm Workflow Health names presets the way an artist would ("Krea-2 Turbo", "Standard checkpoint") rather than by their internal ids.
### v0.10.0-alpha

- Unzip the release package and confirm it expands into folders, with an `assets/` directory beside `index.html` — not a flat pile of files with backslashes in their names. **On macOS this is the single most useful thing to report.**
- Put a model in the wrong folder on purpose — move a checkpoint into `models/diffusion_models/`, say — then run **Check Workflow Health** and confirm the report names the folder it actually found it in and the folder the workflow wants.
- Open **Live Painting**. Confirm Start and Stop Live Session have a gap between them and are the same height, and that the two explanatory hints read as full paragraphs rather than ending in an ellipsis.
- Set a Live Painting negative prompt, start a session, and paint. Then run one session with the field left blank and confirm it behaves as it did before.

### v0.9.0-alpha

- Open **Layer Tools** from Home. With a layer selected, save it to a file, then send it to ComfyUI and confirm it appears in ComfyUI's `input` folder under the name the status line reports.
- Make a selection, then run both the **Selection** and **Selection mask** exports. The mask is the one an inpainting workflow wants; confirm it is a black-and-white image matching what you selected.
- Cancel a save dialog and confirm the status line says so without turning red — a change of mind is not an error.
- Run a Layer Tools export with no selection, and with no open document, and confirm the message names what you were trying to do.
- Open each tool in turn without touching anything and confirm its diagnostics line still shows its own opening hint. Then generate on Text to Image and confirm nothing from it appears on any other tool's screen.
- Open **Plugins > OpenLayer Preview**, generate, and import the result using the panel's own **Import** button. Confirm the layer lands in the same document the generation started from, and that the panel's status line reports what happened.
- Confirm the panel's Import button is disabled while a run is in progress and on live sampler frames, and enabled again once a result is committed.
- Open **Plugins > OpenLayer Preview**, pin it to one tool, generate with another, and confirm the panel stays pinned and restores that choice in a later session.
- Start Text to Image and confirm progress appears only in its own status bar; return Home and confirm the shared status row does not appear on tool screens.
- Watch a sticky tool header before and during a run. There should be no progress bar in the header at all, its height should not change, and the bar should appear under the status text in the generation status panel with nothing painted over it.
- Exercise an error path and open its technical details to confirm the original failure is reported without a second crash.
- Run `npm run setup-pack` and confirm it reports no source/API mismatches at all.
- Recheck the existing local generation, cancel, preview, import, History, and Workflow Health paths for regressions.

## Pre-release tester checklist

Use this quick pass before reporting a `v0.20.0-alpha` test result:

Use this quick pass before reporting a v0.20.0-alpha test result:

1. Start ComfyUI on `http://127.0.0.1:8190`.
2. Build OpenLayer and load `dist/manifest.json` in Adobe UXP Developer Tool.
3. Open Photoshop, create or open a document, and launch OpenLayer.
4. Confirm unavailable dashboard tools are visibly dimmer than available and experimental tools.
5. Open two tool screens; confirm the Back to Tools control, icon, title, and progress track have clear spacing and remain visible while scrolling.
6. Paste a long prompt, confirm it remains editable and scrollable, and confirm the Prompt from Layer generated-text field is substantially taller than other fields.
7. Open Settings and click `Check ComfyUI`; confirm checkpoints load.
8. Click `Check Workflow Health`; confirm each registered preset shows Ready, Experimental, Missing model, Missing ComfyUI node, Needs workflow JSON, or Setup required, under its artist-facing name.
9. Confirm Settings shows readable summary counts and collapsed technical details without overlapping cards.
10. Click `Copy Diagnostics`; confirm the report is copied or appears in the read-only diagnostics box.
11. Generate one `txt2img-basic` image and import it as a new layer; confirm the determinate progress bar advances cleanly.
12. Select `txt2img-flux1-dev-fp8` with `flux1-dev-fp8.safetensors` if available, generate once, and confirm the result preview appears.
13. Start one Text to Image generation and click `Cancel Generation`; confirm the status changes to `Generation cancelled.` and the next generation still works.
14. Open `Image to Image`, capture either the active layer or canvas, generate with `img2img-basic`, and click `Import to Layers`.
15. Toggle Image to Image `Import Automatically`, generate once, and confirm the result imports as a new Photoshop layer.
16. Open `Upscale`, capture either the active layer or canvas, choose `4x-UltraSharp.pth` or another listed upscale model, generate, and click `Import to Layers`.
17. Open `Sketch to Image`, capture either the active layer or canvas, generate with `sketch2img-linecn-basic`, and click `Import to Layers`.
18. Open `Inpaint`, make a Photoshop selection, click `Capture Selection`, and confirm the selected-region preview and mask preview appear.
19. Generate with `inpaint-flux-fill-basic` if your Flux Fill stack is installed, then click `Import to Layers`; keep `inpaint-basic` as experimental/debug-only if it does not match the source.
20. Start and cancel one longer Image to Image, Sketch, Outpaint, Inpaint, Prompt from Layer, or Upscale run if your ComfyUI setup supports it; confirm the next generation still works.
21. Open History after a generation; confirm prompt, model, workflow, seed, dimensions, source mode, tool type, timestamp, import status, Preview, Import, and Reuse Settings are visible.
22. Resize the panel narrow and wide; confirm Settings, workflow health cards, buttons, preview, and footer remain readable and reachable.
