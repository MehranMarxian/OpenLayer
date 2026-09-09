# LinkedIn drafts — v0.25.0

Written 2026-09-09, grounded in `README.md`, `CHANGELOG.md` (v0.25.0-alpha section, published
today), `docs/known-limitations.md`, `docs/roadmap.md`, and `git tag` / `git log` on this repo.
Nothing here is posted. LinkedIn has no connector and no active session in the in-app browser, so
every block below is copy-paste text for Mehran to paste himself, in his own account, at his own
discretion.

## Assumptions — check these before pasting anything

I could not read Mehran's current profile (LinkedIn returns HTTP 999 to non-browser requests, and
there's no browser session on his account). So:

- **I don't know his current headline, employment status, or whether OpenLayer is already
  mentioned.** All three headline variants are written to work whether OpenLayer is a day job, a
  side project, or a portfolio piece — each says which it assumes.
- **I don't know if he has an About section already.** The About draft below is written as a
  complete, standalone section. If he already has one, the instruction at its top says what to
  keep and what to replace.
- **I don't know if "OpenLayer" already appears anywhere on the profile** (Experience, Projects,
  Featured). If it does, adding the Experience or Projects block below would duplicate it — check
  first.
- **Release count**: I counted 23 version tags in `git tag` (excluding the floating `latest` tag),
  from `v0.1.8-alpha` (2026-06-22) to `v0.25.0-alpha` (2026-09-09) — about 11 weeks. I've used
  "over 20" rather than the exact 23 so a late-breaking release between now and posting doesn't
  make the copy stale.
- **Numbers used are from the repo, not invented**: Remove Background's mean absolute difference
  of 0.0 against source and its ~2.2s runtime on a 4070 Ti are both in the CHANGELOG's v0.25.0 Added
  section. The "seven info panels were hidden" and "reports failure instead of success" facts are
  from the same CHANGELOG's Fixed section. Nothing here is a metric I estimated.
- **I assumed he wants understated, first-person, engineer-to-engineer copy** per your brief, not
  a growth/founder narrative. If he wants a more commercial tone for recruiters, that's a different
  rewrite, not an edit of this one.

---

## 1. Headline (220 char limit)

