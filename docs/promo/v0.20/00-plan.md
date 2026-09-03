# v0.20.0-alpha promotion plan — staged, nothing published

Status: **draft only**. Nothing in this folder has been posted, commented, or edited anywhere.
Every action below needs Mehran's explicit go-ahead, per venue, at posting time.

## The one message

**Unflatten puts a decomposed layer stack into Photoshop — hand it one flat layer, get back
several real layers with alpha, in stacking order.** Nothing else in the ComfyUI-to-host-app space
does that; every other tool in this category returns a flattened image. That is the hook.

The honest second half of the sentence, stated every time: it needs a subject standing clear of
its background (a close-up that fills the frame comes back unchanged), and it is alpha software.
Multi-Reference (v0.19), also newly un-announced, gets its own honest line whenever it's mentioned:
it composes a scene, it does not preserve a specific person's face.

## Why this is also a catch-up post

Last announced in GitHub Discussions: v0.15.0 (2026-08-17) and a video-only post (2026-08-28).
**v0.16.0, v0.18.0, v0.19.0, and v0.20.0 shipped with zero announcement anywhere.** That's the
Artist-Friendly Dark theme + sliders + seed dice, the Prompt Wallet, Style Reference, Multi-Reference
composition, and now Unflatten — four releases of real news sitting unread. The GitHub Discussions
post (venue 1) is written as a proper catch-up so nobody arriving from Reddit or HN lands on a page
that only talks about the newest feature and looks thin. The Reddit/HN posts stay narrow and lead
with Unflatten alone — a catch-up list reads as "look how much I did," which is the wrong note to
open on in a community post; it reads fine as "here's what's changed since I last showed up" in a
GitHub Discussion where the reader chose to be there.

## What changed since the last promo pass

- **The screenshot blocker is gone.** `docs/assets/v0200/*.webp` has real, cropped, committed shots:
  `unflatten.webp` (the actual proof — Layer 2 front + alpha mask over Layer 1 back), plus
  `live-painting.webp`, `sketch-to-image.webp`, `multi-reference.webp`, `outpaint.webp`,
  `sketch-abstract.webp`, `dashboard-artist-dark-crop.webp`.
- Two YouTube videos exist and are usable, **with one caveat that must travel with them every time
  they're linked**: both were recorded from an earlier alpha build (this is already how the README
  and landing page caption them — keep that phrasing, don't imply they show v0.20 specifically).
- A GitHub wiki now exists: Home (encyclopedia-style overview), Choosing a Model, Hardware and
  Performance, FAQ — worth linking as the "read more" destination instead of dumping everything
  into a Reddit post.
- A URL that never goes stale:
  `https://github.com/MehranMarxian/OpenLayer/releases/latest/download/openlayer-latest.ccx` — use
  this in every new post instead of a version-pinned release link, so it never needs editing again.

## Venue plan, in order

