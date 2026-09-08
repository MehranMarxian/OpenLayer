# Draft — r/StableDiffusion

**Destination:** https://reddit.com/r/StableDiffusion (new post)
**Account:** Mehran's Reddit account. No prior post to this subreddit found in memory/records — a
fresh venue, not burned.
**Format:** self-text post, same image as r/comfyui, trimmed copy — this audience has seen more
tool launches and skims faster.
**Rule check:** could not verify live — reddit.com is blocked to my tools. This subreddit has a
reputation for being stricter about tool/plugin posts reading as low-effort promotion than r/comfyui;
Mehran should read the sidebar and any pinned self-promo megathread before posting, and consider
whether a top-level post or a comment in an existing megathread is the expected format right now.
**Timing:** 2–3 days after r/comfyui, so any wording problems or bugs get caught first.

---

## Title

```
Open-source Photoshop plugin for local Stable Diffusion / Flux — new feature splits a flat image into real layered Photoshop layers
```

## Body

```markdown
Free, open-source Photoshop plugin (UXP panel) connecting to your own local ComfyUI server —
Stable Diffusion, SDXL, Flux, FLUX.2 Klein. Text to image, img2img, sketch to image, inpaint,
outpaint, upscale, live painting. Results come back as real, editable Photoshop layers.

The new thing in v0.20 — **Unflatten**: give it a flat layer, it comes back as separate layers with
real transparency, in stacking order, inside one group. Core ComfyUI nodes only, no custom node
package.

[image: unflatten.webp]

Two limits I'd rather state than have you discover the hard way:
- It needs a subject standing clear of its background — a close-up filling the frame comes back
  unchanged, and the panel can't detect that case and warn you (needs the alpha channel; UXP can't
  decode a PNG).
- The layer count is a ceiling. Empty results get dropped rather than imported blank.

Also shipped recently and never posted anywhere: Multi-Reference composition (compose from several
reference layers with FLUX.2 Klein — does not preserve a specific person's likeness, tested and
stated honestly), Style Reference, a dark theme, sliders, a Prompt Wallet.

Alpha software, Windows-tested, **macOS unverified by anyone so far** — genuinely looking for someone
willing to try it on a Mac and report back either way.

MIT licensed, 100% local, no telemetry, no account.

Repo: https://github.com/MehranMarxian/OpenLayer
Download: https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx
```

---

### Notes for Mehran

- If the subreddit rules turn out to require a Sunday/weekly self-promo thread or a specific flair
  (e.g. "Resource" or "Workflow Included"), this same text drops into that format — just don't
  post it as a standalone thread if the rules say otherwise.
- Don't post this the same day as r/comfyui — the plan holds a 2–3 day gap on purpose.
