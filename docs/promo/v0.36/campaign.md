# v0.35 + v0.36 combined promo campaign — staged, nothing sent

Covers **v0.35.0-alpha** (2026-09-23, Qwen-Image 2.1: transparent cut-outs, lettering, instruction
editing, multi-reference) and **v0.36.0-alpha** (2026-09-24, Edit Image card, selection-only edits
with no visible seam, transparent-placement fix). v0.35 already went out on GitHub Discussion #114,
the ComfyUI Facebook group, X and Civitai on release day — see
`.claude/.../memory/openlayer-v0-35-campaign.md`. This push is the venues that were held back
(r/comfyui, r/photoshop, LinkedIn, YouTube creator outreach) plus a Discord message, now that real
Photoshop screenshots exist, folded together with the v0.36 news so nobody reads two posts a day
apart about the same panel.

## The one message

**"Edit just a selection, get it back as its own layer with no visible seam — and the model that
makes it possible now also cuts out backgrounds with real alpha, right inside Photoshop."**
Selection editing is the harder problem (feature, not just a bugfix) and the screenshots prove it in
the actual Photoshop UI. The licence line comes right after, every time, before any other claim.

## Assets

All in `docs/promo/v0.36/`, converted from Mehran's originals to lossless WebP, pixels unaltered
(image 1 was cropped to remove a stray Snipping Tool notification/thumbnail strip that had appeared
in the corner of the screenshot — cropped only, no pixels inside the kept frame were touched):

| File | Shows |
|---|---|
| `edit-image-selection-before.webp` | Edit Image screen, lasso selection drawn on the sky, balloon result already previewed in the panel |
| `edit-image-selection-result.webp` | Same session after Generate Edit: Layers panel shows `OpenLayer_Img2Img` over `Background`, balloon composited into the canvas exactly where it was captured |
| `edit-image-screen.webp` | Edit Image screen with the lasso selection on the canvas and the feathered balloon result in the preview panel |
| `remove-background-cutout.webp` | Remove Background: OpenLayer Preview panel side-by-side with the Layers panel showing `OpenLayer_Cutout_...` over the original layer, panel footer reads "OpenLayer v0.36.0" |

`remove-background-cutout.webp` subject is a Krea-2-generated person, not a real individual — every
draft below either doesn't caption her or says "a generated portrait," never "a person" implying a
real photo.

**Gap:** no asset for the transparent-placement fix in isolation (it's a positioning bug, hard to
screenshot as a "before/after" without a ruler overlay) and no video for any of this yet. Both
drafts below are written to work without one.

## Licence line (verbatim, every venue, paragraph two)

> Qwen-Image 2.1's weights are under the Qwen Research License — research and evaluation only, not
> commercial work. OpenLayer says so on the preset itself; every other model it ships is unaffected.

## Venue table

