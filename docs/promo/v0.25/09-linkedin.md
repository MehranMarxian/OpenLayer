# LinkedIn — OpenLayer

**Status: draft only. Nothing has been posted or edited on LinkedIn.** Paste these yourself.

**Revised 2026-09-09 against the real profile**, read directly in the browser. The first version of
this file was written blind and guessed wrong about the most important thing — see below.

---

## What the profile actually says today

| | |
| :--- | :--- |
| Headline | **Photographer / Digital Artist** |
| Location | Iran · Open to work (On-site · Hybrid · Remote) |
| Current role | **Designer**, BlackFragments · Freelance, Jan 2024 – Present, Remote |
| Earlier role | Photographer, freelance, 2005 – 2012 |
| About section | **None. There isn't one.** |
| Education | An empty placeholder — LinkedIn is showing its "add education" prompt, not real content |
| Skills | 8, led by Photography and Texture Artist |
| Posts | **Zero. Never posted.** |
| Reach | 57 connections, 60 followers, 0 profile views and 0 search appearances in the last 7 days |
| OpenLayer | **Appears nowhere on the profile** |

### The thing the blind draft got wrong

It wrote you as a software engineer with a side project. You are a **photographer and digital
artist** who got tired of the round trip between Photoshop and ComfyUI and built the bridge himself
— then shipped it twenty-three times in eleven weeks.

That is a **better** story, not a lesser one, and it is the one thing about this project nobody else
can copy. The plugin's whole design argument is that results should come back as real, editable
layers instead of a flat PNG — that is an artist's complaint, and it is credible precisely because
an artist is making it. Do not bury the photography to make room for the code. Bridge them.

### Two corrections worth making while you are in there

- **"freelance Photografer"** — typo in your 2005–2012 entry, on a profile you are job-hunting with.
- **The Education section is an unfilled placeholder** and is publicly visible as one. Either fill it
  in or remove the section.

### One expectation to set honestly

With 60 followers and no posting history, **the launch post will reach almost nobody organically.**
That is not a reason to skip it — it is a reason to get the profile itself right first, because that
is what people see when a link, a recruiter search, or the repo's own README brings them here. The
post is worth writing; the About section and the OpenLayer experience entry are worth more.

---

## 1. Headline (220 char limit)

All three keep the artist identity and add the builder one. Pick on how far you want to lean.

**A — closest to what you have now** (114 chars)

```
Photographer & Digital Artist — building OpenLayer, an open-source Photoshop plugin for local AI
```

**B — leads with the unusual thing** (156 chars) — my pick

```
Digital artist who builds his own tools · Creator of OpenLayer, an open-source Photoshop plugin that runs Stable Diffusion on your own machine
```

**C — most direct about the work** (176 chars)

```
Photographer / Digital Artist · I build OpenLayer — free, open-source AI layers inside Photoshop, running against your own local ComfyUI server. MIT. 23 releases since June.
```

---

## 2. About section (2,600 char limit) — you have none, so paste the whole thing

> I'm a photographer and digital artist. For the last year I've also been building the tool I kept
> wishing existed.
>
> OpenLayer is a free, open-source Photoshop plugin that connects to a ComfyUI server running on
> your own machine. Text to image, inpainting, outpainting, upscaling, background removal, and a
> few more experimental tools — and the results come back as real, editable Photoshop layers with
> masks and alpha, not a flattened image you paste in and hope for.
>
> That last part is the whole reason it exists. Every other route between Photoshop and a local
> diffusion model hands you back a flat picture and makes the layer work your problem. I wanted the
> layers.
>
> It's MIT-licensed, there's no account and no subscription, and nothing you generate leaves your
> machine — generation runs entirely against ComfyUI on 127.0.0.1.
>
> It's an alpha, and I say so on the README, in the panel, and here. Twenty-three tagged releases
> since late June, each with a changelog I try to write the way I'd want a bug report written to me:
> what changed, why, and what it still doesn't fix. The newest release is mostly that second half —
> the panel now tells you when a tool's run produced nothing instead of reporting a no-op as
> success, and I found seven warning panels that had been invisible behind a stale CSS rule since an
> earlier version. One of them was the warning that the multi-image compositing tool doesn't
> preserve a specific person's face, which is exactly the warning you don't want hidden.
>
> The engineering underneath is mostly about Adobe's UXP runtime, which looks like a browser and
> isn't: no TextEncoder, an empty text field reports its value as null, CSS that's correct
> everywhere else fails silently in the host — and none of it can be exercised by CI, so the testing
> has to be built around what a real Photoshop session actually does rather than what the spec says.
>
> Repo, releases and changelog: github.com/MehranMarxian/OpenLayer

