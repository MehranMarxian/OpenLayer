# Draft — GitHub Discussions (Announcements category)

**Destination:** https://github.com/MehranMarxian/OpenLayer/discussions (new post, category
"Announcements")
**Account:** MehranMarxian (already the account behind every prior Announcements post)
**Note:** this is the anchor URL every other venue links back to. Post this one first.

---

## Title

```
v0.20.0-alpha: Unflatten splits one flat layer back into real Photoshop layers (and everything since v0.15)
```

## Body

```markdown
It's been a while since the last one of these — v0.15.0 was the last version that got its own post,
and one video-only update in between. Four releases happened without an announcement anywhere:
v0.16.0, v0.18.0, v0.19.0, and now v0.20.0. Catching up, newest first.

## v0.20.0 — Unflatten

Hand the panel a flat layer and get the picture back as separate Photoshop layers, each with real
transparency, imported in stacking order inside one group. As far as I know nothing else puts a
decomposed layer stack into a host application like this — most local-generation tools hand you back
a flattened PNG and you cut it apart yourself.

![Unflatten result — Layer 2 (front) with its alpha mask above Layer 1 (back)](../assets/v0200/unflatten.webp)

Two honest limits, stated because they're the first two questions anyone testing this should ask:

- **It needs a subject standing clear of a background.** A close-up that fills the frame has no
  front/back to find and comes back unchanged. The panel can't detect this and warn you — deciding
  needs the image's alpha channel, and nothing in a UXP panel can decode a PNG — so it's stated on
  the screen and in the docs instead of guessed at in code.
- **The layer count you ask for is a ceiling, not a promise.** Empty plates are left out rather than
  imported, so asking for four and getting two is the tool working, not failing.

Full writeup, including the two questions that overturned my own assumptions along the way:
`docs/unflatten-gate-findings.md` in the repo.

## v0.19.0 — Multi-Reference Composition

Give the panel an ordered list of captured layers instead of one, and it composes a single image out
of all of them with FLUX.2 Klein — no new downloads, it shares the Klein stack the other presets
already use.

![Two reference layers composed into a neon rainy street scene](../assets/v0200/multi-reference.webp)

Said plainly because it matters: **it does not preserve a specific person's face.** Clothing, props,
lighting and setting carry across from a reference; four real test photographs, including a clean
studio portrait, all came back as a plausible stranger. Treat it as scene composition, not as a way
to put someone recognisable into a picture.

## v0.18.0 — Style Reference, and the Workflow tab going live

Borrow a reference layer's mood and colour on a new generation (IPAdapter Plus, SD 1.5). Also: the
Workflow Presets catalogue and a Custom Workflow checker that validates any pasted ComfyUI graph
against what your server actually has installed — both had been greyed out on the dashboard since
v0.14.

## v0.16.0 / v0.17.4 — Artist-Friendly Dark theme, sliders, and the Prompt Wallet

A dark theme built for looking at art instead of matching Photoshop's chrome, numeric sliders on
every tool, a seed dice button, and the Prompt Wallet — save a prompt from any tool with a green
circle, recall it from any other tool with a purple one.

![The Artist-Friendly Dark dashboard](../assets/v0200/dashboard-artist-dark-crop.webp)

## Also new since v0.15

- **A GitHub wiki**, if you want more than release notes: [Home](https://github.com/MehranMarxian/OpenLayer/wiki)
  (project overview), [Choosing a Model](https://github.com/MehranMarxian/OpenLayer/wiki/Choosing-a-Model),
  [Hardware and Performance](https://github.com/MehranMarxian/OpenLayer/wiki/Hardware-and-Performance),
  [FAQ](https://github.com/MehranMarxian/OpenLayer/wiki/FAQ).
- **A download link that won't go stale**: [openlayer-latest.ccx](https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx)
  always points at the current release, so I don't have to keep re-editing this link every version.
- **README rewrite** — 781 lines down to about 150 visible, with a gallery and collapsible sections
  instead of one long scroll.

## Still true, every release

This is alpha software. It's stable enough to work with and I try to be specific about where it
stops — see [known limitations](../known-limitations.md). Windows is what's actually been tested.
**macOS has never been confirmed by anyone** — if you're on a Mac and willing to spend ten minutes
installing it, that report is worth more to this project than almost anything else right now.

Free, MIT-licensed, runs entirely on your own ComfyUI server — nothing generated ever leaves your
machine. [Download](https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx) ·
[Repo](https://github.com/MehranMarxian/OpenLayer) · [Wiki](https://github.com/MehranMarxian/OpenLayer/wiki)

Bug reports and "this didn't do what I expected" reports land harder than stars — always have.
```

---

### Notes for Mehran

- Image paths above assume Discussions renders relative repo paths — GitHub Discussions actually
  needs uploaded/attached images or absolute `raw.githubusercontent.com` / `user-attachments` URLs,
  not relative markdown paths like the release notes can get away with. **Before posting, either
  drag-and-drop the four `.webp` files into the GitHub comment editor (recommended — this generates
  the correct `user-attachments` URLs the same way discussion #88's screenshots did) or swap in
  absolute `raw.githubusercontent.com/MehranMarxian/OpenLayer/main/docs/assets/v0200/...` URLs.**
  I left the relative paths in this draft only as placeholders for content, not as final markup.
- The `docs/unflatten-gate-findings.md` reference should probably become a link once this is posted
  from a browser (`https://github.com/MehranMarxian/OpenLayer/blob/main/docs/unflatten-gate-findings.md`).
