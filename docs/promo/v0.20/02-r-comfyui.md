# Draft — r/comfyui

**Destination:** https://reddit.com/r/comfyui (new post)
**Account:** Mehran's existing Reddit account — the same one that posted the v0.12.0-alpha thread
(`1v8c1hc`, ~2026-08-05). Confirm the exact username before posting; I don't have it recorded.
**Format:** self-text post with one embedded image (`unflatten.webp`), first-person.
**Rule check:** could not verify live — reddit.com is blocked to my tools. Mehran should open the
r/comfyui sidebar/rules wiki himself before posting. General precedent: this subreddit has
historically been receptive to personal open-source tool posts that lead with a real screenshot and
disclose authorship, which this draft does.
**Not burned:** one prior post, ~4 weeks before this one, different release. Reasonable gap.

---

## Title

```
Photoshop plugin for ComfyUI, open source — new release can split a flat image back into layers with real transparency
```

## Body

```markdown
I've been building a free, open-source Photoshop plugin (UXP panel) that talks to a local ComfyUI
server — text to image, img2img, sketch to image, inpaint, outpaint, upscale, live painting, all of
it runs on your own GPU and comes back as an editable Photoshop layer instead of a flat PNG you have
to cut apart yourself.

Posted here before (v0.12) and got useful feedback — this is the actual follow-up.

New in v0.20: **Unflatten.** Give it one flat layer, get back several real Photoshop layers with
alpha, in stacking order, inside one group. As far as I can tell nothing else puts a decomposed layer
stack into a host app this way.

[image: unflatten.webp — Layer 2 (front) with its alpha mask, above Layer 1 (back)]

Honest limits, up front:
- It needs a subject standing clear of a background. A close-up filling the frame comes back
  unchanged — there's no front/back to find. I can't detect this in the panel and warn you (deciding
  needs the alpha channel, and UXP can't decode a PNG), so it's just stated plainly instead.
- The layer count you ask for is a ceiling — empty plates get dropped, not imported blank.
- It's built entirely from core ComfyUI nodes, no custom node package required for this one.

Also since I last posted here: Multi-Reference composition (compose a scene from several reference
layers with FLUX.2 Klein — it does **not** preserve a specific person's face, tested against real
photos and it's honest about that everywhere), Style Reference, a proper dark theme, and a Prompt
Wallet.

This is alpha software — works, but rough in named places. Windows is what's actually tested; **I
have zero confirmed macOS reports**, so if anyone here is on a Mac and has ten minutes, that's the
single most useful thing you could tell me right now.

Free, MIT, runs 100% locally — nothing leaves your machine.

Repo: https://github.com/MehranMarxian/OpenLayer
Download: https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx
(one-click .ccx if you have Creative Cloud; manual UXP install also documented)

Happy to answer anything about the ComfyUI side — it's plain HTTP + websocket to `/prompt` and
`/history`, no custom protocol.
```

---

### Notes for Mehran

- Reply to any comments in your own voice — don't let this sit unanswered the way the v0.13 video
  post did (0 comments, but that was a different venue with less traffic).
- If u/Far_Estimate7276 (the v0.12 commenter) is still active, this is a natural place to loop back
  — but only if you actually want to reference that thread; I'm not drafting an unsolicited DM.
- Keep the image as `unflatten.webp` if Reddit's uploader accepts WebP; have a PNG export ready as a
  fallback (I could not verify Reddit's current format support against their own docs — reddit.com
  is blocked to me).
