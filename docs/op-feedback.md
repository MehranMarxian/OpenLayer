# OP feedback log

Notes from OP (the OpenLayer Painter agent) working through the real panel via the Agent Bridge.

## 2026-09-27 — Landing-page hero: paper-cut dawn valley

**Made:** A paper-cut diorama of a mountain valley at dawn, meant as a visual metaphor for layers: charcoal foreground sheets lightening to gold, a slate-blue river as the leading line, a small figure and pine on the nearest ridge, and a sun built from concentric translucent paper rings (the sun itself is a layer stack). Everything was Text to Image at 1344x896. There were 9 generations in total: 2 on `txt2img-flux2-klein` (4 steps, CFG 1) and 7 on `txt2img-krea2-turbo` (8 steps, CFG 1). **Keeper:** Krea-2 Turbo, seed 3190 (`OpenLayer_Krea2_00088_.png`, re-run as `00090` so it is the top layer). **Runner-up:** seed 912 (`00089`). Output timestamps are roughly 30 s apart, including my own review time, so each generation takes well under 30 s. Switching between Klein and Krea-2 added no visible penalty (33 s either way, review included).

**Worked well:**
- Seeds are exactly reproducible through the panel. Re-running Krea-2 seed 3190 with the same prompt and size gave a byte-identical PNG (same MD5 as `00088`). For an artist, this means "go back to that one" actually works.
- Only changing the parameters you pass made exploration cheap. I sent the long prompt once, then varied only `seed`, and the panel kept the prompt. The prompt box ended up showing the keeper's prompt, which suits the screenshot.
- Krea-2 Turbo was clearly the better model for this brief. It understood "each ridge a separate sheet with a rim of backlight" and "translucent halo rings" literally and kept a clean black-to-gold value order. With the same prompt, Klein gave a lemon-yellow sun, about five sheets, and pale sheets in front of dark ones (inverted depth). Klein's paper surface looked physically real but the composition was weak.
- Composition held when I changed the prompt on the same seed. Seed 3190 kept its layout (figure lower-left, river S-curve, sun right of centre) when I rewrote the halo and sheet wording, so I could fix details with words without rerolling the layout.

