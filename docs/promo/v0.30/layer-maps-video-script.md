# Layer Maps demo video — script

**Format:** 45–75s screen recording, docked panel, works silent (captions carry it; voiceover lines
below are optional overlays, not required). 1080p. No speeded-up footage for the timed beats — the
brief is explicit that real timings should show as real timings, not be faked with a fast-forward.

**Suits:** GitHub Discussion (native upload or a raw-URL-hosted clip), LinkedIn (native video upload),
r/comfyui / r/StableDiffusion / r/photoshop (Reddit video upload), ComfyUI Discord (short clip or GIF
cut-down), and as the first-comment evidence on a future Show HN. One asset, all venues — this is the
first cycle this project has had one.

**Source photo:** the 1st-choice candidate from `layer-maps-demo-photo.md`
(`GER Kochel am See, Schloss Aspenstein 008.jpg`, CC BY 4.0, `-wuppertaler`) unless Mehran's own
ComfyUI test run says otherwise. On-screen attribution credit belongs in the video description /
caption text of wherever it's posted, not baked into the frame: **"Terrace photo: -wuppertaler, CC BY
4.0, via Wikimedia Commons."**

**Before recording, run once, off camera:** one warm-up generation of each of the three map types.
The annotators (`comfyui_controlnet_aux`) download their own weights on first use per map type, and a
cold run would show a misleading multi-minute wait instead of the real few seconds. Record
only after all three have run at least once.

**Keep ComfyUI's own window out of frame** unless a beat specifically needs it — the whole demo is
about the Photoshop side.

---

## Shot list

### 0:00–0:03 — Hook

**Screen:** the terrace photo full-frame in Photoshop, then a fast cut/crossfade through all three
finished maps over it (depth → line art → normal, roughly 1s each).
**Caption:** `One photo. Three passes. No prompt.`
**VO (optional):** "Depth, line art, and a normal map — off the same layer."

### 0:03–0:07 — Capture

**Click:** **Capture Active Layer** (Layer Maps screen, source-action row).
**Screen:** the source card fills in with the terrace thumbnail; source title updates from "No source
captured."
**Caption:** `Capture the layer.`

### 0:07–0:18 — Generate: Depth

**Click:** **Map type** select → choose **"Depth (Depth Anything V2)"** (likely already the default —
show the selection regardless, so the option list is visible on camera).
**Show:** the **Depth model** field appears (depth-only control), defaulted to Depth Anything V2
**Base**.
**Click:** **Generate Depth Map**.
**Screen:** hold on the status bar / progress indicator for the full real duration — **~5s warm on the Kochel photo** (see the timing table at the end).
Don't cut away before it finishes; the wait itself is the proof point.
**Caption:** `Generate Depth Map — about 5 seconds, warm.`
**VO (optional):** "No prompt, no seed, no checkpoint — just the layer."

### 0:18–0:24 — Import: Depth

**Click:** **Import to Layers**.
**Screen:** cut to the Photoshop Layers panel — the new depth layer appears directly above the source,
same footprint. Toggle its visibility off/on once, fast, to show it's pixel-registered to the original
(no offset, no crop).
**Caption:** `Lands exactly aligned — same pixel size as the source layer.`

### 0:24–0:36 — Payoff: depth-of-field with Lens Blur

This is the "why an artist cares" beat for depth. **Verified against Adobe's current official docs**
(`helpx.adobe.com/photoshop/desktop/effects-filters/blur-sharpen-filters/create-depth-of-field-with-lens-blur.html`,
updated Feb 2026): the Lens Blur dialog's **Depth Map → Source** menu offers **None / Transparency /
Layer Mask** — there is **no separate "alpha channel" option** in the current UI, even though older
tutorials describe one. Use the **Layer Mask** route:

1. On the depth-map layer, **Select All** (Ctrl/Cmd+A) → **Copy**.
2. Select the original photo layer → add a **Layer Mask** (empty, white) via the Layers panel.
3. **Alt/Option-click** the new mask thumbnail to view it directly → **Paste** the depth map into it.
4. Click back onto the layer thumbnail (leaving the mask attached) → **Filter › Blur › Lens Blur**.
5. **Depth Map → Source: Layer Mask.** Drag **Blur Focal Distance** to show focus racking from the
   terrace furniture to the far mountains and back.
