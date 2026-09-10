# Draft — GitHub Discussions (Announcements category)

**Destination:** https://github.com/MehranMarxian/OpenLayer/discussions (new post, category
"Announcements")
**Account:** MehranMarxian
**Note:** anchor URL every other venue links back to. Confirmed via `gh api graphql` that the newest
discussion is still #104 (v0.20, posted 2026-09-02, 0 comments) — the v0.25 discussion draft was never
posted, so there is no v0.25 catch-up post to point back to from this one. Say so in the post rather
than pretending v0.25 got its own announcement.

---

## Title

```
v0.30.0-alpha: Layer Maps — depth, line art and normal passes off any layer, exact pixel size, no prompt
```

## Body

```markdown
Two additions this release, both of which hand you something the panel already had inside it.
Neither one runs a sampler.

## Layer Maps

Capture a layer, pick a map type, press Generate. You get back a **depth**, **line-art** or **normal**
pass as a new layer, at your source layer's exact pixel size — it sits straight over the original,
no rescaling.

- **Depth (Depth Anything V2)** — near bright, far dark. Fog, depth of field, displacement, relighting
  comps.
- **Line art** — black lines on white, ready to ink or colour over. Set the imported layer to Multiply.
- **Normal map (BAE)** — a tangent-space surface-normal pass for relighting and texture work.
- **A few seconds per map** on a 4070 Ti: about 5s depth, 3s line art, 4s normal on a 4K photo. No prompt, no seed, no
  checkpoint.

[video or map-stills: capture → three maps over the same photo]

Photoshop's own Depth Blur filter can output a depth map, but it needs an internet connection and
offers one fixed model. It has no normal-map or line-art output at all. Layer Maps gives you all
three, on your own GPU, at your layer's exact size.

It uses `comfyui_controlnet_aux`, the same package the Sketch to Image presets already need, and each
annotator downloads its own weights the first time you use that map type — the first run of each kind
is slower than the rest.

## Enhance Prompt

A small amber dot next to every prompt field, beside the Wallet's green save and purple load dots.
Press it and a short prompt gets expanded into a longer, more descriptive one — locally, through
SuperPrompt-v1 (308 MB) via ComfyUI-KJNodes. No seed, so the same draft always expands the same way.
Ctrl+Z restores what you typed. It's a small model: it embellishes, it doesn't reason, and it sometimes
adds detail you didn't ask for.

## Also in this release

- Remove Background and Layer Maps are now reachable over the Agent Bridge (MCP) — Remove Background
  shipped in v0.25 without an MCP entry, so the README's "every tool is covered" claim wasn't true
  until now.
- The Prompt Wallet's three dots are 16×16 instead of 11×11 — easier to hit mid-sentence.
- Setup pack now lists ComfyUI-KJNodes as a required node package for Enhance Prompt.

Full detail: [CHANGELOG](https://github.com/MehranMarxian/OpenLayer/blob/main/CHANGELOG.md) ·
[known limitations](https://github.com/MehranMarxian/OpenLayer/blob/main/docs/known-limitations.md)

## Still true, every release

Alpha software. Verified on Windows 11 with Photoshop 2025. **macOS has never been confirmed by
anyone.**

Free, MIT-licensed, runs entirely on your own ComfyUI server — nothing generated ever leaves your
machine.

[Download the .ccx](https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx) ·
[Repo](https://github.com/MehranMarxian/OpenLayer) · [Wiki](https://github.com/MehranMarxian/OpenLayer/wiki)

## Two questions, either answer helps

1. **Does the one-click `.ccx` install actually work on a machine that's never had this on it?**
2. **Does any of this work on macOS?**

One line is enough — "yes, worked" or "no, here's where it stopped." Comment below, or open an issue
if something broke.
```

---

### Notes for Mehran

- **Image/video hosting**: same rule as every prior cycle — GitHub Discussions needs an uploaded image
  or an absolute `raw.githubusercontent.com` / `user-attachments` URL, not a relative path. Drag the
  video (or the three map stills, if the video isn't ready yet) directly into the comment editor.
- No "everything since v0.25" catch-up section is needed — the CHANGELOG jumps straight from v0.25.0
  to v0.30.0 with no gap, so there's nothing shipped-and-unannounced to summarize.
- Consider adding one line near the top acknowledging v0.25 never got its own Discussion post — "the
  last release didn't get a writeup here; this one does" is a more honest opener than pretending
  continuity that doesn't exist. Optional, your call.
