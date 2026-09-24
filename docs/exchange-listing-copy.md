# Exchange Listing Copy — DRAFT

**Status: DRAFT. Not published anywhere.** Staged for Mehran to paste into the Adobe Developer
Distribution listing form (the "General", "Media", and "Services" tabs). Written from the current
`README.md`, `docs/index.html`, `docs/known-limitations.md` and `CHANGELOG.md` at v0.37.0-alpha
(refreshed 2026-09-24; first drafted at v0.25.0). Every factual
claim here is already made, in the same words, somewhere in the repo — nothing was invented to sell
better.

Character limits below are Adobe's, verified live 2026-09-10 against the Developer Distribution
listing docs. Counts in `[n]` are the draft's current length.

---

## General tab

### Public plugin name  (max 45)

```
OpenLayer
```
`[9]`

Alternative if Mehran wants the capability in the name itself (still well under 45, and some
Marketplace listings do this):

```
OpenLayer — local ComfyUI AI for Photoshop
```
`[42]` — **decision needed.** Risk: a reviewer may expect the listing name to match the manifest
`name` field, which is `"OpenLayer"`. Recommendation: keep the name plain, carry the keywords in the
subtitle and the description's first line.

### Subtitle  (max 30)

Option A (recommended):
```
Local ComfyUI AI, as layers
```
`[27]`

Option B:
```
ComfyUI AI layers, on your GPU
```
`[29]`

### Description  (max 5000)

```
OpenLayer is a free, open-source Photoshop plugin that connects Photoshop to a ComfyUI server
running on your own machine. Generate with Stable Diffusion, SDXL, and Flux models, and every
result arrives as an editable Photoshop layer — named, positioned, and yours to keep working on,
not a flattened PNG you paste in and hope for.

It runs entirely on your computer. ComfyUI runs locally, on your own checkpoints and LoRAs.
Nothing is uploaded, there is no account, no metering, no credits, and no telemetry. If you retouch
client work or cannot send artwork to a hosted service, that is the whole point of this plugin.

WHAT IT DOES

- Text to Image — generate a new layer from a prompt
- Image to Image — reinterpret the active layer with a prompt
- Edit Image — change a layer by describing the change ("make the jacket red") while the rest
  of the picture stays where it is
- Sketch to Image — guide generation with your line art through a ControlNet
- Inpaint (experimental) — repaint a Photoshop selection in place
- Outpaint (experimental) — extend canvas content beyond the edges
- Upscale — enhance layers with local upscale models
- Remove Background — cut the subject onto its own layer with real alpha, in about two seconds,
  with no diffusion in the graph, so the pixels come back unchanged
- Layer Maps — read a depth, line-art or normal pass off any layer, returned at the layer's exact
  pixel size
- Prompt from Layer — describe a layer back into editable prompt text
- Multi-Reference (experimental) — compose one image from several reference layers
- Unflatten (experimental) — split one flat layer into separate layers, each with real transparency
- Live Painting (experimental) — paint and watch the model respond
- Layer Tools — export layers, selections, and masks back out to ComfyUI

Model licences are the models' own. Most presets use openly licensed models; the Qwen-Image 2.1
presets are opt-in, never the default, say "research licence" in their names, and are for
research and evaluation only — OpenLayer never downloads those weights for you.

An AI assistant can also drive the panel over the Model Context Protocol: Claude or Codex can work
the panel's own buttons in your open document. It is off by default and runs entirely on your
machine.

WHAT YOU NEED

- Photoshop 2024 or newer
- A local ComfyUI server (https://github.com/comfyanonymous/ComfyUI) — installed and started
  separately, the same way you would start any local server before connecting a client to it.
  OpenLayer does not bundle ComfyUI or any model; a Photoshop plugin cannot run a separate server
  process.
- A GPU with 8 GB of VRAM or more (12 GB is what the project targets)

The plugin's Setup screen lists every model and custom node its presets use, whether each is
installed, and where it goes — and it works before ComfyUI is even running.

STATUS

OpenLayer is an alpha: a public testing checkpoint, not production software. It is stable enough to
work with and candid about where it stops. Tools marked experimental above are labelled the same way
in the panel itself. The full, current list of what works and what does not is at
https://github.com/MehranMarxian/OpenLayer/blob/main/docs/known-limitations.md

Free and MIT-licensed. Source, issues, and discussion:
https://github.com/MehranMarxian/OpenLayer
```
`[~1930]` — **decided 2026-09-24: keep "alpha".** (Was D3 / audit 6.2.) If the listing
should soften to "beta", change the STATUS paragraph's first sentence only; the repo voice stays as
is.

### Support email  (required)

**Decision needed from Mehran.** Options: a dedicated address (e.g. `support@mehran-ahmadi.com` if he
can make one) or his personal address on file. Adobe requires a monitored contact; GitHub Issues
alone does not satisfy the field, though it can be named in the description.

### Help URL  (optional but recommended)

```
https://github.com/MehranMarxian/OpenLayer#readme
```

Alternative, more task-focused:
```
https://mehran-ahmadi.com/OpenLayer/#setup
```

### Categories / Tags  (tags max 300)

Suggested tags, in the pattern the audience actually searches:
```
comfyui, stable diffusion, flux, ai, image generation, local, offline, inpainting, upscale,
generative, sdxl, txt2img, img2img
```
Category: whichever Adobe list option is closest to "Automation" / "Graphics & Design" / "3D & AI"
— pick at the form, it is a fixed dropdown.