*(1,880 characters.)*

---

## 3. Experience entry — add this, don't replace BlackFragments

**Experience, not Projects.** You have "Open to work" on and a visible gap between 2012 and 2024;
an Experience entry fills timeline and carries more weight in recruiter search. Add it alongside the
BlackFragments Designer role rather than instead of it.

- **Title:** Creator & Maintainer
- **Company:** OpenLayer (open source)
- **Employment type:** Self-employed
- **Dates:** June 2026 – Present
- **Location:** Remote
- **Description:**

> Free, open-source Adobe Photoshop plugin connecting Photoshop to a locally-run ComfyUI server for
> AI image generation — text to image, inpainting, outpainting, upscaling, background removal and
> layer decomposition — with every result imported as a native, editable Photoshop layer.
>
> • Designed and built the whole thing: the TypeScript/UXP panel, the ComfyUI workflow and preset
> layer, and an MCP server that lets an AI agent drive the panel's own tools.
> • 23 tagged alpha releases since June 2026, each with a public changelog.
> • MIT licensed, runs entirely on the user's own hardware, no account or subscription.

---

## 4. Launch post (3,000 char limit)

First two lines carry it — LinkedIn truncates there.

> The tool now tells you when it failed, instead of quietly reporting success.
>
> That's the headline of today's release of OpenLayer, the open-source Photoshop plugin I've been
> building. Not a new feature — a correction. One of its more experimental tools splits a flat image
> back into separate layers, and when it found nothing to separate it said so in the same words it
> used for success: same message, same green tick, same layer count. The only thing wrong was that
> the "layer" it handed back was your original picture, unchanged. You couldn't tell without opening
> the file and looking.
>
> Chasing that down I found seven more warning panels that had been invisible since an earlier
> release — hidden behind a leftover CSS rule, no error, no trace. One was the note that the
> multi-image tool doesn't preserve a specific person's face. That's not cosmetic. That's the one
> warning you actually want a stranger to read before they try something the tool can't do.
>
> The release also ships something new: Remove Background. Capture a layer, press one button, get
> the subject back on its own layer with a real alpha channel — about 2.2 seconds, no prompt, no
> checkpoint, no particular GPU, because there's no diffusion in that graph at all. The part I
> checked before trusting it: the pixels that come back are yours. It joins the model's matte onto
> your original capture instead of re-rendering anything, and I measured it — mean absolute
> difference of 0.0 against the source. Nothing scaled, nothing re-encoded. An alpha channel gets
> added and that's all.
>
> (A trap, for anyone who enjoys these: the node called RemoveBackground returns the *background*,
> not the subject. My first test erased the fisherman and kept the lake.)
>
> I'm a photographer, not a career software engineer, and I started this because I wanted my layers
> back — every other route from a local diffusion model into Photoshop hands you a flat image and
> makes the layer work your problem. This is v0.25.0-alpha, the 23rd tagged release since June.
> Still alpha, still says so.
>
> github.com/MehranMarxian/OpenLayer
>
> #OpenSource #ComfyUI

*(2,190 characters.)*

---

## 5. Skills worth adding

Only ones the repo evidences: TypeScript, Adobe Photoshop, Adobe UXP, Open-Source Software, Git,
Stable Diffusion, ComfyUI, Plugin Development, Software Testing.

Keep Photography and Texture Artist where they are — they are not competing with these, they are the
reason the project is credible.

---

## What not to claim

- **No adoption numbers.** ~15 stars and zero filed issues is not a number that helps you. "Open
  source, 23 releases" is the honest framing.
- **Never "production-ready" or "stable."** The README calls it an alpha; so should you.
- **No macOS support.** Windows 11 + Photoshop 2025 is the only verified combination.
- **No Adobe Exchange listing** — it isn't listed, and three blockers remain.
- **Don't imply novel ML work.** Remove Background and the MCP bridge are orchestration around
  existing open models (ComfyUI nodes, BiRefNet). That is real engineering and worth saying plainly;
  claiming model research would be false, and this audience would notice.
