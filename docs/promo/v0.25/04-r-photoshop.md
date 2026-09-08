# Draft — r/photoshop

**Destination:** https://reddit.com/r/photoshop (new post)
**Account:** Mehran's Reddit account. No confirmed prior post to this subreddit.
**Format:** self-text post, framed around cost/privacy and "no special GPU needed for this one
feature" rather than ComfyUI internals — this audience is design generalists, not necessarily people
running a local SD setup already.
**Rule check:** could not verify live — reddit.com is blocked to my tools. Disclose authorship in
the first line regardless; this community tends to remove posts that read as a bare ad without an
"I made this" framing.
**Timing:** several days after the ComfyUI-cluster posts, its own schedule.

---

## Title

```
I built a free, open-source Photoshop plugin with a one-click background remover — no subscription, no credits, and I can prove the pixels it hands back are untouched
```

## Body

```markdown
I'm the developer — wanted to say that up front.

Generative Fill and Firefly are good tools, but they meter you by credit and everything goes through
Adobe's cloud. I built a Photoshop plugin (OpenLayer) that does a bunch of the same categories of
thing — background removal, inpaint, outpaint, upscale, sketch-to-image, text-to-image — but running
entirely on your own computer against a local ComfyUI server. No account, no subscription, no upload.

**The newest tool, Remove Background, is the one I'd actually point this subreddit at first.**
Capture a layer, press one button, get your subject back on its own layer with a real alpha channel,
in about two seconds. Unlike everything else in this plugin, it has no AI-model choice to make and no
particular GPU tier to hit — there's no image generation involved at all, just a segmentation model
finding the subject. And the part that matters most for a "free alternative" claim to actually hold
up: the pixels you get back are **measurably identical** to what you captured — I can diff the file
before and after and get zero difference outside the new alpha channel. It's not re-rendering your
photo through a diffusion model and hoping it looks the same; it's your photo, plus transparency.

[image: before/after — subject on a checkerboard alpha background]

**The real cost, stated plainly:** this is not a one-click install like a Firefly feature. You need to
separately install and run ComfyUI (free, open source) and have a GPU — 8 GB VRAM minimum for the
image-generation tools, though Remove Background specifically is much lighter than that. If a second
piece of software is more setup than you want, this isn't a drop-in replacement for you yet. If you
already have a decent GPU or don't mind a one-time setup, it's a genuinely free option.

This is alpha software — it works, and I try to be specific about the rough edges instead of
overselling. Windows 11 + Photoshop 2025 is what's actually tested.

**Two things I genuinely don't know yet, and any answer helps:**

1. Does the one-click `.ccx` installer work on a machine that's never had this on it?
2. Does any of this run on macOS? I have zero confirmed reports either way.

Free, MIT-licensed, open source: https://github.com/MehranMarxian/OpenLayer
One-click install (needs Creative Cloud): https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx

Happy to answer anything about setup or what it can/can't do.
```

---

### Notes for Mehran

- This is the one post where "alternative to a paid Adobe feature" is the right lead, per the
  project's own SEO guidance — everywhere else, lead with the ComfyUI ecosystem angle instead.
- Expect "does this need a subscription to ComfyUI/models" as the top question — one-line answer
  ready: no, ComfyUI and the models used here are free; some other presets in the plugin need larger
  downloads, documented in the wiki.
- If the subreddit disallows plugin/tool posts outright, hold this one rather than push through —
  it's the least-proven venue in this batch.
- Needs the same before/after asset as the other Reddit drafts, ideally the checkerboard-alpha
  variant specifically since this audience reads that image faster than a Layers-panel screenshot.
