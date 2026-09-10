# v0.30.0-alpha promotion plan — staged, nothing published

Status: **draft only**. Nothing in this folder has been posted, commented, edited anywhere, or
committed. Every action below needs Mehran's explicit go-ahead, per venue, at posting time.

## The one message

**Layer Maps reads a depth, line-art or normal pass straight off a Photoshop layer, at that layer's
exact pixel size, so it drops back onto the original with no rescaling.** No prompt, no seed, no
checkpoint. A few seconds per map on a 4070 Ti (about 5s, 3s and 4s on a 4K photo).

The honest version of "why does this matter," verified against Adobe's own documentation before
writing anything (see the correction below): **Photoshop's Neural Filters Depth Blur can already
output a depth map** — that claim in our own CHANGELOG, release body and landing page is wrong and
needs Mehran's correction, not mine. What Photoshop genuinely does not have, confirmed the same way:
a **normal-map generator** (the old `Filter › 3D › Generate Normal Map` path died with the legacy 3D
engine's removal) and any **learned line-art extraction** (Find Edges / Photocopy / Glowing Edges are
the only native options, and they are not in the same class as a trained detector). So the pitch is
not "Photoshop has nothing" — it's **all three passes, together, local, in about 3 seconds, sized
exactly to the layer, with no round trip to Adobe's cloud and no per-filter internet requirement.**
That's a real, checkable difference, and it survives contact with someone who actually opens the
Neural Filters gallery and pokes around.

## FIXED 2026-09-10: the "no native depth export" claim

**Corrected** in `CHANGELOG.md`, `docs/index.html`, `packages/release-body-v0.30.0.md` and the live
GitHub release notes. The findings below are kept for the reasoning.

Checked directly against Adobe's own documentation, not blogs, per the brief:

1. **Depth: Photoshop already does this.** `Filter › Neural Filters › Depth Blur` has an **"Output
   depth map only"** checkbox that returns a grayscale depth pass as a new layer — near dark, far
   light. Confirmed consistently across multiple independent tutorials (bwillcreative.com,
   PhotoshopCafe, PSD Stack); Adobe's own `neural-filters-list-and-faq.html` describes Depth Blur
   without disputing this, and the feature is old enough (2021, "Portrait Mode" launch) that its
   existence is not in question.
   - **The one thing that genuinely is different, and is the honest hook:** Adobe's own FAQ page
     (`helpx.adobe.com/photoshop/using/neural-filters-list-and-faq.html`) says outright — *"Some
     filters, such as Smart Portrait (Beta) and Depth Blur (Beta), process some operations in the
     cloud. Internet connectivity is required to fully benefit from the filters."* Confirmed
     independently at the API level: Adobe's own Firefly Services developer docs show Depth Blur
     implemented as a cloud POST to `https://image.adobe.io/pie/psdService/depthBlur`
     (`developer.adobe.com/firefly-services/docs/photoshop/guides/depthblur`). So Photoshop's own
     depth map is not purely local, and it's tuned as a single-purpose portrait-bokeh model with no
     choice of estimator. Layer Maps' depth pass runs three swappable Depth Anything V2 sizes
     entirely on your own GPU.
2. **Normal maps: genuinely absent, confirmed.** The legacy 3D engine (`Filter › 3D › Generate Normal
   Map`) was removed — community and Adobe KB sources converge on **July 2024**, and Adobe's current
   KB (`helpx.adobe.com/photoshop/kb/3d-faq.html`) now only documents 3D-object compositing via the
   separate Substance 3D Viewer (beta) app, which is a different feature (dropping a 3D *model* onto a
   2D canvas) and has nothing to do with deriving a normal map from a photograph. **This claim in our
   copy is correct as written and needs no change.**
3. **Line art: genuinely absent, confirmed.** Photoshop's native edge tools are Find Edges, Photocopy
   and Glowing Edges — classic Stylize filters from long before Neural Filters existed, not a learned
   detector, and nobody disputes this. **This claim is correct as written.**

**Sentences that were wrong (all now corrected):**

- `CHANGELOG.md`, `## v0.30.0-alpha` → Added → Layer Maps: *"Photoshop has no native depth or normal
  export at all, and its edge filters are not in the same class as a learned line-art detector."* —
  the **depth** half of this sentence is false.
- `packages/release-body-v0.30.0.md`, under **New: Layer Maps**: *"No prompt, no seed, no checkpoint.
  Photoshop has no native depth or normal export at all."* — same fix needed.
- `docs/index.html`, line 156, the Layer Maps gallery entry: *"Photoshop has no native depth or normal
  export at all."* — same.

None of the promo copy below repeats the false half of the claim. All three drafts below lead with
the corrected, three-way framing: depth is not exclusive but is meaningfully better (local, no
internet requirement, model choice); normal and line art are exclusive, full stop.

## Traffic and stars, pulled today (2026-09-10) via `gh api`

