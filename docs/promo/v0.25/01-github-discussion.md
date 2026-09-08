# Draft — GitHub Discussions (Announcements category)

**Destination:** https://github.com/MehranMarxian/OpenLayer/discussions (new post, category
"Announcements")
**Account:** MehranMarxian
**Note:** anchor URL every other venue links back to. Post this one first, and see the required
image-hosting note at the bottom before publishing.

---

## Title

```
v0.25.0-alpha: Remove Background — a cutout with no prompt, no checkpoint, and provably your own pixels
```

## Body

```markdown
Mostly a release about telling the truth: what the panel connects to, what it can do, and what it
cannot. One new tool, and a run of fixes to things that were quietly wrong.

## Remove Background

Capture a layer, press one button, get the subject back on its own layer with real alpha.

- **~2.2 seconds** on a 4070 Ti.
- **No prompt, no seed, no checkpoint.** There's no diffusion anywhere in this graph, so it doesn't
  care which image models you have installed, or how much VRAM your card has — the barrier every
  other tool here has, gone for this one.
- Built on ComfyUI's own core nodes (`comfy_extras.nodes_bg_removal`) with BiRefNet — 444 MB, MIT.
  No custom node pack to install.
- **The pixels that come back are yours.** The graph joins BiRefNet's matte onto the image you
  captured rather than re-rendering it — measured at a mean absolute difference of **0.0** against
  the source, at full capture resolution. Nothing scaled, re-encoded, or degraded; an alpha channel
  is added and that's it. This is checkable by anyone who diffs the two files themselves, which is
  more than any web-based cutout tool can offer.

[screenshot: before/after, flat layer → cutout layer with visible alpha in the Layers panel]

The one trap building it: `RemoveBackground` returns the **background**, not the subject — its mask
came back with the photographed subject at alpha 0 and everything behind them at 255. Joining it
directly would have erased the one thing you wanted to keep. The mask gets inverted before it
becomes alpha, and I rendered the raw matte and looked at it rather than assuming the polarity.

## Unflatten now tells you when it didn't work

Hand it a close-up that fills the frame and the model has no front/back to find — it used to return
the source unchanged and announce `Imported 1 layers` in the same success tone as a real result.
Indistinguishable from working, and the single biggest reason the tool read as useless. It now
detects that case and says so. Unflatten stays **experimental** — that's said in the same breath as
what it does everywhere now, not several paragraphs later.

## Warnings you were never shown

Seven info panels and one tool warning had been `display: none` in the only theme that carries real
styling rules, including Multi-Reference's warning that **faces do not carry across from a
reference** — v0.19's load-bearing limitation, unreadable by anyone until this release. It's on
screen now, not behind a toggle.

## Also in this release

- The default ComfyUI address moved from `8190` to `8188` (the port ComfyUI itself starts on).
  Anyone with a saved address is unaffected; a fresh failed connection now runs the port scan itself
  once. Settings › Find ComfyUI Active Port still works either way.
- Classic v0.4 theme no longer traps you — selecting it used to blow every icon up to 128px,
  Settings included, so you couldn't get back out.
- Prompt from Layer can save to the Prompt Wallet.
- Remove Background and Unflatten have their own icons.

Full detail: [CHANGELOG](https://github.com/MehranMarxian/OpenLayer/blob/main/CHANGELOG.md) ·
[known limitations](https://github.com/MehranMarxian/OpenLayer/blob/main/docs/known-limitations.md)
(four tools carry a real caveat — Inpaint, Outpaint, Multi-Reference, Unflatten — worth reading
before the roadmap).

## Still true, every release

Alpha software. Verified on Windows 11 with Photoshop 2025. **macOS has never been confirmed by
anyone.**

Free, MIT-licensed, runs entirely on your own ComfyUI server — nothing generated ever leaves your
machine.

[Download the .ccx](https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx) ·
[Repo](https://github.com/MehranMarxian/OpenLayer) · [Wiki](https://github.com/MehranMarxian/OpenLayer/wiki)

## Two questions, and either answer is useful

1. **Does the one-click `.ccx` install actually work on a machine that's never had this on it?**
2. **Does any of this work on macOS?**

You don't need to write a report — a one-line "yes, worked" or "no, here's where it stopped" is
worth more to this project right now than almost anything else. Comment below, or open an issue if
something broke.
```

---

### Notes for Mehran

- **Image hosting**: same rule as last cycle — GitHub Discussions needs an uploaded/attached image
  or an absolute `raw.githubusercontent.com`/`user-attachments` URL, not a relative markdown path.
  Drag-and-drop the before/after screenshot into the comment editor once it exists (see the asset gap
  in `00-plan.md` — **this screenshot does not exist yet**, this draft is otherwise ready).
- Before posting this, edit discussion **#104** (the v0.20.0 catch-up post) to add a one-line forward
  pointer at the top, the same way #83/#85/#88/#94 were edited last cycle — see `07-old-posts-updates.md`.
- No catch-up section for "everything since v0.20" this time, unlike #104's catch-up for v0.16–v0.19:
  the published tags jump straight from `v0.20.0-alpha` to `v0.25.0-alpha` and the CHANGELOG has no
  `v0.21`–`v0.24` sections, so there's nothing shipped-and-unannounced sitting in between to catch up
  on. If v0.21–v0.24 exist as internal/unpublished work, that's a different note, not a promo gap.