---

## Media tab

Asset specs, verified live 2026-09-10:

| Asset | Spec | Have it? |
|---|---|---|
| Listing icon 48×48 | PNG/JPG, < 1 MB | Need to export — source is `docs/assets/openlayer-icon-152.png` |
| Listing icon 96×96 | PNG/JPG, < 1 MB | Same source, resize |
| Listing icon 192×192 | PNG/JPG, < 1 MB | Same source, resize |
| Publisher logo 250×250 | PNG/JPG, < 2 MB | Need to export (first-time publisher-profile asset; may already be done — see note) |
| Screenshot 1 (required) | 1360×800, PNG/JPG, < 5 MB | **Not captured** — needs the panel running in Photoshop |
| Screenshots 2–5 (optional) | 1360×800, PNG/JPG, < 5 MB | **Not captured** |
| Video | up to 5 YouTube/Vimeo URLs | Two exist on the landing page (embeds `LD_gPQoCAnw`, `Mh5EddKxZew`), both from an earlier alpha. A purpose-cut demo is scripted in `docs/exchange-demo-shooting-script.md` but never recorded. |

**Screenshot shot list (need Photoshop + a running panel to capture, 1360×800 each):**

1. Text to Image mid-result: the panel docked, a generated image in the preview, and the Layers
   panel visible with the imported layer — the "it became a layer" beat. Closest existing asset:
   `docs/assets/v060/text-to-image-photoshop.webp` (wrong dimensions, old build).
2. Remove Background before/after: subject cut onto its own layer with the checkerboard showing
   through. There is still no screenshot of it anywhere.
3. The Setup screen with ComfyUI stopped — showing the model list, install status, and folder
   locations. Doubles as proof the cold state is a designed screen, not a broken one (audit 3.1).
4. Sketch to Image: the line-art layer and the rendered result side by side in one document.
5. The tool dashboard itself, Artist-Friendly Dark theme, tools grouped by what the machine can run.

The old WebP assets on the landing page are the right *content* but wrong dimensions and several
UI generations stale. All five need re-shooting at 1360×800 on the current build.

---

## Services tab

| Field | Value |
|---|---|
| Privacy policy URL | `https://mehran-ahmadi.com/OpenLayer/privacy.html` |
| Terms of service URL | `https://mehran-ahmadi.com/OpenLayer/terms.html` |

Both are published and linked from `docs/index.html`. Note: current listing docs mark these two
fields "optional", while the Creative Cloud submission overview describes them as required on the
Services tab — likely conditionally required for a plugin that touches the network and filesystem.
OpenLayer has both regardless, so this is not a blocker either way.

---

## Version details  (max 1000, per submitted version)

```
v0.37.0-alpha. Recent releases added Edit Image (change a layer by describing the change), Layer
Maps (depth, line-art and normal passes as new layers), and opt-in Qwen-Image 2.1 presets for
lettering, native 2K and transparent layers generated with real alpha (research licence, never a
default). Transparent results such as Remove Background cut-outs now land exactly where they were
captured. Full notes: https://github.com/MehranMarxian/OpenLayer/blob/main/CHANGELOG.md
```
`[~460]`

---

## Note to Adobe Reviewers  (max 1000 — hard limit, the full version in `docs/exchange-reviewer-notes.md` is longer and must be trimmed to fit)

```
OpenLayer is a client for ComfyUI, a free local AI image server. It does not bundle ComfyUI or any
model — a Photoshop plugin cannot run a server process, so ComfyUI is installed and started
separately.

Fastest path to one working generation (~10–15 min, mostly one download):
1. Install ComfyUI (portable build, Windows). Start with its default command.
2. Put any SD 1.5 checkpoint (~2 GB, no login) in ComfyUI/models/checkpoints/.
3. Install OpenLayer, open it from Plugins > OpenLayer.
4. Settings > Find ComfyUI Active Port (auto-detects the server).
5. Text to Image > pick the checkpoint > prompt > Generate. ~seconds on any GPU.
6. Import to Layers — result lands as a layer.

Opening the panel with ComfyUI off or no models installed is an expected, labelled state (the Setup
screen), not a failure.

Permissions: this plugin talks only to a server you point it at (ComfyUI's address is user-entered,
not fixed) and to model-download hosts you confirm; it needs silent read/write to ComfyUI's own
models/ folder, which is outside plugin storage. No telemetry, no accounts. Full permission
rationale on request.

Known: tested on Windows only so far; inpaint/outpaint are marked experimental in-panel.
```
`[~990]` — **at the limit.** If Adobe's field rejects it, cut the numbered list to prose. The
untrimmed version stays in `docs/exchange-reviewer-notes.md`.

---

## Where the permission justification goes

The audit assumed a dedicated per-permission justification field. The current listing-form
documentation does **not** list one — permission disclosure is auto-generated onto the public
Marketplace page from the manifest. So the justification text in
`docs/exchange-permission-justification.md` has two homes:

1. A compressed version inside **Note to Adobe Reviewers** (done above, last paragraph).
2. Kept in full in the repo to answer a reviewer follow-up quickly if one comes.

If the portal turns out to have a permissions field after all (only visible once the listing is
open), paste `docs/exchange-permission-justification.md` into it verbatim.
