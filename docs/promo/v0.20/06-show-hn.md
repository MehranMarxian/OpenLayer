# Draft — Show HN

**Destination:** https://news.ycombinator.com/submit
**Account:** Mehran's HN account (create/confirm he has one — account creation is his to do, not
mine).
**Guidelines, confirmed directly from `news.ycombinator.com/showhn.html`:** must be something you
made yourself and are around to discuss; early-stage work is fine; make it easy to try without
signup barriers where possible; title must literally start with "Show HN"; don't ask friends to
upvote or comment.
**This is a one-shot.** A given title/URL can only be submitted to Show HN once — don't post this
until the copy and the linked README are in the state Mehran wants them to stay in, because there's
no redo.
**Timing:** after r/comfyui and ideally r/StableDiffusion, so any embarrassing bug or wording problem
surfaces in a lower-stakes venue first.

---

## Title

```
Show HN: OpenLayer – an open-source Photoshop plugin for local ComfyUI (no cloud, MIT)
```

## URL

```
https://github.com/MehranMarxian/OpenLayer
```

## First comment (post immediately after submitting, as the OP)

```markdown
Hi HN, I'm the author. OpenLayer is a Photoshop UXP panel that talks to a ComfyUI server running on
your own machine — text to image, image to image, inpaint, outpaint, sketch to image, upscale, live
painting, and (new in v0.20) Unflatten, which splits one flat layer into several real Photoshop
layers with alpha, in stacking order.

How it works, mechanically: the panel is a UXP extension (Photoshop's newer JS plugin platform) that
does plain HTTP + WebSocket to ComfyUI's own `/prompt`, `/history`, and `/view` endpoints, and the
progress websocket for live status. No custom protocol, no relay server, nothing routed through
anything I run — your machine talks directly to your own ComfyUI instance. `network.domains` in the
manifest is broad because the ComfyUI host/port is user-configured, not because it phones home
anywhere; there's a written justification for that in the repo if you're curious how UXP's permission
model handles that.

Everything here is MIT-licensed. There's no telemetry, no account, and the privacy policy is short
because there's nothing to collect.

Honest state: it's alpha. It works and I use it, but there are named rough edges — see
`docs/known-limitations.md` in the repo rather than take my word for it. Two limits worth stating up
front since they'll be the first thing anyone tests: Unflatten needs a subject clearly in front of a
background (a tight close-up comes back unchanged), and a separate feature, Multi-Reference
composition, does not preserve a specific person's face — it composes a scene, not an identity.

To actually try it you need Photoshop 2024+ and a locally running ComfyUI server with a GPU
(8 GB VRAM minimum, this targets 12 GB) — that's a real barrier compared to a hosted SaaS, and I'd
rather say that here than have someone hit it as a surprise. One-click installer if you have Creative
Cloud: https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx

Windows is what's actually been tested end to end. I have zero confirmed reports from macOS — if
anyone here runs Photoshop on a Mac and has ten minutes, that's the most useful thing you could tell
me today, good or bad.
```

---

### Notes for Mehran

- Budget real time to answer comments the day this goes up — HN comment sections reward the author
  actually being present, and going quiet after posting reads worse than not posting at all.
- If the front page happens, GitHub traffic and star count can spike hard and fast; that's fine, but
  don't treat a stars spike as the win condition — per the project's own history, activation (real
  testers, real reports) is what's been missing, not reach.
- Don't submit this the same day as a Reddit post if you want to keep the two threads' comment
  sections independent — but there's no hard rule against proximity here the way there is for reddit
  cross-posting; use judgment.