| # | Venue | Why this audience | Self-promo rule (source) | Format | Timing | Realistic outcome |
|---|---|---|---|---|---|---|
| 1 | **GitHub Discussions → Announcements** | Home base. Every other post links here, not to a subreddit thread that can be deleted or locked. | None — it's Mehran's own repo. | Long-form catch-up post, images embedded, links to wiki + `.ccx` | First, day 0 | Low traffic on its own; it's the anchor URL for everything else |
| 2 | **r/comfyui** | Highest-intent audience: already runs ComfyUI, already has the GPU. Already produced OpenLayer's only real outside tester (u/Far_Estimate7276, v0.12 thread `1v8c1hc`). One post there ~4 weeks ago (v0.12) — not burned, reasonable gap. | Could not verify live — **reddit.com is blocked to both my WebFetch and browser tools**, so the sidebar/wiki rules below are general knowledge, not a fresh read. Mehran should open the sidebar himself before posting; r/comfyui has historically welcomed personal-project link/text posts with a working screenshot, not just a link. | Self-text post, `unflatten.webp` embedded (or `dashboard-artist-dark-crop.webp` as the hook image, unflatten as the follow-up in-thread), first-person, caveats up front | Day 0–1, right after the GitHub post exists to link to | A handful of comments; maybe one real tester, based on the v0.12 precedent |
| 3 | **ComfyUI Discord (`discord.com/invite/comfyorg`)** | Official Comfy Org server — same intent audience as r/comfyui, different format. | **Unverified** — I have no account and cannot read a gated `#rules` channel. Mehran needs to check the channel list and posting norms himself before this goes out. | Two sentences + one image (`unflatten.webp`), likely a `#showcase`-style channel — confirm exact channel name live | Day 1–2 | Low-effort, low-risk; a few reactions at most |
| 4 | **r/StableDiffusion** | Bigger, broader SD/Flux audience; some overlap with r/comfyui but not total. Never posted here before per available records — fresh venue. | **Unverified** — same reddit.com access block as above. This subreddit is generally stricter about tool/plugin posts reading as spam than r/comfyui; Mehran should read the sidebar rules and any pinned "self-promo" thread before posting. | Self-text, same core content as r/comfyui but trimmed — this audience has seen more tool launches, lead harder with the one novel claim (decomposed layers in a host app) | Day 3–4 (after r/comfyui has had time to surface any embarrassing bug) | Wider reach, likely lower engagement quality than r/comfyui |
| 5 | **r/photoshop** | Firefly-alternative audience: lower technical tolerance, cares about "free, private, no credits," not about ComfyUI internals. Never posted here before. | **Unverified**, same block. Historically this subreddit tolerates a clearly-labeled "I built this" post more than a bare ad; disclose authorship in the first line. | Self-text, leads with the free/local/no-subscription angle, states plainly that a local ComfyUI install is a real prerequisite (the install cost this audience needs to know before clicking) | Day 5–7, spaced out from the ComfyUI-cluster posts so it doesn't read as a blitz | Curiosity clicks; possibly a few "does this need X GPU" questions worth answering honestly |
| 6 | **Show HN** | Open-source/local-first/privacy audience; the MIT licence and "no cloud calls" story is the strongest fit anywhere. | Confirmed directly from `news.ycombinator.com/showhn.html`: must be something you made, must be try-able, early-stage work is fine, don't ask for votes. **One-shot — a title can only be submitted once, ever.** | Show HN self-post + a technical top-level comment explaining the architecture (UXP panel ↔ local ComfyUI over HTTP/WS, MIT, no telemetry) | Day 5–8, after r/comfyui feedback has had a chance to surface anything embarrassing — don't burn the one shot on an unpatched bug report | Unpredictable; could be silence, could be the front page. Budget a day where Mehran can actually answer comments live — HN rewards presence |
| 7 | **Awesome-lists** | `lucianosb/awesome-comfyui` does **not** list OpenLayer yet (checked directly — confirmed absent). `light-and-ray/awesome-alternative-uis-for-comfyui` **already lists it** (checked directly — confirmed present, links to the repo). | Standard GitHub PR etiquette on someone else's repo — one clean entry, their format, no self-hype. | A PR adding one line/entry, in their existing format | Anytime, no rush, asynchronous | Small, permanent, evergreen — worth doing but low-drama |
| 8 | **Adobe Exchange / UXP marketplace** | Distribution channel, not just an ad — see "Anything else" below. | N/A (submission portal, not a community) | — | Not this cycle | Real blocker remains: manifest `id` must come from Adobe's Developer Distribution portal, which requires Mehran to create a publisher profile (account creation — his to do, not mine) |
| — | **Product Hunt** | Considered and **not recommended this cycle** — see reasoning below | — | — | — | — |
| — | **Civitai article** | Considered, lower priority — see reasoning below | — | — | — | — |

### Sequencing logic

1. GitHub Discussions post goes up first — it's the URL every other post links to ("full notes and
   the wiki are here").
2. r/comfyui next, same day or the next — it's the venue with a proven track record of producing a
   real human, and it's the community most likely to catch anything wrong with the Unflatten
   description before it goes wider.
3. ComfyUI Discord can go out alongside r/comfyui — different format, same audience, negligible
   risk of looking repetitive since it's a different platform.
4. r/StableDiffusion 2–3 days later, so a good r/comfyui day isn't diluted and any early feedback
   (bug reports, wording problems) gets fixed first.
5. r/photoshop on its own timeline, several days out — different audience, different message, no
   need to cluster it with the ComfyUI-side posts.
6. Show HN last among the "hot" venues, once the copy has survived contact with at least one
   technical community — it's the one submission that can't be redone.
7. Awesome-list PR and Adobe Exchange are not time-sensitive; do them whenever, they don't compete
   with anything above.

### What I'd measure

- GitHub stars/forks/watchers (baseline: 12/4/1, confirmed live today).
- `.ccx` download count via `releases/latest/download/openlayer-latest.ccx` — this is now trackable
  release-asset-wide instead of per-tag, which is a real improvement for measuring interest over
  time.
- New GitHub Issues/Discussions opened, and specifically whether anyone reports back on macOS or on
  the `.ccx` one-click install — both are open asks with zero real answers so far.
- Per the project's own history ([[openlayer-post-v0.9-activation]], [[openlayer-reddit-first-traction]]
  in memory), **reach has never been the bottleneck — activation has.** A campaign that adds stars
  but produces no testers repeats the exact failure mode already seen once. Watch for actual
  installs/reports, not upvotes.

### What I could not verify

- **Live subreddit rules for r/comfyui, r/StableDiffusion, r/photoshop.** `reddit.com` is blocked to
  both my WebFetch and browser tools in this environment — every attempt failed outright. Mehran has
  a working Reddit account and posted there before; he should open each sidebar/rules wiki himself
  immediately before posting, not rely on this document.
- **ComfyUI Discord's actual channel structure and posting rules.** I have no Discord account and
  cannot read a gated `#rules` channel from the outside.
- Whether Mehran ever sent the reply drafted for u/Far_Estimate7276 (per
  [[openlayer-reddit-first-traction]], a reply about the Flux.2 GGUF fix was supposed to go out
  before the video finished). If not, that's a small honest follow-up worth doing before a second
  r/comfyui post lands in the same thread's shadow — worth asking Mehran directly rather than
  guessing.
- Reddit's current upload format support (WebP vs. requiring PNG/JPG) — search results say WebP is
  accepted, but I could not confirm against Reddit's own help pages since reddit.com is blocked. Keep
  a PNG export of `unflatten.webp` on hand as a fallback in case the upload fails.
