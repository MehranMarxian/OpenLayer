# Draft — r/StableDiffusion

**Destination:** https://reddit.com/r/StableDiffusion (new post)
**Account:** Mehran's Reddit account. No confirmed post to this subreddit across any cycle.
**Format:** self-text, trimmed from the r/comfyui version — this crowd skims faster and has seen more
tool launches; lead with the concrete numbers, not the backstory.
**Rule check:** unverified live, same block as every prior cycle. Reputation for stricter anti-spam
norms than r/comfyui — read the sidebar and any self-promo megathread first.
**Timing:** only after r/comfyui, and only if r/comfyui actually goes out this cycle (see `00-plan.md`
— sending r/StableDiffusion first, on a venue with zero prior contact, is the wrong place to catch a
wording problem).

---

## Title

```
Open-source Photoshop plugin for local ComfyUI — new tool pulls depth/line-art/normal maps off any layer at exact size, no sampler involved
```

## Body

```markdown
Free, open-source Photoshop plugin (UXP panel) talking to your own local ComfyUI — SD, SDXL, Flux,
FLUX.2 Klein. Text to image, img2img, sketch to image, inpaint, outpaint, upscale, live painting,
results land as real editable Photoshop layers.

**New this release: Layer Maps.** Capture a layer, pick depth / line-art / normal, generate. Comes
back as a new layer at the source's exact pixel size — no rescaling, sits straight over the original.
Same `comfyui_controlnet_aux` preprocessors this plugin has fed into ControlNet since v0.13, now
exposed as the output instead of an intermediate step.

**About 5s depth, 3s line art, 4s normal on a 4K photo, warm, on a 4070 Ti. No prompt, no seed, no checkpoint.**

[video or stills: same photo, all three maps]

One thing worth knowing if you use these preprocessors yourself: `resolution` on the ControlNet-aux
nodes sets the short side and rescales — it never gives back your source's own dimensions unless you
pin it with an `ImageScale` afterward. Also, the depth default here is Depth Anything V2 **Base**, not
the node's own Large default — Large collapsed a wide landscape into a near-white band in testing, and
Large is the one size gated non-commercial anyway. Small and Large are both still selectable.

Also shipped: **Enhance Prompt**, a small dot beside every prompt field that expands a short prompt
locally through SuperPrompt-v1 (308MB) via ComfyUI-KJNodes — no seed, same draft always expands the
same way, Ctrl+Z reverts it.

Alpha software, Windows-tested. **Genuinely open, one-line answers welcome:**

1. Does the one-click `.ccx` install work on a clean machine?
2. Does any of this work on macOS?

MIT licensed, 100% local, no telemetry, no account.

Repo: https://github.com/MehranMarxian/OpenLayer
Download: https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx
```

---

### Notes for Mehran

- If the subreddit requires flair or routes tool posts into a weekly thread, adapt to that format —
  don't post standalone against the rule.
- Needs the same video/stills as the r/comfyui draft.
