# Draft — Show HN

**Destination:** https://news.ycombinator.com/submit

> ### ⚠️ This is a RESUBMISSION, not a first attempt. Verified 2026-09-09.
>
> **"Show HN: OpenLayer – local Photoshop plugin for ComfyUI (inpaint/outpaint demo)"** was
> submitted **2026-08-28 by `HMUSER`** — https://news.ycombinator.com/item?id=49480266 — and got
> **7 points and 0 comments**. Found in the HN Algolia index; it accounts for the 58 referrer hits
> that looked unexplained.
>
> **What that changes:**
>
> - **The same URL cannot simply be posted again.** HN de-duplicates repeat submissions of a URL,
>   and eleven days is well inside the window where a repost is folded into the original rather
>   than treated as new.
> - **7 points and no comments is a near-miss, not a rejection.** It was seen and did not catch.
>   HN's own guidance is that a resubmission is fine once a project has *materially changed* — and
>   v0.25.0 genuinely has: a new tool that did not exist on 28 August, and a working demo claim
>   that is checkable rather than descriptive.
> - **So the resubmission has to be honest about being one.** Lead with what is new since, and
>   submit the **release page**, not the bare repo root, so it is a different URL pointing at
>   different content:
>   `https://github.com/MehranMarxian/OpenLayer/releases/tag/v0.25.0-alpha`
> - **Wait longer than you want to.** Eleven days after a 7-point Show HN is too soon. Several
>   weeks, or once there is a second substantial release, is the honest interval.
>
> **My recommendation: do not send this one in this cycle.** Send the Reddit and Discord posts,
> gather the two answers we actually need, and come back to HN when there is something to say that
> is not "same project, eleven days later." Mehran overrides this if he disagrees — but the draft
> below assumes it will be held.

**Guidelines, reconfirmed today from `news.ycombinator.com/showhn.html`:** must be something you made
and are around to discuss; must be try-able, ideally without a signup barrier; don't ask for votes or
comments; early-stage work is fine but minor version bumps alone don't qualify — a new tool with a
concrete, checkable claim does.
**Timing:** hold. See the box above.

---

## Title

```
Show HN: OpenLayer – a Photoshop plugin for local ComfyUI; new tool proves it doesn't touch your pixels
```

## URL

```
https://github.com/MehranMarxian/OpenLayer
```

## First comment (post immediately after submitting, as the OP)

```markdown
Hi HN, I'm the author. OpenLayer is a Photoshop UXP panel that talks to a ComfyUI server running on
your own machine — text to image, image to image, inpaint, outpaint, sketch to image, upscale, live
painting.

The reason for posting now: the newest tool, Remove Background, is the first one in this project with
no diffusion in the graph at all — no prompt, no seed, no checkpoint, just ComfyUI's own
`comfy_extras.nodes_bg_removal` node running BiRefNet (444 MB, MIT). ~2.2s on a 4070 Ti. The part I
think is actually interesting: it composites BiRefNet's matte onto your captured image instead of
re-rendering it, and I measured a mean absolute difference of 0.0 against the source at full
resolution before shipping it — the RGB you get back is provably your own pixels with an alpha
channel added, nothing else touched. That's a claim you can check yourself with any diff tool; most
"AI cutout" products online give you no way to verify that, because you never had the source and
result as separate local files to begin with.

Mechanically: the panel is a UXP extension (Photoshop's plugin platform) doing plain HTTP + WebSocket
to ComfyUI's own `/prompt`, `/history`, and `/view` endpoints, plus a progress socket. No relay
server, nothing routed through anything I run — your machine talks directly to your own ComfyUI
instance. `network.domains` in the manifest is broad because the ComfyUI host/port is user-
configured, not because it phones home anywhere; there's a written justification for that in the repo.

MIT-licensed. No telemetry, no account.

Honest state: it's alpha. Four tools carry a real caveat — see `docs/known-limitations.md` rather
than take my word for it. Worth stating up front since it'll be the first thing anyone tests:
Multi-Reference composition does not preserve a specific person's face (it composes a scene, not an
identity), and a separate tool, Unflatten, needs a subject clearly separated from its background — a
tight close-up comes back unchanged, and as of this release the panel actually tells you when that
happens instead of reporting it as a success.

To try it you need Photoshop 2024+ and a locally running ComfyUI server; a GPU with 8 GB VRAM or more
for the image-generation tools, though Remove Background itself is much lighter than that. One-click
installer if you have Creative Cloud:
https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx

Two things I genuinely don't know and would like to: does the one-click .ccx installer work on a
machine that's never had this on it, and does any of this run on macOS at all? Zero confirmed reports
either way on both — if you try it and hit either question, a one-line reply here is enough.
```

---

### Notes for Mehran

- **Resolve the referrer anomaly first.** If `news.ycombinator.com` traffic came from a Show HN post
  that was actually submitted (under this title or another), this exact title is a duplicate
  submission risk and the draft needs to change or the slot is already spent.
- Budget real time to answer comments the day this goes up.
- If the front page happens, treat it as reach, not the win condition — per the project's history,
  activation (real testers, real reports) is what's been missing, not stars.
