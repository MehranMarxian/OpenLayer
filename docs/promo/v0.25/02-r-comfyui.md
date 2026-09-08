# Draft — r/comfyui

**Destination:** https://reddit.com/r/comfyui (new post)
**Account:** Mehran's existing Reddit account (same one behind the v0.12 thread, `1v8c1hc`).
**Format:** self-text post with one embedded before/after image, first-person.
**Rule check:** could not verify live — reddit.com is blocked to my tools, same as last cycle.
Mehran should open the sidebar/rules wiki himself before posting. General precedent unchanged:
this subreddit has historically been receptive to personal open-source tool posts with a real
screenshot and disclosed authorship.
**Prior contact:** the v0.12 thread got one real comment from an outside tester
(u/Far_Estimate7276). No confirmed r/comfyui post since — see `00-plan.md`'s note on the v0.20 drafts
possibly never having gone out.

---

## Title

```
Photoshop plugin for ComfyUI — new tool needs no prompt, no checkpoint, no particular GPU, and is provably your own pixels back
```

## Body

```markdown
I've been building a free, open-source Photoshop plugin (UXP panel) that talks to a local ComfyUI
server — text to image, img2img, sketch to image, inpaint, outpaint, upscale, live painting, all on
your own GPU, results come back as editable Photoshop layers instead of a flat PNG.

Posted here before around v0.12 and got real feedback — this is the actual follow-up, several
releases later.

**New in v0.25: Remove Background.** Capture a layer, press one button, get the subject back on its
own layer with real alpha, in about 2.2 seconds on a 4070 Ti. It's built entirely on ComfyUI's own
core nodes (`comfy_extras.nodes_bg_removal`) with BiRefNet — 444 MB, MIT, no custom node pack.

There's no diffusion anywhere in this graph — no prompt, no seed, no checkpoint — so unlike every
other tool in this plugin, it doesn't care which image models you have or how much VRAM you're
running. The part I actually like: the pixels that come back are yours. The graph joins BiRefNet's
matte onto your captured image rather than re-rendering it, measured at a mean absolute difference of
**0.0** against the source at full resolution. Diff it yourself if you don't believe a changelog.

[image: before/after — flat layer, then the cutout layer with a real alpha thumbnail]

The one trap in building it, for anyone curious: `RemoveBackground`'s node returns the **background**,
not the subject — mask came back inverted from what I expected, and joining it directly would've
erased the subject and kept the background. Rendered the raw matte and looked at it before trusting
the polarity.

Also this release: Unflatten (the flatten-to-layers tool from a few versions back) now detects when
it found nothing to separate and says so, instead of reporting a no-op as a success — it's still
labeled experimental everywhere, still needs a subject clear of its background. And Multi-Reference's
warning that it doesn't preserve a specific face had been accidentally hidden by a CSS rule since
v0.19 — fixed, it's on screen now.

Alpha software, Windows 11 + Photoshop 2025 is what's actually tested. **Two things nobody's told me
yet and I'd genuinely like to know, one-line answers are fine:**

1. Does the one-click `.ccx` install work on a machine that's never had this before?
2. Does any of this work on macOS at all?

Free, MIT, runs 100% locally — nothing generated leaves your machine.

Repo: https://github.com/MehranMarxian/OpenLayer
Download: https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx

Happy to answer anything about the ComfyUI side — plain HTTP + websocket to `/prompt` and
`/history`, no custom protocol.
```

---

### Notes for Mehran

- Needs the before/after screenshot before this can go out — see the asset gap in `00-plan.md`. This
  copy is otherwise ready.
- Reply to comments the day this goes up — don't let it sit the way some earlier posts apparently did.
- Keep a PNG fallback of the image ready in case Reddit's uploader doesn't like WebP.