| Venue | Why this audience | Self-promo rule (as checked) | Format | Realistic outcome |
|---|---|---|---|---|
| GitHub Discussion (Announcements) | Existing testers, highest-trust channel, already has #114 for v0.35 | N/A — this is the project's own repo | Long post, 4 images, plain text | A handful of comments/testers, the durable record other drafts link back to |
| r/comfyui | Highest-intent audience: already running ComfyUI, already have the GPU | **Could not verify current rules this session** — reddit.com and old.reddit.com both refused WebFetch and browser navigation is blocked for reddit.com under this session's safety restrictions. Prior record for this account: a v0.20 post to r/comfyui was auto-filter-removed (see memory `openlayer-v0-30-promo`). Mehran should open the subreddit himself, re-read the current sidebar/wiki rules, and if the filter catches it again, message the mods rather than resubmit. | Text post, first-person, screenshots inline | Given the filter history, treat this as a coin flip; worth trying once with the strongest assets, not worth repeating without a mod response |
| r/photoshop | Photoshop users who don't know ComfyUI exists yet — Firefly-alternative angle | **Also unverified this session** — same access block. No prior post history for this account here. | Text post, screenshots, lead with "free/local/no credits," be upfront ComfyUI is a separate local install | Lower technical tolerance audience; comments will ask "do I need a subscription/GPU" — worth pre-writing an FAQ reply |
| ComfyUI Discord | Same audience as r/comfyui, real-time, no karma/filter risk | **#rules channel not checked this session** — no active Discord session in this browser context. Mehran should confirm the showcase/plugins channel and its posting rule before sending. | Two sentences + one GIF/image, link to the release | Discord posts don't index or compound like Reddit/HN; treat as a small, friendly nudge, not a growth lever |
| LinkedIn (Mehran's account) | Professionals evaluating a Firefly alternative for cost/privacy reasons; held back on v0.35 because the session was logged out | No platform-specific self-promo rule beyond LinkedIn's own ToS; this is Mehran's own feed | Short post, one image, first-person "I built this" | Low reach unless Mehran's network includes design/dev people, but zero risk and it's still owed from v0.35 |
| YouTube creator outreach | Five creators already covered Qwen-Image 2.1 or Qwen layered workflows the week of 2026-09-20 | No subreddit-style rule; this is a cold DM/comment, so tone matters more than any posting rule | Short, specific message per creator, not a form letter | Most won't reply; one bite would be worth more than any of the above posts combined |

## Sequencing

1. **GitHub Discussion first.** It's the canonical writeup everything else links to, and it costs
   nothing to get wrong — it's the project's own space.
2. **ComfyUI Discord same day**, short and low-stakes, once the Discussion link exists to point to.
3. **r/comfyui next**, using the Discussion as the "already has more detail" fallback if the post
   gets cut short. Post once; if it's filtered, stop and have Mehran message the mods instead of
   reposting.
4. **LinkedIn** any time after the Discussion is live — no dependency, just needs Mehran signed in.
5. **r/photoshop** a day or two after r/comfyui, not the same day — different pitch (privacy/cost,
   not "here's a new preset"), and posting both the same day reads as a blitz if anyone cross-checks
   the account.
6. **YouTube creator outreach** in parallel with all of the above, since it's DMs, not posts, and
   isn't time-sensitive the same way.

## Drafts

### 1. GitHub Discussion (Announcements)

**Title:** Edit just a selection now returns its own layer — and Remove Background/cut-outs land
exactly where you captured them (v0.35 + v0.36)

**Body:**

Two releases back to back, so one post: v0.35 brought Qwen-Image 2.1 into Text to Image, Image to
Image and Multi-Reference — transparent cut-outs straight from the model, lettering that comes out
spelled right, and instruction editing ("make it a rainy evening"). v0.36 gives that editing its own
place on Home (**Edit Image**) and fixes the thing that made selection edits unusable: **Capture
Selection** now edits only what you selected and comes back as its own layer, transparent everywhere
else, with no visible seam. On a smooth sky test the edge went from a sharp −1.96 levels to −0.47 —
invisible even under a strong Curves boost.

Qwen-Image 2.1's weights are under the Qwen Research License — research and evaluation only, not
commercial work. OpenLayer says so on the preset itself; every other model it ships (FLUX.2 Klein,
Krea-2, BiRefNet for Remove Background) is unaffected.

Also in v0.36: every transparent result — Remove Background, cut-out edits, selection edits — now
lands exactly where it was captured. Photoshop measures a layer by its visible pixels, so anything
transparent at the edges used to be placed by its visible box and could land shifted; it now carries
two invisible corner pixels so Photoshop measures the whole frame.

Screenshots: a selection edit (adding a hot-air balloon inside a lasso over a mountain sky, before
and after) and a Remove Background cut-out.

[images: edit-image-selection-before.webp, edit-image-selection-result.webp, edit-image-screen.webp,
remove-background-cutout.webp]

Still alpha — this is a checkpoint, not a finished tool. If you try the selection edit or the
transparent-placement fix, I'd rather hear what's still wrong than a star.

v0.35.0-alpha: https://github.com/MehranMarxian/OpenLayer/releases/tag/v0.35.0-alpha
v0.36.0-alpha: https://github.com/MehranMarxian/OpenLayer/releases/tag/v0.36.0-alpha

---

### 2. r/comfyui

**Title:** Photoshop plugin for ComfyUI — selection-only edits now come back as their own layer with
no visible seam (built on Qwen-Image 2.1)

**Body:**

I've been building a Photoshop ↔ ComfyUI plugin (OpenLayer, MIT, runs entirely on your own ComfyUI
server — no cloud, nothing leaves the machine). Two releases this week:

Qwen-Image 2.1 landed as opt-in presets — transparent cut-outs generated with real alpha (not matted
after), lettering that comes out spelled right, and instruction editing. **Its weights are Qwen
Research License — research/evaluation only, not commercial work** — every 2.1 preset says so, and
none of them is a default; FLUX.2 Klein and Krea-2 stay Apache-2.0/open for anything commercial.

The follow-up fixes the thing that made editing *just a selection* impractical: the model used to
repaint the untouched ring a few levels darker, so a smooth sky showed the seam. It's now
colour-matched from the untouched ring before feathering in — measured edge went from −1.96 levels to
−0.47 on the same sky test, invisible under a strong Curves boost. Comes back as its own layer,
transparent outside the selection, original untouched underneath.

Screenshots are the actual panel: a lasso selection over a mountain sky, the edit added (hot-air
balloon), and the result layer in the Layers panel.

