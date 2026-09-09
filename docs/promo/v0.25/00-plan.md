# v0.25.0-alpha promotion plan — staged, nothing published

Status: **draft only**. Nothing in this folder has been posted, commented, or edited anywhere.
Every action below needs Mehran's explicit go-ahead, per venue, at posting time.

## The one message

**Remove Background: a cutout that needs no prompt, no checkpoint, and no particular GPU — and is
provably your own pixels, not a re-render.** Capture a layer, press one button, get the subject back
on its own layer with real alpha in about 2.2 seconds. There is no diffusion anywhere in this graph,
so it doesn't care which image models you have installed or how much VRAM your card has — the single
biggest barrier every other tool in this project has, removed for this one. And it's checkable: the
RGB that comes back measures a mean absolute difference of **0.0** against the source at full capture
resolution. Nothing web-based can make that claim, because a web tool never lets you diff its output
against your own file.

This replaces Unflatten as the hook, on purpose. Unflatten is genuinely interesting but experimental,
fails on close-ups, and — as of this release — the panel itself admits when a run found nothing to
separate. Every draft in `docs/promo/v0.20/` led with it and none of them were ever sent (see "What
actually went out last time," below). That's not a coincidence: it's hard to promote a feature
honestly while also being the one insisting it isn't ready. Remove Background has no such asterisk.
It's the first tool in this project that's just *stable*, and that's the whole pitch.

Unflatten still gets one honest line wherever it comes up — not as news, as a correction: it used to
lie about failing, now it doesn't. That's a fact about honesty, not a feature announcement, and it
belongs in the "also in this release" paragraph, never the title.

## Is the honesty framing ("we un-hid things we were hiding from you") worth using?

Yes, as the release's *tone*, not as its headline. "Here's a fast new tool" is what gets someone to
click. "The tool now admits when it fails, and we found seven warnings we'd accidentally hidden from
you" is what makes a skeptical reader trust the rest of the post — it's disarming in exactly the
communities being posted to, all of whom have seen enough launch posts oversell a "beta." Leading
with it, though, reads defensive ("here's what we broke") to someone who's never used the tool and has
no stake in the previous claims. So: Remove Background in the title, the honesty theme in the second
paragraph of every draft, stated as "this release is mostly about the panel stopping saying things
that weren't true" — which is a direct line from the CHANGELOG's own framing, not spin.

## What actually went out last time — and what didn't

Checked directly against the repo before writing anything new:

- **GitHub Discussion #104** (the v0.20.0 catch-up post drafted in `docs/promo/v0.20/01-github-discussion.md`)
  **was posted**, with the images correctly hosted at `raw.githubusercontent.com` URLs as the old
  draft's notes required. It has **0 comments**, consistent with every prior announcement except #83.
- **The four old-post update edits** (`docs/promo/v0.20/07-old-posts-updates.md`, targeting #83, #85,
  #88, #94) **were also applied** — I read all four bodies directly and each now opens with the
  "Update, 2026-09" blockquote drafted last cycle.
- **r/comfyui, r/StableDiffusion, r/photoshop, the ComfyUI Discord post, and Show HN: I found no
  evidence any of these went out.** No comments anywhere that would result from them, and a web
  search for the project name alongside each venue returned nothing. I can't access reddit.com or a
  gated Discord directly, so this is "no trace found," not "confirmed did not happen" — worth Mehran
  confirming from his own accounts before this cycle assumes a clean slate.
- **RESOLVED — a Show HN already went out.** Searched the HN Algolia index directly:
  **"Show HN: OpenLayer – local Photoshop plugin for ComfyUI (inpaint/outpaint demo)"**, submitted
  **2026-08-28 by user `HMUSER`**, https://news.ycombinator.com/item?id=49480266 — **7 points, 0
  comments**. That is the 58 referrer hits, and it means Show HN is NOT untouched territory. See
  `06-show-hn.md`, which has been rewritten around this.

## Fresh traffic numbers (pulled today, 2026-09-09)

Two-week window, via `gh api repos/.../traffic/views` and `/clones`:

- **925 views / 299 uniques** (previous cycle's figure: ~789/243 — up, but this window includes the
  v0.25.0 release day itself, which will have its own bump independent of any promotion).
- **286 → 289 clones / 115 → 122 uniques** (essentially flat).
- Stars **15**, forks **4**, watchers **1** (was 12/4/1 at the last check) — small organic growth,
  no campaign behind it.
- Top referrers: `mehran-ahmadi.com` (59), `news.ycombinator.com` (58, see above), `github.com` (49),
  `l.facebook.com`/`facebook.com`/`lm.facebook.com` (49 combined — also unexplained, worth asking
  Mehran if he shared this somewhere on Facebook), `youtube.com` (19), `chatgpt.com` (8).
- **Zero issues opened, zero Discussion comments, in this window** — same conclusion as last cycle:
  reach is not the bottleneck, activation is. This plan's asks are built around that.

## The asset gap — say it plainly

**There is no real screenshot of Remove Background working.** `docs/assets/tools/remove-background.png`
is the tool's small line-art icon (a head-and-shoulders silhouette, 128×128), not a before/after. The
gallery in `docs/index.html` links to that same icon. Every existing promo image
(`docs/assets/v0200/*.webp`) is Unflatten, Multi-Reference, or the dashboard — nothing shows a cutout.

This is the actual blocker for this cycle, more than any venue's rules. Remove Background's whole
pitch is "the alpha is real and the pixels are untouched" — that is a claim a screenshot proves in one
glance (subject on a checkerboard, or the Layers panel showing a real alpha thumbnail) and no amount
of careful wording proves as fast. **Before any of these drafts go out, get one screenshot**: a
before (flat layer) and after (cutout layer with visible alpha) in the actual Photoshop UI, ideally
with the Layers panel's alpha thumbnail visible. Ten minutes with any test photo. Everything below is
written to be ready the moment that image exists; nothing else is blocking.

## Two questions every draft must ask, near-zero-friction

Per the project's own history, this audience does not volunteer feedback — the last cycle produced
zero issues and zero comments across three announcements. Both questions below are already the
release's own framing (they're the last section of the GitHub release body), which is a gift: it
means every draft can point at one place instead of re-asking in different words.

1. **Does the one-click `.ccx` install work on a clean machine?**
2. **Does any of this work on macOS?**

Every draft below phrases these as something answerable by a one-line comment or reaction, not a bug
report — "just say yes/no, you don't need to write anything else" is the actual sentence used more
than once, on purpose.

## Venue plan, in order

| # | Venue | Why this audience | Self-promo rule (source) | Format | Timing | Realistic outcome |
|---|---|---|---|---|---|---|
| 1 | **GitHub Discussions → Announcements** | Home base; anchor URL for everything else; also where #104 needs a forward-pointer edit before it's the most recent thing a visitor sees. | None — Mehran's own repo. | Long-form post + one edited old post | Day 0 | Low traffic alone; sets up every other link |
| 2 | **r/comfyui** | Highest-intent audience, already has the GPU (though this feature needs less of one than ever). Real prior contact here (v0.12, u/Far_Estimate7276). No confirmed post since — see anomaly above. | **Unverified live** — reddit.com is blocked to my tools. General precedent unchanged from last cycle: welcomes personal tool posts with a real screenshot and disclosed authorship. Mehran must open the sidebar/rules wiki himself first. | Self-text + before/after image | Day 0–1 | A handful of comments if the last cycle's silence was really silence and not just "never sent" |
| 3 | **ComfyUI Discord** | Same audience, different format. | **Unverified** — no account, can't read a gated `#rules` channel. | Two sentences + one image | Day 1–2 | Low-effort, low-risk |
| 4 | **r/StableDiffusion** | Broader SD/Flux audience. | **Unverified**, same block. Reputation for stricter anti-spam norms than r/comfyui. | Self-text, trimmed | Day 3–4 | Wider reach, thinner engagement |
| 5 | **r/photoshop** | Firefly-alternative audience, lower technical tolerance — and this release's pitch (no GPU-tier requirement, no prompt) is the easiest one yet for this crowd specifically. | **Unverified**, same block. Disclose authorship in the first line regardless. | Self-text, cost-and-privacy framing | Day 5–7 | Curiosity clicks, GPU/VRAM questions |
| 6 | **Show HN** | Local-first/privacy/MIT audience; strongest fit for "verifiably your own pixels, nothing phoned home." | Confirmed from `news.ycombinator.com/showhn.html`: must be self-made and try-able, no vote-asking, title must start "Show HN." **One-shot.** | Show HN + technical first comment | Day 5–8 | Unpredictable; budget a day to answer comments live |

Dropped from the v0.20 list: the "old posts / updates" and "other channels" housekeeping items are
still real (see files 07 and 08 below) but aren't separate *venues* in the same sense, so they're not
in this table — they're follow-through, not a new post.

No venue added or removed from the six requested. I considered dropping r/StableDiffusion given it
produced nothing verifiable last time either, but the honest read is that it was very likely never
sent (see anomaly section) rather than sent and ignored — so it hasn't actually been tested yet and
doesn't deserve to be cut on that basis.

### Sequencing logic

1. GitHub Discussion first — anchor URL, and the moment #104 gets its forward-pointer edit so it
   stops being the newest thing anyone finds.
2. r/comfyui and Discord same window — proven-ish audience, lowest risk of an embarrassing bug
   surfacing somewhere worse.
3. r/StableDiffusion a few days later, once any wording problems are caught.
4. r/photoshop on its own schedule — different audience, no reason to cluster.
5. Show HN last, once the copy has survived contact with at least one technical community, and only
   after Mehran confirms whether the `news.ycombinator.com` referrer traffic means this "one shot"
   was already spent under a title nobody archived here.

### What I'd measure

- GitHub stars/forks/watchers (today: 15/4/1).
- `.ccx` download count via `releases/latest/download/openlayer-latest.ccx` and this release's
  `openlayer-v0.25.0-alpha.ccx` asset directly (currently 0 downloads on every v0.25.0 asset, release
  is one day old).
- Whether either of the two asks gets a real answer — that's the actual success metric this cycle,
  not stars. Zero issues/comments last cycle is the failure mode to not repeat.

### What I could not verify

- Live subreddit rules for r/comfyui, r/StableDiffusion, r/photoshop — reddit.com is blocked to my
  tools, unchanged from last cycle.
- The ComfyUI Discord's current channel list and posting norms — no account.
- Whether the `news.ycombinator.com` and Facebook referrer traffic represents an actual post someone
  made, a comment mentioning the repo, or something unrelated. Worth five minutes of Mehran checking
  his own HN and Facebook history before assuming Show HN is still an unused shot.
- Whether the v0.20-cycle Reddit/Discord/HN drafts were ever sent by hand outside what I can see from
  here (no comments is suggestive, not proof).