**Friction:**
- I could not use any finishing tool. Edit Image, Upscale and Inpaint all need a source "already captured in the panel", and the bridge has no capture call. I wanted to (a) extend the top edge a little, because the outer halo ring sits about 35 px from the frame, and (b) upscale the keeper. Without capture, whatever was captured earlier in the session would have been the source, and I couldn't see what that was, so I didn't risk editing a stale layer. The agent workflow is therefore limited to Text to Image, while the brief (and OpenLayer's pitch) is about the tools working together.
- `get_panel_state` doesn't report the document. I don't know the open document's size, whether generated layers are placed at 1:1 or scaled to fit, or what's currently captured for each tool. That's why I skipped Upscale: a 4x layer on a 1344x896 canvas would overflow it and spoil the screenshot, and I had no way to check.
- The status text is always "Generation complete." It doesn't give the output filename, layer name, seed or time taken, so after every call I had to list the ComfyUI output folder by modification time to find the result. On a shared ComfyUI instance, that could pick up someone else's image.
- The prompt box holds the keeper's prompt, but I can't confirm what the rest of the panel shows. There's no way to read back the preset dropdown, the seed field, or which screen is open, and those matter for a screenshot.

**Bugs (suspected):** None seen. Every call returned "Generation complete." and produced a new file.

**Would make OpenLayer better:**
1. **A capture call on the bridge** (`capture_source(tool, "active-layer" | "canvas" | "selection")`). Edit, Inpaint, Outpaint and Upscale are the tools that set OpenLayer apart from a web generator, and right now an agent (or a scripted batch) can't reach them.
2. **Return the result in the status:** output filename, Photoshop layer name, seed used and elapsed time. With that, an artist or agent can record keepers without searching the output folder, and a random seed can be recovered when a lucky image turns up.
3. **Report the document and captured sources in `get_panel_state`** (document size, active layer, what each tool currently has captured). This would prevent silently editing the wrong layer and oversized imports.
4. **Name imported layers after preset and seed** (for example, `Krea2 · 3190`), if they aren't already. A variation stack is only useful if you can tell which layer is which without re-opening files.

## 2026-09-27 (round 2) — Hero rework with prose prompts, plus Qwen poster track

**Made:** 8 more generations (17 in total for the brief).
- **Krea-2 Turbo (8 steps, CFG 1, seed 3190, 1344x896):** five rounds, K1–K5, each changing one thing (light, camera, material, synthesis, then a minimal light change). **New hero:** K5, `OpenLayer_Krea2_00095_.png`.
- **Qwen-Image 2.1 posters (25 steps, CFG 1, seed 3190):** three runs, `OpenLayer_Qwen21_00011/12/13_.png`. Every letter was spelled correctly on all three.
- **Timings:** outputs landed about 40 s apart including my review. Qwen at 1024x1536 was no slower than Krea-2 in practice. Switching between Qwen, Krea-2 and Klein showed no visible model-swap penalty.

**Worked well:**
- **Qwen lettering is as good as claimed.** "OpenLayer" (camel case intact), "Local AI, layer by layer" and "Local AI layers, inside Photoshop" all rendered letter-perfect the first time, including kerning and a believable gold-foil texture.
- **Qwen's poster 1 (`00011`) was the most striking image of the session.** Torn deckled edges catch the rim light in a way Krea-2 never managed.
- **One-change rounds on a fixed seed taught me real, reusable things about Krea-2:**
  - (a) The sentence giving the value order ("recede from black through bronze and amber to gold, each lighter than the one in front") carries all the depth. Dropping it in K2 flattened every sheet to one kraft tan.
  - (b) Material words overpower light words. "Watercolour washes, gold leaf" in K3 turned the paper into grimy marbled leather.
  - (c) A glowing halo only appears with the exact phrasing "surrounded by concentric rings of translucent paper halo ... light shining through them". "Built from concentric discs" gives opaque cardboard rings, and describing a sun "core" loses the rings altogether.
  - (d) Camera language works. "Low eye-level 35mm, foreground sheet out of focus" made the only image that looks like a photographed object.
- **Adding one sentence to the proven prompt on the same seed (K5) kept the composition** and changed only the light. That's a proper art-direction loop, and it's possible because seeds are deterministic.

**Friction:**
- **I couldn't name the layers, and I couldn't see them.** Mehran asked for the Qwen layers to be clearly named. The bridge has no way to rename a layer or read the layer list, so I can only identify them by output filename. For a research-licensed model this is the part that matters: nothing in the Layers panel marks a Qwen layer, so one could slip into promotional work.
- **Mixed aspects in one document.** The Qwen posters are portrait (896x1344, 1024x1536) and landscape (1536x1024), imported into a 1344x896 landscape document. I don't know whether the panel scaled them to fit, centred them or cropped them. A portrait layer hidden under the hero is harmless, but an artist would want each Text to Image run to offer "new document at this size".
- **Weak Qwen default at 25 steps.** Poster 3's gold sky wash cost the brand black. I had no negative prompt to push back with, because CFG 1 makes it inert (the panel says so, which is good). The only lever is rewording the prompt.

**Bugs (suspected):** None. All 8 calls returned "Generation complete." and produced one file each.

**Would make OpenLayer better:**
1. **Automatically tag the names of layers made by research-licensed presets** (for example, a "[research licence]" suffix). The licence warning currently lives only in the dropdown, and an artist building a composite has no way to see later which layers can't ship.
2. **A way to set or rename a layer's name from the tool call or panel** (the preset and seed would do). Seventeen variations named by import order is not a usable stack.
3. **An "open as new document at generated size" option** for Text to Image, so a portrait poster doesn't land in a landscape hero document.

## 2026-09-27 — Hero screenshot set-up (found by the orchestrating assistant, not OP)

**Bugs (reproduced):**
- **`text_to_image` over the bridge does not import when the panel's Auto Import is off**, even though the tool's
  description says it "imports it as a new layer". OP's 17 generations all existed in ComfyUI's output folder and
  none was in the Photoshop document; the status said "Generation complete." while the panel showed an unpressed
  "Import Result as New Layer". With Auto Import on, the status becomes "Imported layer: …" and it works. An agent
  can't see the toggle, so the bridge should either import regardless or return an explicit "not imported" status.
- **A freshly imported full-canvas result landed ~40 px right of the canvas edge** in a new 1344×896 document,
  leaving a strip of the layer beneath visible down the left side. Fixed for the shot with Align Layers to
  Selection (left + top). Worth checking the import placement for results exactly the size of the canvas.