Still alpha, still rough in places — happy to answer setup questions or hear what breaks.

Release notes: https://github.com/MehranMarxian/OpenLayer/releases/tag/v0.36.0-alpha
Repo: https://github.com/MehranMarxian/OpenLayer

---

### 3. r/photoshop

**Title:** Free, local Photoshop plugin that runs Stable Diffusion / ComfyUI on your own machine —
no subscription, no generative credits

**Body:**

I built a Photoshop plugin called OpenLayer that talks to a ComfyUI server running on your own
computer. No cloud, no account, no per-image credits — it's MIT-licensed and free. Results come back
as normal, editable Photoshop layers.

Two things shipped this week that are relevant if you've been using Generative Fill and hitting the
credit limit: **Edit Image**, a new Home card for changing part of a photo by describing the
change ("make the jacket red," "remove the parked car") without touching the rest — and you can now
edit *just a selection* and get it back as its own layer with no visible seam. There's also a Remove
Background tool (cut-out layer, real alpha channel) and multi-reference composition from several
layers at once.

One caveat to be upfront about: this needs ComfyUI installed and running locally, which is a real
setup step (there's a one-click Windows installer, a guided in-panel Setup tab, and one-click .ccx
install for the Photoshop side) — it's not a zero-effort swap for Firefly, it's a free one if you're
willing to install a local AI backend. Some of the newest presets (Qwen-Image 2.1, used for the
selection-edit and cut-out work above) are research-licensed — free to try, not for client/commercial
work; the plugin also ships fully open models (FLUX.2 Klein, Krea-2) for anything commercial.

Screenshots: the Edit Image panel doing a selection edit (before/after), and a Remove Background
cut-out.

Still alpha, rough edges exist — ask away if you're weighing whether the local-install cost is worth
it for you.

https://github.com/MehranMarxian/OpenLayer

---

### 4. ComfyUI Discord

> Shipped selection-only edits that come back as their own layer with no visible seam (built on
> Qwen-Image 2.1), plus a Remove Background/cut-out placement fix — all inside a free Photoshop
> plugin (OpenLayer, MIT, runs on your own ComfyUI). Qwen 2.1 is research-licensed, said on the
> preset. Release: <v0.36 release URL>
> [attach: edit-image-selection-result.webp]

---

### 5. LinkedIn (Mehran's account, first person)

I've spent the last few months building **OpenLayer**, a free, open-source Photoshop plugin that
talks to ComfyUI running on your own machine — no cloud, no subscription, nothing leaves the
computer.

This week's releases: **Edit Image**, a way to change part of a photo just by describing the change,
while the rest stays untouched — and editing *just a selection* now comes back as its own layer with
no visible seam. There's also cut-out generation with a real alpha channel, straight from the model,
no matting step after.

Some of this runs on Qwen-Image 2.1, whose weights are under a research licence — free to try, not
for commercial work — so it's opt-in and never the default; OpenLayer also ships fully open models
for client work.

It's still an alpha. If you work in Photoshop and want to try running generative AI locally instead
of through a subscription, I'd like to hear what breaks.

https://github.com/MehranMarxian/OpenLayer
[image: edit-image-selection-result.webp]

---

### 6. YouTube creator outreach (per-creator DM/comment, not a form letter)

Each message needs Mehran's own yes before sending, one at a time — see the target list in
`.claude/.../memory/openlayer-v0-35-campaign.md` (Ray Codes, AI with Eric, Fahd Mirza, Prince does
AI, AINexLayer). Template below is a starting point per creator, not a paste:

> Hi [name] — saw your video on [their specific video/topic]. I build OpenLayer, a free/open-source
> Photoshop plugin that runs ComfyUI locally (no cloud). Just shipped Qwen-Image 2.1 support —
> transparent cut-outs, instruction editing, and as of yesterday, editing just a selection with no
> visible seam. Thought it might be relevant given [specific connection to their content]. Repo's
> here if you want to poke at it: https://github.com/MehranMarxian/OpenLayer — no ask, just thought
> you'd want to know it exists.

## What I could not verify this session

- **r/comfyui and r/photoshop current rules** — reddit.com and old.reddit.com both refused WebFetch,
  and browser navigation to reddit.com is blocked under this session's safety restrictions. Mehran
  should re-read both subreddits' sidebar/wiki rules himself before either post goes out.
- **r/comfyui filter risk** — this account had a prior post (v0.20) auto-filter-removed there; no way
  to check whether that's still the case without attempting a post.
- **ComfyUI Discord's current posting rules/channel** — no active Discord session this run.
- **LinkedIn login state** — was logged out during the v0.35 push; unknown whether that's still true.
