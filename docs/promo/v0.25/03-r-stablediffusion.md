# Draft — r/StableDiffusion

**Destination:** https://reddit.com/r/StableDiffusion (new post)
**Account:** Mehran's Reddit account. No confirmed prior post to this subreddit (the v0.20-cycle
draft for it appears never to have been sent — see `00-plan.md`).
**Format:** self-text post, same image as r/comfyui, trimmed copy — this audience skims faster and
has seen more tool launches.
**Rule check:** could not verify live — reddit.com is blocked to my tools. Reputation for being
stricter about tool/plugin posts reading as low-effort promotion than r/comfyui; read the sidebar and
any pinned self-promo megathread before posting.
**Timing:** a few days after r/comfyui, so wording problems or bugs surface first in the smaller venue.

---

## Title

```
Open-source Photoshop plugin for local Stable Diffusion/Flux — new tool does background removal with no prompt, no checkpoint, and a verifiable pixel-identical result
```

## Body

```markdown
Free, open-source Photoshop plugin (UXP panel) that talks to your own local ComfyUI server — SD,
SDXL, Flux, FLUX.2 Klein. Text to image, img2img, sketch to image, inpaint, outpaint, upscale, live
painting. Results land as real, editable Photoshop layers.

The new thing in v0.25 — **Remove Background** — is the first tool in this project with zero
diffusion in it: no prompt, no seed, no checkpoint. Core ComfyUI nodes
(`comfy_extras.nodes_bg_removal`) with BiRefNet, 444 MB, MIT. ~2.2s on a 4070 Ti. Because there's no
model choice or VRAM tier involved, it's the one tool here that doesn't care what your setup looks
like.

The claim worth checking rather than trusting: the graph composites BiRefNet's matte onto the image
you captured instead of re-rendering it, measured at a mean absolute difference of **0.0** against the
source at full resolution. Only an alpha channel gets added.

[image: before/after — flat layer, cutout layer with real alpha]

Also shipped this release: Unflatten (splits a flat layer back into several with alpha — still
experimental, needs a subject clear of a background) now detects and reports the case where it found
nothing to separate, instead of silently returning the source and calling it success. And Multi-
Reference's warning that it does **not** preserve a specific person's face had been invisible due to a
CSS bug since v0.19 — visible now.

Alpha software, Windows-tested. **Genuinely open questions, one-line answers welcome:**

1. Does the one-click `.ccx` install work on a clean machine?
2. Does any of this work on macOS?

MIT licensed, 100% local, no telemetry, no account.

Repo: https://github.com/MehranMarxian/OpenLayer
Download: https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx
```

---

### Notes for Mehran

- If the subreddit requires a specific flair ("Resource," "Workflow Included") or a weekly self-promo
  thread, this text drops into that format — don't post standalone if the rules say otherwise.
- Needs the same before/after screenshot as the r/comfyui draft — doesn't exist yet.
