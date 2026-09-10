# Draft — r/photoshop

**Destination:** https://reddit.com/r/photoshop (new post)
**Account:** Mehran's Reddit account. No confirmed prior post to this subreddit, any cycle.
**Format:** self-text, framed around what Photoshop can and can't actually do — this audience will
know Depth Blur exists, so the honesty about that (rather than an overclaim) is the actual credibility
play here, more than in any other venue.
**Rule check:** unverified live — reddit.com blocked to my tools. Disclose authorship in the first
line; this community tends to remove posts that read as a bare ad.
**Timing:** its own schedule, after the ComfyUI-cluster posts if those go out, so any wording issues
get caught in a more forgiving venue first.

---

## Title

```
I corrected a claim in my Photoshop plugin's changelog: Depth Blur CAN export a depth map. It still can't do normal maps or real line art, though — so I built those
```

## Body

```markdown
I'm the developer — up front about that.

Small correction first, because I got this wrong in my own release notes: **Photoshop's Neural
Filters → Depth Blur has an "Output depth map only" option.** I'd written that Photoshop has no native
depth export at all, and that's false — I checked, and it's been there since the filter shipped. What
I got right: it only does depth (no normal maps, no line art), it needs internet because part of the
processing runs in Adobe's cloud (that's in Adobe's own FAQ, not a guess), and it's one fixed
portrait-bokeh model with no choice of estimator or resolution.

I build a free, open-source Photoshop plugin (OpenLayer) that talks to a ComfyUI server on your own
machine — no cloud, no subscription. The newest tool, **Layer Maps**, reads a depth, line-art, or
normal pass off any layer and hands it back as a new layer at the source's exact pixel size, so it
sits straight over the original. All three, locally, in a few seconds each, no internet
required, no per-filter model lock-in.

[video or stills: a photo, then all three maps generated over it]

**Where Photoshop is still ahead of anything I've built:** Depth Blur is one click and it's already in
the app you have open — no second piece of software, no GPU requirement of its own. If you only need
depth, and only for a portrait-style blur, Depth Blur is genuinely the easier path for most people.
Layer Maps is for when you want the pass itself (for relighting, displacement, compositing) rather
than a baked blur effect, or when you want line art or a normal map, which Photoshop can't produce at
all.

**The real cost, stated plainly:** this isn't a one-click Creative Cloud install like Depth Blur. You
need to separately run ComfyUI (free, open source) and have a GPU — these three tools specifically are
light (no checkpoint, no sampler), but the rest of the plugin (generation, inpainting) needs 8GB+
VRAM. If a second piece of software running alongside Photoshop is more than you want, this isn't for
you yet.

Alpha software — I try to be specific about what's rough rather than oversell it. Windows 11 +
Photoshop 2025 is what's actually verified.

**Two things I genuinely don't know, any answer helps:**

1. Does the one-click `.ccx` installer work on a machine that's never had this before?
2. Does any of this run on macOS? Zero confirmed reports either way.

Free, MIT-licensed, open source: https://github.com/MehranMarxian/OpenLayer
One-click install (needs Creative Cloud): https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx

Happy to answer anything about setup or what it can/can't do.
```

---

### Notes for Mehran

- The lead — correcting your own mistake in public — is unusual for a launch post and that's the
  point: this audience has seen enough Reddit tool posts overclaim that "I checked and I was wrong
  about X" reads as more credible than any feature list would.
- Expect "does this need a ComfyUI subscription/account" as the top question — one-line answer ready:
  no, ComfyUI and the base models here are free; some other presets in the plugin need larger
  downloads, documented in the wiki.
- If the subreddit disallows plugin/tool posts outright, hold rather than push through.
- Needs the same video/stills asset as the other drafts.