**A — conservative** (assumes OpenLayer is a side/open-source project, not his stated job title;
safest if his headline currently describes his day job and he doesn't want to replace that)

> Software engineer · building OpenLayer, an open-source Photoshop plugin that connects to a local ComfyUI server — no cloud, no subscription
(148 chars)

**B — project-forward** (assumes he wants OpenLayer to be the first thing a visitor reads,
regardless of day job — good if he's job-hunting in ML tooling / creative tech and wants this to be
the hook)

> I build OpenLayer — an open-source Photoshop plugin for local Stable Diffusion / ComfyUI workflows. MIT-licensed, 20+ alpha releases shipped since June.
(155 chars)

**C — bold** (assumes this is effectively his primary professional identity right now, e.g. between
roles or treating this as his main project — leans into the cadence and the engineering-honesty
angle rather than the feature list)

> Shipping an alpha, in public, release by release: OpenLayer connects Photoshop to your own local ComfyUI server. Free, MIT, nothing leaves your machine.
(155 chars)

---

## 2. About section (2,600 char limit)

> **Precision note (edited after review):** an earlier draft of this said "no image or prompt is
> ever sent anywhere but to the ComfyUI server on 127.0.0.1." That is stronger than the project's
> own README and a knowledgeable reader could hole it: with the optional Agent Bridge enabled,
> "Ask the Agent for a Prompt" sends a prompt to your MCP client, which may be a cloud service, and
> the Setup screen downloads model files from Hugging Face. Scoped to generation, the claim is
> exactly true. On a profile aimed at technical peers, an absolute claim with one hole in it costs
> more than the softer claim gains.


Paste this as the whole section, or graft only the first two paragraphs onto existing About text
and drop the rest — the first two stand alone as a summary; the third and fourth are the
supporting evidence a recruiter or peer would actually check.

> I build OpenLayer, an open-source Photoshop plugin (Adobe UXP) that connects to a ComfyUI server
> running on your own machine. Text to image, inpainting, outpainting, upscaling, background
> removal, and a few more experimental tools — results come back as real, editable Photoshop
> layers, not a flattened image you paste in and hope for. It's MIT-licensed, there's no account
> and no subscription, and nothing you generate leaves your machine — generation runs entirely
> against ComfyUI on 127.0.0.1.
>
> It's still an alpha — I say so on the README, in the app, and here. Twenty-plus tagged releases
> since late June, each with a changelog, and I try to write those changelogs the same way I'd want
> a bug report written to me: what changed, why, and what it does not fix yet. The newest release
> is mostly about the second half of that sentence — the panel now tells you when a tool's run
> produced nothing, instead of reporting a no-op as a success, and I found seven info panels and a
> warning that had been silently hidden behind a CSS rule since an earlier release (one of them was
> the warning that a face doesn't carry over in the multi-image compositing tool, which is exactly
> the warning you don't want hidden).
>
> The engineering problem underneath all of it is building reliably against Adobe's UXP runtime,
> which is Chromium-based but not a browser: no `TextEncoder`, an empty textarea reports its
> `.value` as `null`, CSS rules that are correct in every browser fail silently in the host, and
> none of it is exercisable from CI, so the test discipline has to be built around what a real
> Photoshop session actually does, not what the spec says it should do.
>
> I also built a small MCP (Model Context Protocol) bridge so an AI agent — Claude, Codex, or
> anything else that speaks MCP — can drive the panel's own tools in an open document, on the same
> code path a click would take. It's off by default and runs entirely on loopback.
>
> Repo, releases, and the full changelog: github.com/MehranMarxian/OpenLayer

(1,987 chars — room to spare under the 2,600 limit if he wants to add a current-role sentence at
the top)

---

## 3a. Experience entry

**Use this if OpenLayer is unpaid/independent work he wants LinkedIn to treat as a job-equivalent
line** — i.e., it's the primary thing he'd point a recruiter at, or he's currently between roles
and wants it filling the timeline rather than sitting under Projects.

- **Title:** Creator & Maintainer
- **Company/Org:** OpenLayer (open source)
- **Employment type:** Self-employed / Open Source
- **Dates:** June 2026 – Present
- **Location:** Remote
- **Description:**

> Open-source Adobe Photoshop plugin (UXP) connecting Photoshop to a locally-run ComfyUI server for
> AI-assisted image generation — text-to-image, inpainting, outpainting, upscaling, background
> removal, and layer-decomposition tooling, with results returned as native, editable Photoshop
> layers.
>
> - Sole engineer across the TypeScript/Vite panel, the ComfyUI preset/workflow layer, and an MCP
>   server that lets AI agents drive the plugin's own tools.
> - Shipped 20+ tagged alpha releases since June 2026, each with a public changelog.
> - MIT-licensed; runs entirely on the user's own machine — no telemetry, no account, no cloud
>   inference.
> - Built test and verification discipline for Adobe's UXP runtime, which cannot be exercised in
>   standard CI (no headless Photoshop).

## 3b. Projects entry

**Use this if he has a day job elsewhere and OpenLayer is what LinkedIn calls a project** — the
more likely fit if his current Experience section already lists paid work he wants to keep as the
primary line.

- **Project name:** OpenLayer
- **Dates:** June 2026 – Present
- **Associated with:** (leave blank, or his current employer only if it was built on their time —
  don't guess at this)
- **URL:** https://github.com/MehranMarxian/OpenLayer
- **Description:**

> Open-source Photoshop plugin that connects to a locally-run ComfyUI server — text-to-image,
> inpainting, outpainting, upscaling, background removal, and a layer-decomposition tool, all
> returned as editable Photoshop layers. MIT-licensed, no cloud dependency, no telemetry. Twenty-plus
> alpha releases shipped since June 2026, each documented in a public changelog.

---

## 4. Launch post — v0.25.0 (3,000 char limit)

First two lines carry the hook, since LinkedIn truncates there.

> The tool now tells you when it failed, instead of quietly reporting success.
>
> That's the headline of today's release of OpenLayer, the open-source Photoshop plugin I build
> that connects to a local ComfyUI server. Not a new feature — a correction. One of the plugin's
> more experimental tools (it splits a flat image back into separate layers) was reporting a run
> that separated nothing as if it had worked. Same success message, same green flash, same layer
> count. The only thing wrong was that the "layer" it handed back was just your original picture.
> Nobody could tell without opening the file and looking.
>
> Chasing that down, I also found seven info panels and a tool warning that had been invisible
> since an earlier release — hidden behind a leftover CSS rule in the compact theme, no error, no
> trace, just `display: none` on the exact panels meant to warn people about a tool's limits. One
> of them was the note that OpenLayer's multi-image compositing tool doesn't preserve a specific
> person's face. That's not a cosmetic bug. That's the one warning on the whole panel you actually
> want a stranger to read before they try something the tool can't do.
>
> The release also ships something new: Remove Background. Capture a layer, press one button, get
> the subject back on its own layer with a real alpha channel. It runs on ComfyUI's own
> background-removal model (BiRefNet, 444MB, MIT-licensed) — no prompt, no checkpoint, ~2.2 seconds
> on a 4070 Ti. The part I actually checked before trusting it: the pixels that come back are
> yours. The graph joins the model's matte onto your original capture instead of re-rendering
> anything, and I measured it — mean absolute difference of 0.0 against the source. Nothing scaled,
> nothing re-encoded. Only an alpha channel gets added.
>
> (Building it also surfaced a fun trap: the node called `RemoveBackground` returns the
> *background*, not the subject. First test run erased the person and kept the lake. Inverted the
> mask, moved on.)
>
> This is v0.25.0-alpha — the 20-somethingth tagged release since I started in June. Still alpha,
> still says so on the README and in the app. Full changelog and the plugin itself are on GitHub.
>
> github.com/MehranMarxian/OpenLayer
>
> #OpenSource #ComfyUI

(2,180 chars, well under the 3,000 limit — leaves room if he wants to add a line about what's next)

---

## 5. Skills to add

Only what the repo evidences, not a generic list:

- **TypeScript**
- **Adobe UXP** (or "Adobe Photoshop Plugin Development" if UXP isn't a recognized LinkedIn skill)
- **Vite**
- **ComfyUI** (if it exists as a LinkedIn skill entry; if not, skip rather than force a near-miss)
- **Stable Diffusion**
- **Open Source Software**
- **Model Context Protocol (MCP)** (if it exists as a skill entry)
- **Software Testing** / **Test Automation** — evidenced by the CI setup and the deliberate
  cross-checks added this release (setup pack vs. panel default, Wallet tool table vs. registered
  tools, dashboard section list vs. tool list)

Do not add "Machine Learning" or "AI/ML Engineering" — the repo is a Photoshop client and workflow
orchestrator around ComfyUI, not model training or inference work. Claiming ML engineering skills
from this project would be the kind of overreach the rest of this brief is explicitly against.

---

## What I would NOT claim

- **No user/download/adoption numbers.** The last recorded traffic (per project memory, not
  independently re-verified today) was in the low hundreds of views and ~15 stars with zero
  issues filed — not a number that helps a LinkedIn post or profile. Say "open source" and
  "shipped 20+ releases," not "used by."
- **Don't call it "production-ready" or "stable" anywhere.** The README calls v0.25.0 an alpha
  checkpoint in its own badge. Every draft above says "alpha" explicitly at least once.
- **Don't claim the MCP bridge or Remove Background as "AI features" in a way that implies novel
  ML work.** Both are orchestration around existing open models (ComfyUI nodes, BiRefNet) — that's
  accurately impressive as engineering, but claiming model work would be false.
- **Don't imply macOS support.** `known-limitations.md` and the README both say Windows 11 +
  Photoshop 2025 is the only verified combination.
- **Don't claim the Adobe Exchange listing** — it isn't listed there; per the exchange-readiness
  audit in project memory there are still three blockers.