**Caption:** `The depth pass drives a real Lens Blur depth-of-field — Filter › Blur › Lens Blur, Source: Layer Mask.`
**VO (optional):** "Paste it into a layer mask, point Lens Blur at it, and you're racking focus with your own depth pass."

**Mehran: confirm this exact click path against your own Photoshop 2025 before recording** — this is
the one part of the script built from Adobe's documentation rather than a live test in your install,
per the brief's instruction to verify it.

### 0:36–0:45 — Generate + import: Line art

**Click:** **Map type** → **"Line art."**
**Click:** **Generate Line Art**.
**Screen:** hold for the real **~3s**.
**Click:** **Import to Layers**.
**Screen:** set the new layer's blend mode to **Multiply** over the photo.
**Caption:** `Generate Line Art — about 3 seconds. Set to Multiply for an inked look.`

### 0:45–0:52 — Generate + import: Normal (brief, per the brief)

**Click:** **Map type** → **"Normal map (BAE)."**
**Click:** **Generate Normal Map**.
**Screen:** hold for the real **~4s**.
**Click:** **Import to Layers**. Show the tangent-space colour result for a couple of seconds — no
further demo needed, this beat stays short.
**Caption:** `Generate Normal Map — about 4 seconds. Surface direction, for relighting and texture work.`

### 0:52–1:02 — Optional: Enhance Prompt beat

Only if the total is still under ~65s without it; cut this beat first if the video is running long.

**Click:** any prompt field (Text to Image is the simplest for this beat).
**Type:** a short prompt, e.g. `a lighthouse at dusk`.
**Click:** the amber dot beside the field (tooltip: "Enhance this prompt: expand it into a longer,
more descriptive one").
**Screen:** the field's text replaces itself with the expanded version.
**Key:** **Ctrl+Z** — the original short prompt returns.
**Caption:** `The amber dot expands a prompt locally. Ctrl+Z brings the original back.`

### 1:02–1:08 (or 0:52–0:58 if the Enhance beat is cut) — Close

**Screen:** repo card / title card.
**Caption:** `OpenLayer — free, MIT, alpha. github.com/MehranMarxian/OpenLayer`

---

## Recording notes

- **1080p**, docked panel layout (matches how the panel is actually used, not a floating/undocked
  demo layout nobody will reproduce).
- **Do the warm-up run first** — see above. This is the single most important note; skipping it
  produces a misleading first-generation time on camera.
- **No sped-up footage during the three Generate beats.** The whole point of stating real timings is
  that they're checkable; a video that visibly speeds through the wait undercuts
  that the first time someone times it themselves.
- **Call it "the amber dot"** in every caption and any voiceover.
- **Keep the source photo's licence out of the frame itself**; put the attribution line in the
  post/description text on whichever platform this ends up, per each venue's own convention.

## What this script does not claim

- Does not say Photoshop has no depth export: its Depth Blur filter can output one. The Lens
  Blur beat exists specifically because Photoshop *can* already do a version of the depth half of this,
  and showing OpenLayer's depth pass driving the same native filter is a stronger, more honest beat
  than pretending the capability didn't exist.
- Does not claim normal maps or line art are anything but genuinely unavailable natively in current
  Photoshop — that half of the claim is verified correct and used as-is.
- Does not promise a sparkle icon, a seed, a checkpoint, or any generative/diffusion behaviour for
  Layer Maps — none of that is in this release.

## Measured timings per candidate photo

Warm runs on the 4070 Ti through the shipped Layer Maps graphs, 2026-09-10, at each photo's full
size. Time scales with the size of the layer, so use the row for the photo you actually record with.

| Photo | Size | Depth | Line art | Normal |
| :--- | :--- | ---: | ---: | ---: |
| Kochel terrace (recommended) | 3840x2880 | 5.1s | 2.8s | 3.6s |
| Stockholm alley | 3744x5616 | 6.5s | 3.5s | 5.0s |
| Campo de' Fiori | 2304x1536 | 3.5s | 1.4s | 2.8s |

Kochel was tested at the 3840px Commons rendition; the 4032x3024 original will be marginally slower.

