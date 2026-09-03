# Draft — r/photoshop

**Destination:** https://reddit.com/r/photoshop (new post)
**Account:** Mehran's Reddit account. No prior post to this subreddit found — fresh venue.
**Format:** self-text post, framed around cost/privacy rather than ComfyUI internals — this audience
is design generalists, not necessarily people who already run a local Stable Diffusion setup.
**Rule check:** could not verify live — reddit.com is blocked to my tools. Disclose authorship in
the first line regardless of what the sidebar says; this community skews toward removing posts that
read as a bare ad without a "I made this" framing.
**Timing:** several days after the ComfyUI-cluster posts, on its own schedule — different audience,
no need to bunch it with the others.

---

## Title

```
I built a free, open-source Photoshop plugin that runs Stable Diffusion/Flux locally — no subscription, no credits, nothing uploaded (alternative to Generative Fill's credit system)
```

## Body

```markdown
I'm the developer — wanted to be upfront about that before anything else.

Generative Fill and Firefly are good, but they meter you by credit and everything goes through
Adobe's cloud. I built a Photoshop plugin (OpenLayer) that does text-to-image, image-to-image,
sketch-to-image, inpaint, outpaint, upscale, and a few other tools the same way, but running
entirely on your own computer against a local ComfyUI server. No account, no subscription, no
upload — nothing you generate ever leaves your machine, and results come back as normal, editable
Photoshop layers, not a flattened image pasted in.

**The real cost, stated plainly:** it is not a one-click install like a Firefly feature. You need to
separately install and run ComfyUI (free, open-source itself) and have a GPU with at least 8 GB of
VRAM — 12 GB is what I actually target. If that's more setup than you want, this isn't a drop-in
replacement for you yet. If you already have or are willing to get a decent GPU and don't mind a
one-time setup, it is a genuinely free alternative.

The newest feature (v0.20) is one I haven't seen anywhere else: **Unflatten** — hand it a flat layer
and it comes back as separate layers with real transparency, already stacked correctly. It needs a
subject clearly in front of a background to work; a tight close-up comes back unchanged, and I say
so on the screen rather than let people find out by trial and error.

[image: unflatten.webp]

This is alpha software — it works, and I try to be specific about the rough edges rather than
oversell it. Windows is what's been tested; I have no confirmed reports from macOS yet, so if
anyone here is on a Mac, that's the single most useful piece of feedback I could get.

Free, MIT-licensed, open source: https://github.com/MehranMarxian/OpenLayer
One-click install (Creative Cloud): https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx

Happy to answer questions about setup or what it can/can't do yet.
```

---

### Notes for Mehran

- This is the one post where leading with "alternative to a paid Adobe feature" is the right framing
  per the system's own SEO guidance — everywhere else, lead with the ComfyUI ecosystem angle instead.
- Expect the top question to be "does this need a subscription to ComfyUI/models" — worth having a
  one-line answer ready (no: ComfyUI and the base models used here are free; some presets need
  larger downloads, documented in the wiki's Hardware and Performance page).
- If the subreddit turns out to disallow plugin/tool posts entirely (some design subs do), this is
  the one to hold rather than push through — it's the least proven venue in this batch.
