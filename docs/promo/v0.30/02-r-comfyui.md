# Draft — r/comfyui

**Destination:** https://reddit.com/r/comfyui (new post)
**Account:** Mehran's existing Reddit account (same one behind the v0.12 thread, `1v8c1hc`).
**Format:** self-text post with the video (or the map stills if it isn't ready), first-person.
**Rule check:** could not verify live — reddit.com is blocked to my tools, unchanged for three cycles
running. Mehran should open the sidebar/rules wiki himself before posting.
**Prior contact:** the v0.12 thread got one real comment (u/Far_Estimate7276). **No confirmed r/comfyui
post since, across two full release cycles of drafted-and-never-sent copy** — see `00-plan.md`'s
pattern section. This is the venue I'd actually push Mehran to make a real yes/no call on this time,
rather than let it default to "maybe next cycle" again.

---

## Title

```
Photoshop plugin for ComfyUI — new tool exports depth, line art and normal maps off any layer at its exact pixel size
```

## Body

```markdown
Free, open-source Photoshop plugin (UXP panel) talking to a local ComfyUI server — text to image,
img2img, sketch to image, inpaint, outpaint, upscale, live painting, results come back as editable
Photoshop layers.

**New in v0.30: Layer Maps.** Capture a layer, pick depth / line-art / normal, press Generate. You get
the pass back as a new layer, at the source layer's exact pixel size, so it sits straight over the
original with no rescaling. It's the same `comfyui_controlnet_aux` preprocessors this plugin has used
for ControlNet conditioning since v0.13 — this just hands you the pass itself as the deliverable
instead of feeding it straight into a sampler.

Warm on a 4070 Ti: **3.0s depth, 0.7s line art, 2.1s normal for a 768x512 layer; about 5s, 3s and 4s on a 4K photo.** No prompt, no seed, no checkpoint.

[video: capture → generate each map type → import, over the same photo]

Photoshop's own Depth Blur filter can output a depth map, but it needs an internet connection and
offers one fixed model. It has no normal-map or line-art output at all. Layer Maps gives you all
three, on your own GPU, at your layer's exact size.

Four things that were measured, not assumed, and changed what shipped — worth knowing if you build
against these preprocessors yourself:

- `resolution` on the ControlNet-aux preprocessors sets the **short side** and rescales to match, so
  it never returns your source's own dimensions unless you pin it afterward with an `ImageScale` node.
- Line-art annotators return white-on-black (correct for ControlNet, backwards for inking) — the graph
  inverts before saving.
- Depth defaults to **Base**, not the node's own Large default — Large collapsed a wide landscape into
  a near-white band in testing, and it's also the one size gated behind a non-commercial license.
- **Giant isn't offered at all** — its weights were announced and never published; the repo 401s.

Also this release: a small amber dot beside every prompt field that expands a short prompt locally
(SuperPrompt-v1, 308MB, no seed, Ctrl+Z reverts it), and Remove Background + Layer Maps are now
reachable over the project's MCP bridge for anyone driving Photoshop from an agent.

Alpha software, Windows 11 + Photoshop 2025 is what's actually tested. **Two things nobody's told me
yet, one-line answers welcome:**

1. Does the one-click `.ccx` install work on a machine that's never had this before?
2. Does any of this work on macOS?

Free, MIT, 100% local — nothing generated leaves your machine.

Repo: https://github.com/MehranMarxian/OpenLayer
Download: https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx

Happy to talk through the ComfyUI side — plain HTTP + websocket to `/prompt` and `/history`.
```

---

### Notes for Mehran

- This copy is ready as soon as the video (or at minimum the three map stills) exists — see
  `layer-maps-demo-photo.md` and `layer-maps-video-script.md`.
- If you decide to send this one, reply to comments the same day — don't let it sit.
- Given the two-cycle pattern of this exact draft never going out, treat sending it as a real decision
  this time, not a default.
