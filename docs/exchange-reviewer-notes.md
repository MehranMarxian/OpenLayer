# Notes for the Adobe Reviewer

Paste-ready content for the Developer Distribution submission's reviewer/test-instructions field.
Written to get a reviewer to one real, working generation as fast as possible, without assuming
they'll do a full model-collection setup.

## What this plugin is

OpenLayer is a client for [ComfyUI](https://github.com/comfyanonymous/ComfyUI), a free,
open-source local AI image generation server. OpenLayer does not bundle ComfyUI or any AI model —
Photoshop plugins can't install or run a separate server process, so ComfyUI has to be installed
and started independently, the same way you'd start any other local server before connecting a
client to it.

## Fastest path to one working generation (~10–15 minutes, most of it a single download)

1. Install [ComfyUI](https://github.com/comfyanonymous/ComfyUI) (portable build is fastest on
   Windows). Start it with its default launch command — no special flags needed.
2. Download **any standard SD 1.5 checkpoint** (`.safetensors`, ~2 GB, no license click-through
   required) into ComfyUI's `models/checkpoints/` folder. This is the lightest, least-gated model
   family the plugin supports — deliberately the right choice for a first look, not the
   highest-quality option OpenLayer offers.
3. Install OpenLayer (see packaging notes below) and open it from Photoshop's Plugins menu.
4. In **Settings**, click **Find ComfyUI Active Port** — it detects the running server
   automatically; you don't need to know or set the port yourself.
5. Go to **Text to Image**, pick the SD 1.5 checkpoint from the dropdown, type any prompt, click
   **Generate**. A 512×512 SD 1.5 generation completes in a few seconds on most GPUs.
6. Click **Import to Layers** — the result lands as a new layer in the open Photoshop document.

## What to expect before that setup is done

Opening the panel with ComfyUI not running, or with no models installed yet, is an expected and
handled state, not a bug: the **Setup** screen (under Preferences) lists every model file and
custom-node package OpenLayer's presets use, whether each is installed, and offers an in-panel
download for most of them. **Check ComfyUI** and **Check Workflow Health** report a clear "not
connected" / "missing" status rather than failing silently. If anything looks broken rather than
clearly-labeled-as-not-set-up-yet in this state, that's worth flagging back to us directly — it's
not intended behavior.

## Permissions

See [docs/exchange-permission-justification.md](exchange-permission-justification.md) for the
per-permission reasoning behind `network.domains: all`, `localFileSystem: fullAccess`, and
`clipboard: readAndWrite`. Short version: this plugin is a client for a service you point it at
yourself (ComfyUI's address is user-entered, not fixed), and it needs silent read/write access to
that service's own `models/` folder, which lives outside the plugin's own storage.

## Privacy / data handling

No telemetry, no analytics, no accounts. Full policy at
https://mehran-ahmadi.com/OpenLayer/privacy.html.

## Demo video

Shooting script at [docs/exchange-demo-shooting-script.md](exchange-demo-shooting-script.md) —
sketch → edit → outpaint → upscale in one continuous document, ~20–25 seconds. Not yet recorded;
link goes here once it is.

## Known limitations at this release

Inpaint and Outpaint are explicitly marked experimental in the panel itself — this is intentional
labeling, not an oversight. See the CHANGELOG's "Known limitations" section for the current
release for the complete, honest list.