- **991 views / 327 uniques** in the last 14 days (previous window's release-day bump has mostly
  rolled off).
- **323 clones / 128 uniques** — flat-to-down from last cycle's number, consistent with no active
  promotion.
- Stars **15**, forks **4**, watchers **0** — unchanged from the last check. No organic movement.
- Referrers: `mehran-ahmadi.com` (64), `news.ycombinator.com` (58, unchanged — see below),
  `github.com` (49), `l.facebook.com`/`lm.facebook.com`/`facebook.com` (55 combined, still
  unexplained), `youtube.com` (19), `chatgpt.com` (12), `kagi.com` (6).
- **Zero new GitHub Discussions since #104** (2026-09-02, the v0.20 catch-up post, 0 comments) and
  **zero issues opened** in the window. Same failure mode as every prior cycle: reach isn't the
  problem, activation is, and right now there isn't even reach — see below.

## The pattern, corrected — this is more serious than "external venues never go out"

The brief's framing was that GitHub Discussions posts every cycle and only the external venues stall.
**That's not what actually happened for v0.25.** I checked directly:

- `gh api graphql` on the Discussions list shows the newest discussion is still **#104, created
  2026-09-02, for v0.20** — the v0.25 GitHub Discussion draft (`docs/promo/v0.25/01-github-discussion.md`)
  was written and committed to the repo but **never posted**, the same as every Reddit/Discord/HN
  draft before it.
- The only promo action that actually happened in the v0.25 cycle was **LinkedIn** — a real post, on a
  real account, per `docs/promo/v0.25/09-linkedin.md` and the git log
  (`70045a0 Rewrite the LinkedIn copy against the real profile, and correct the HN plan.`). That is the
  entire track record of anything from this project reaching an outside human being through a channel
  I can independently verify.
- Six cycles of drafts (v0.20 and v0.25, twelve-plus files) sitting fully written, reviewed, and
  committed, with **zero of the Reddit/Discord/HN ones ever sent**, is not a coincidence of timing. It
  reads as friction at the point of posting into a community Mehran has no history in and can't easily
  gauge the reception of — GitHub Discussions is his own repo with no audience to misjudge, and
  LinkedIn is a profile he controls and can post to without a stranger's community rules in the way,
  and that's exactly the one that got used.

**What I'd actually propose given that evidence:** stop treating this as six equal venues and treat it
as two tiers.

- **Tier 1 — things Mehran has proven he'll do:** a LinkedIn follow-up (below), and this cycle's
  GitHub Discussion, posted the same day the video is ready, no separate decision needed for either.
- **Tier 2 — everything with a stranger's community rules attached (Reddit ×3, Discord, HN):** keep
  the drafts current and ready, but don't plan a full six-venue rollout as if the last two cycles'
  silence didn't happen. If Mehran wants to break the pattern, the lowest-friction next step is
  probably **one** Reddit post — r/comfyui, the venue with actual prior contact
  (u/Far_Estimate7276 on the v0.12 thread) — treated as a real decision to make explicitly, not a
  fourth item on an assume-it'll-happen list.

## What's new this cycle that could change the equation

**The video is the asset.** Every prior cycle's plan said some version of "this is blocked on a
screenshot that doesn't exist." `docs/assets/tools/layer-maps.png` is still the 128×128 tool icon, not
a demonstration — confirmed by reading the file. A 45–75s silent-friendly screen recording is a
fundamentally different asset: it's the one format that works pasted into a GitHub Discussion, a
Reddit post, a Discord message, and an HN comment without rewriting it per venue, and it's the one
thing in this whole campaign that actually shows the pixel-exact registration claim instead of
describing it. See `layer-maps-video-script.md`. **Until that recording exists, every draft below
should go out with the three photo-map stills from `layer-maps-demo-photo.md` at minimum — don't hold
everything hostage to the video shipping first.**

## Venue plan, in order

