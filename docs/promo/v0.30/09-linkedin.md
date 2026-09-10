# LinkedIn — OpenLayer v0.30.0-alpha follow-up

**Status: draft only. Nothing posted.** This is the one external venue with an actual track record —
the v0.25 launch post went out 2026-09-09 (see `docs/promo/v0.25/09-linkedin.md` and git commit
`70045a0`). Not re-auditing the whole profile this cycle since that work is done; this file is just
the next post.

---

## Post

```
Photoshop still can't generate a normal map or trace real line art from a photo. It's been able to
fake a depth pass for years (Neural Filters → Depth Blur has a quiet "output depth map only" option —
I said otherwise in my last changelog and I was wrong), but that one runs partly in Adobe's cloud and
gives you exactly one model with no say in the matter.

The new tool in today's OpenLayer release, Layer Maps, does all three — depth, line art, and a
surface-normal pass — off any layer, entirely on your own GPU, in a few seconds, sized exactly
to the layer it came from so it drops straight back over the original.

[video: capture a layer → pick a map type → generate → import, all three, same photo]

No prompt, no seed, no checkpoint — it's the same ControlNet preprocessing this project has used since
v0.13 to steer generation, just handed to you as the actual output for once.

Also new: a small amber dot beside every prompt field that expands a short draft into a longer one
locally (SuperPrompt-v1, 308MB, no seed — same input always expands the same way, Ctrl+Z undoes it).

Still alpha, still free, still MIT, still nothing leaving your machine.

github.com/MehranMarxian/OpenLayer

#ComfyUI #Photoshop #OpenSource
```

---

### Notes for Mehran

- Leads with the correction, not the feature — matches the honesty framing that's worked in prior
  release notes, and it's a stronger hook than "new tool shipped" on a profile with no existing
  audience for tool announcements.
- Attach the video if LinkedIn's upload handles the aspect ratio cleanly; fall back to 2–3 of the map
  stills from `layer-maps-demo-photo.md` if not.
- No adoption numbers, no "production-ready" language — same rules as the v0.25 file's "What not to
  claim" section, unchanged.