| # | Venue | Why this audience | Self-promo rule (source) | Format | Timing | Realistic outcome |
|---|---|---|---|---|---|---|
| 1 | **GitHub Discussions → Announcements** | Home base, zero audience-judgment risk, anchor URL for everything else. | None — Mehran's own repo. | Long-form post + the three map stills, video embed once it exists | Day 0 | Low traffic alone; this is the one Tier-1 item that's actually cheap to just do |
| 2 | **LinkedIn** | The only external venue with a proven, real post behind it (v0.25, 2026-09-09). Small audience (60 followers) but a channel Mehran already uses without hesitation. | His own profile. | Short post, video as native upload if the format allows | Day 0–1 | Low reach, but it's the one line item with a track record of actually going out |
| 3 | **r/comfyui** | Highest-intent audience; real prior contact (v0.12, u/Far_Estimate7276); the only Reddit venue I'd push Mehran to actually decide on this cycle rather than leave as a maybe. | **Unverified live** — reddit.com blocked to my tools; Mehran should open the sidebar/rules wiki before posting. Precedent: welcomes personal tool posts with a real screenshot/video and disclosed authorship. | Self-text + video or the best still | Day 1–3, only if Mehran actively decides to send it | A handful of comments if this cycle actually gets posted |
| 4 | **ComfyUI Discord** | Same audience, lower effort, lower stakes. | Unverified — no account. | Two sentences + video/GIF | Same window as r/comfyui | Low-effort, low-risk |
| 5 | **r/StableDiffusion** | Broader SD/Flux audience; Layer Maps is squarely their territory (it's the same ControlNet preprocessors this audience already uses, exposed as an export). | Unverified, same block. Stricter anti-spam norms than r/comfyui. | Self-text, trimmed | A few days after r/comfyui | Wider reach, thinner engagement |
| 6 | **r/photoshop** | The verified Photoshop-limitations angle is a direct hit for this audience — "here's what Photoshop actually can't do, and the one thing it can already do that I was wrong to say it couldn't." | Unverified, same block. Disclose authorship in the first line. | Self-text, cost-and-honesty framing | Its own schedule | Curiosity clicks; likely the most skeptical audience of the batch, in a good way — they'll know Depth Blur exists |
| 7 | **Show HN** | Strongest fit for "runs locally, checkable claim" — but see the hold below. | Confirmed from `news.ycombinator.com/showhn.html` (re-read this cycle): must be self-made, try-able, no vote-asking; one-shot. | — | **Hold** | — |

**Show HN stays held.** A Show HN already went out 2026-08-28
(`https://news.ycombinator.com/item?id=49480266`, 7 points, 0 comments) and HN referrer traffic (58,
unchanged from last cycle's count) hasn't moved, meaning nothing new has been submitted since. Per
HN's own resubmission norms, a second Show HN wants either real elapsed time or a materially different
project state — Layer Maps is a real, new, checkable capability, so it's a legitimate reason when
Mehran is ready, but it should point at the release tag
(`https://github.com/MehranMarxian/OpenLayer/releases/tag/v0.30.0-alpha`), not the bare repo root, and
it should carry the video. Not drafted fresh this cycle — reuse `docs/promo/v0.25/06-show-hn.md`'s
structure when the time comes.

### Sequencing logic

1. GitHub Discussion first, the day the video (or at minimum the three map stills) is ready — no
   reason to wait once the asset exists.
2. LinkedIn same day or next — it's a five-minute post and the one channel with a working precedent.
3. r/comfyui only as an explicit yes/no from Mehran, not a default next step — six cycles of silence
   on this exact venue is data, not an oversight.
4. Discord and r/StableDiffusion trail r/comfyui if and only if r/comfyui actually happens.
5. r/photoshop on its own schedule, once the "what Photoshop can and can't do" claims have survived
   contact with r/comfyui or r/StableDiffusion first.
6. Show HN held, per above.

### What I'd measure

- GitHub stars/forks/watchers (today: 15/4/0).
- Whether the GitHub Discussion and LinkedIn post — the two Tier-1 items — actually go out this cycle.
  That is the real test of the "smaller thing he'd actually do" theory above.
- `.ccx` download counts on the v0.30.0-alpha release assets once it's tagged non-pre-release, and on
  `releases/latest/download/openlayer-latest.ccx`.
- Any comment or reaction on whichever venues do go out — zero issues/comments has been the result for
  five releases running, and that (not stars) is the actual metric this campaign needs to move.

### What I could not verify

- Live subreddit rules for r/comfyui, r/StableDiffusion, r/photoshop, and the ComfyUI Discord's
  current channel list — same standing block as every prior cycle (reddit.com unreachable, no Discord
  account).
- Whether the Facebook referrer traffic (55 combined hits across three Facebook-family referrers,
  unchanged since last cycle) represents something Mehran posted himself. Worth him checking directly.
- Whether Adobe's helpx pages fully describe Depth Blur's current UI (the "Output depth map only"
  checkbox is corroborated by several independent tutorials but I could not load an Adobe first-party
  page that shows the Depth Blur dialog's own control list — the general Neural Filter output-options
  page doesn't break out per-filter controls). I'm confident enough in it to correct our own false
  claim, less confident I'd want to quote Adobe's exact wording for that specific checkbox in a public
  post — the drafts below describe it without quoting Adobe verbatim.
- The Lens Blur "alpha channel as depth map" step referenced in the brief: Adobe's current official
  page (`helpx.adobe.com/photoshop/desktop/effects-filters/blur-sharpen-filters/create-depth-of-field-with-lens-blur.html`,
  last updated Feb 23 2026) lists the Depth Map **Source** menu as **None / Transparency / Layer
  Mask** — it does not mention a separate "alpha channel" option in today's UI, even though older
  tutorials describe one. The video script below uses **Layer Mask**, the option Adobe's current page
  actually documents, and flags the discrepancy for Mehran to confirm against his own Photoshop 2025
  install before recording.
