# OpenLayer: the beta and the 90 days after it

Written 2026-11-15 on `main` at `aeebbbe` (v0.41.0-alpha, the beta candidate). This is a planning
document: it changes no product code, and nothing in it is built until Mehran says "go" for that
item, one PR at a time. Feature freeze stays on until the beta is tagged. Every item says whether
it is **pre-beta** or **post-beta**.

How to read the evidence: every outside claim carries its source and the date it was read. Things I
could not confirm are marked **UNVERIFIED**. Numbers about OpenLayer come from the GitHub API on
2026-11-15 unless stated. Download counts are ceilings, not people, and tester results are counts,
never percentages (agreed 2026-07-27).

The roles behind this plan argued with each other. Where they disagreed, the disagreement and the
resolution are written down, in [Decisions](#decisions-one-recommendation-each).

**Contents**

1. [Where OpenLayer stands](#1-where-openlayer-stands)
2. [Competitor matrix](#2-competitor-matrix)
3. [Open-source strategy](#3-open-source-strategy)
4. [UX redesign proposal](#4-ux-redesign-proposal)
5. [Next build, ranked](#5-next-build-ranked)
6. [First beta plan](#6-first-beta-plan)
7. [Visibility and feedback plan](#7-visibility-and-feedback-plan)
8. [90-day roadmap](#8-90-day-roadmap)
9. [Risks](#9-risks)
10. [Skills to add for Claude sessions](#10-skills-to-add-for-claude-sessions)
11. [Decisions, one recommendation each](#decisions-one-recommendation-each)
12. [Sources](#sources)

---

## 1. Where OpenLayer stands

**The honest one-line version.** OpenLayer is a solid late alpha. Its engineering is ahead of its
reach. It works well on one Windows machine and has almost no proof from anyone else's.

What is true today:

- **Product.**
  - 16 tools and 39 presets (`src/comfy/presetRegistry.ts`), on v0.41.0-alpha, published 2026-11-05 as the beta candidate.
  - It is listed on Adobe Exchange, approved this autumn after two rejections (`docs/exchange-readiness-audit.md`).
  - Four tools are honestly labelled experimental: Inpaint's Klein path, Outpaint, Multi-Reference and Unflatten. Camera Angle is too (`docs/known-limitations.md`).
- **Engineering.**
  - The safety invariants A1 to A5 and B1 to B2 (`docs/ORCHESTRATION.md` §2).
  - 1,407 tests (142 files, run 2026-11-15), a recorded `object_info` drift test against ComfyUI 0.44 (G1), SHA-256-checked model downloads, targeted cancel, request timeouts, and a written UXP smoke checklist that passed in full on 2026-11-05 (G4).
  - This is unusually careful for a solo project.
- **The beta gate.** Four of six Required lines pass (G1 to G4). The two open ones, G5 (Photoshop 2024) and G6 (a clean install), need people, not code. W1 (macOS) has never been run.
- **New since the gate was written.**
  - Photoshop 28.0 shipped on 2026-11-10 with native Relight, Generative Restyle, Remove related elements, Prompt to Edit, Generative Upscale, Generative Recompose and an AI Assisted Editor ([Adobe Community announcement](https://community.adobe.com/announcements-710/photoshop-max-2026-relight-restyle-compare-create-like-never-before-1652100), read 2026-11-15).
  - OpenLayer has not been loaded on 28.0, and the gate does not mention it.
- **Reach, 2026-11-15.**
  - 51 stars, 6 forks.
  - 852 views / 338 uniques and 512 clones / 196 uniques over 14 days.
  - v0.41: 41 `.ccx` and 26 zip downloads in 10 days. `openlayer-latest.ccx` has 89 lifetime.
  - 0 open issues. 12 Discussions in the project's life, of which 4 were started by outsiders.
  - Discussion #174, the tester call, has 0 replies after 10 days.
- **Referrers have shifted.**
  - ChatGPT was the top referrer on 2026-09-23 (118 views / 66 uniques). It is not in today's top 10.
  - Today's top 10: mehran-ahmadi.com 44/31, github.com 35/19, aocr.org 19/19 (unexplained), youtube.com 14/7, Google 12/10, l.facebook.com 10/4, Bing 8/3, Brave 2/2, Yandex 2/2, Creative Cloud Developer Forums 2/1.
- **The panel speaks ComfyUI, not artist.**
  - The v0.41 screenshot (`docs/promo/beta-tester-call-2026-11-panel.png`) shows Workflow as `txt2img-flux2-klein` and Model as `flux-2-klein-4b-fp8.safetensors`, with Steps and CFG open.
  - In code, 11 Workflow dropdowns and 3 readiness messages print `preset.label`, which is the preset id, instead of the `displayName` the registry already holds. Examples: `appMarkup.ts:831` and `App.ts:8564`.
  - Home is one 16-card "Generate" list.
- **Promotion has stalled the same way four times.** Drafts get written, and the posts that need a current demo do not go out, because no current demo exists. `docs/promo/reddit-video-v0.40/raw/` is empty. Both public YouTube demos are v0.13 and v0.16.
- **Two small public-copy slips.**
  - The GitHub repo description says "real, editable Photoshop layers", which uses Photoshop as an adjective. It is not covered by the wording test, because the test reads files, not repo settings.
  - The repo topic `photoshop-plugin` is a search tag, not prose, so it is lower risk.
- **Activation is still the bottleneck.** The lesson of 2026-07-31 still holds: fix activation, not features. The Higgsfield verdict of 2026-10-15 also still holds: the gap is setup, reliability off this machine, and edit quality, not tool count.

---

## 2. Competitor matrix

Read across, not down. Each competitor wins on a different axis, and the row that matters for
strategy is where OpenLayer is the only one with a ✓. "Not listed" and "not found" mean I did not
find it in the cited source, not that it is proven absent.

| | **OpenLayer** | **Higgsfield plugin for Photoshop** | **Seedream via ComfyUI** | **Firefly in Photoshop** | **Krita AI Diffusion** |
|---|---|---|---|---|---|
| Runs where | Your GPU, local ComfyUI | Higgsfield cloud GPUs [H1] | ByteDance servers, called from ComfyUI Partner Nodes [S2] | Adobe cloud [F1] | Your GPU (managed or own ComfyUI), or its cloud service [K2] |
| Host app | Photoshop 2024+ (floor declared; 2025 tested) | Photoshop 2024+ [H1] | ComfyUI only (no editor) | Photoshop itself | Krita |
| Cost | Free, MIT | Plan credits, same rates as web [H2]. Third-party: Starter $19 / 270 credits, Plus $59 / 1,200, Ultra $129 / 3,000 [H4, secondary, cites the pricing page as of 2026-11-09]. Free credits on sign-up, amount not stated [H1] | Comfy account credits per image [S2]; 5.5 API price not published [S3] | Firefly standard models unlimited on CC Pro; Firefly Image 5 10 credits; partner models 10 to 40 credits [F1, F2, secondary] | Free, GPL-3.0 (cloud option priced separately, UNVERIFIED) |
| Account needed | No | Yes [H1] | Yes (Comfy account) [S2] | Yes (Adobe ID) | No (local) |
| Images leave your machine | Never | Yes ("processed on our infrastructure, not used for training") [H1] | Yes | Yes. Partner models see only the selection [F1] | Not in local mode |
| Models | Any ComfyUI model; 39 presets ship: FLUX.2 Klein 4B, Z-Image Turbo, Krea-2, Qwen-Image 2.1 / Edit 2511 / Layered, SeedVR2, SAM 3.1, LaMa, BiRefNet, SD 1.5 + ControlNets, Flux Fill | Higgsfield's selection; default image model Nano Banana 2 across its plugins [H2]; no model picker described [H1] | Seedream 5.0 Pro / Lite / Flash (5.5 not yet in API) [S2, S3] | Firefly Fill & Expand, Firefly Image 5, plus partner FLUX.2 pro, FLUX Kontext pro, Nano Banana 2 / Pro [F1] | Flux 2 (Klein from v1.46/1.47), Z-Image, SD 1.5, SDXL, Illustrious, Qwen edit (experimental) [K1, K3] |
| Custom workflows | Checks a pasted graph, cannot run it yet | No | It *is* ComfyUI | No | Yes: a Graph workspace runs your own ComfyUI graphs [K4] |
| Result as real layers | ✓ named, aligned, masks | ✓ new layer [H1] | ✗ (files) | ✓ generative layers | ✓ (Krita layers) |
| Edit by words | ✓ Edit Image (Klein, Qwen 2.1 research-only) | ✓ (Generate) | ✓ (Seedream edit) | ✓ Prompt to Edit, AI Assisted Editor (28.0) [F3] | ✓ (edit models) |
| Repaint / remove in a selection | ✓ Inpaint, Remove object (LaMa / LaMa + Klein) | not listed [H1] | via graph | ✓ Generative Fill, Remove related elements [F3] | ✓ [K1] |
| Extend canvas | ✓ Outpaint (experimental) | ✓ Expand [H1] | via graph | ✓ Generative Expand | ✓ |
| Several references | ✓ Multi-Reference (experimental) | ✓ via Character Swap / AI Stylist [H1] | ✓ up to 14 refs (4.0 API) [S4] | Reference image option (UNVERIFIED for 28.0) | ✓ IP-Adapter / regions [K1] |
| New camera angle | ✓ Camera Angle (experimental) | ✓ Angles, Shots [H1] | ✗ | not in the 28.0 list [F3] | not found [K1] |
| Relight | ✗ | ✓ Relight [H1] | ✗ | ✓ Relight (28.0) [F3] | not found [K1] |
| Flat image to layers | ✓ Unflatten (experimental) | ✓ Layer Decompose [H1] | ✗ | not in the 28.0 list [F3] | not found [K1] |
| Upscale | ✓ 4x pixel, 2x SeedVR2 restore | ✓ [H1] | ✗ | ✓ Generative Upscale [F3] | ✓ [K1] |
| Live painting | ✓ | ✓ Realtime AI [H1] | ✗ | not in the 28.0 list [F3] | ✓ [K1] |
| Select by text | ✓ SAM 3.1 | not listed [H1] | ✗ | not checked | not found [K1] |
| Face swap | ✗ by policy | ✓ [H1] | n/a | not in the 28.0 list | not found |
| macOS | Untested | Yes, Apple Silicon and Intel [H1] | n/a | Yes | Yes, Apple Silicon M1 to M5 [K2] |
| Installs from | Exchange, `.ccx`, zip | Its own installer, not Exchange [H1] | ComfyUI Partner Nodes | Built in | Krita plugin zip; can install ComfyUI itself [K2] |
| Community | 51 stars, 6 forks, 12 Discussions | Commercial product | n/a | n/a | 10,899 stars, 663 forks, 50 contributors (author 92% of commits), 14 translations, 493 Discussions [K5] |

**Other ComfyUI bridges for Photoshop** (GitHub API, 2026-11-15):

| Project | Stars | Last push | What it is |
|---|---|---|---|
| zombieyang/sd-ppp | 2,209 | 2026-11-08 | BSD-3. v2.0 (2026-02-04) mixes ComfyUI with cloud APIs (RunningHub, Replicate) [B2] |
| NimaNzrii/comfyui-photoshop | 1,796 | 2026-08-19 | A bridge driven from the ComfyUI side; Exchange listing v1.0.0 (2024-04-23); a v2 beta "coming soon", date unstated [B1] |
| AbdullahAlfaraj/Auto-Photoshop-StableDiffusion-Plugin | 7,316 | 2024-04-22 | MIT, **unmaintained for 19 months**; its users have no maintained successor |
| Ginolazy/ComfyPanel | 36 | 2026-11-13 | Local and cloud (RunningHub, BizyAir), v2.4.3 |
| PH-CU-S (ph-cu-s.com) | n/a | n/a | UXP panel, Photoshop 2025+, remote servers; price UNVERIFIED [B3] |

**New in the last three months: OpenFill** (beckettharriman/openfill, Apache-2.0, created
2026-10-14).
- It reached 292 stars in about four weeks. It brings local-ComfyUI generative fill, remove, expand and text to image to GIMP 3 and PhotoCraft, with ComfyUI started and stopped by the app [N1, N2].
- It is not a plugin for Photoshop. Its audience overlaps with people looking for a Firefly alternative.
- Its README opens with a story, a GIF and a "nothing leaves your computer" section. That, not features, is what to learn from.

**Seedream 5.5, plainly.**
- ByteDance announced Seedream 5.5 on 2026-11-09 [S1]. **No public weights and no licence were found** (2026-11-15).
- `huggingface.co/api/models/ByteDance-Seed/Seedream-5.5` does not resolve. Access is through ByteDance apps (Jimeng, Doubao, Volcano Ark) [S3], and its API price is unpublished [S3].
- Seedream 5.0 is API-only in ComfyUI, through Partner Nodes that need a Comfy account and credits [S2].
- **Treat Seedream as closed.** Driving it from OpenLayer would break the local promise, which the 2026-10-15 plan already rejected for partner nodes.

Seedream's features mapped to what runs locally today:

| Seedream feature | Best local equivalent today | Licence | Core or node pack | In OpenLayer? |
|---|---|---|---|---|
| Text to image, 2K/4K (4.0 [S4]) | FLUX.2 Klein 4B; Z-Image Turbo | Apache-2.0 (both, HF API 2026-11-15) | Core | ✓ |
| Very large text to image | MiniMax-H3-Image, 33B, 4 to 20 MP [W1] | MiniMax community licence; reported regional exclusions, UNVERIFIED | Core (ComfyUI 0.45) | ✗, size and VRAM unknown |
| Instruction editing | Klein edit; Qwen-Image 2.1 edit | Apache-2.0; Qwen research only | Core | ✓ |
| Up to 14 references | Klein chained ReferenceLatent (proven to 6); Qwen 2.1 (to 6 here) | Apache-2.0; research only | Core | ✓ (experimental) |
| 100-round edit stability (5.5 claim) | Nothing equivalent; Klein consistency LoRAs (community, licence per LoRA) | varies | n/a | ✗ |
| Dense lettering (5.5 claim) | Qwen-Image 2.1; FLUX 3 Image Klein (vendor claim) [W2] | research only; FLUX Kommunity (commercial under $5M revenue, per one secondary source) | Core | Qwen ✓; FLUX 3 ✗ |
| Native transparency (RGBA) | Qwen-Image 2.1 RGBA; BiRefNet cut-out | research only; MIT | Core | ✓ |
| Consistent sets (15 sequential images, 4.0) | No model feature; batch + Multi-Reference would build it | Apache-2.0 | Core | ✗ (this is "Shots") |
| Style transfer | Klein reference edit; SD 1.5 IP-Adapter | Apache-2.0 | Core / IPAdapter_plus (unmaintained) | ✓ (borrows mood, not style) |

**Firefly in Photoshop.**
- Strengths: built in, whole-image context for Firefly models, and fast cloud GPUs.
- Model picker and credits: partner models FLUX.2 pro, FLUX Kontext pro, Nano Banana 2 and Nano Banana Pro cost 10 to 40 credits each [F1, F2, secondary, 2026-09/10].
- Recurring complaints from Photoshop users, read through search snippets only [P1]:
  - a 1,024 px generation ceiling
  - "slow down" throttling while credits remain
  - false content-policy blocks, acknowledged by an Adobe employee in one thread
  - credits spent on failed fills

**Krita AI Diffusion is the benchmark that matters**, because it is open source and won. How it did it [K1 to K5, 2026-11-15]:
- At first run it offers three backends: an online service, a local server it installs and manages itself, or your own ComfyUI.
- It has a real docs site, with common issues, first steps and a model database.
- It posts one announcement Discussion per new model. Those are its most-upvoted threads.
- It ships a translation template, now 14 languages.
- It has released steadily: 20 releases in late 2023, 27 in 2024, 22 in 2025, 14 so far in 2026.
- It is still essentially one author: 92% of contributions. **Its lesson is install friction and model cadence, not a contributor wave.**

**What artists ask for** (PAM, 2026-11-15; Reddit could not be read directly, so these are search snippets and GitHub, ranked by how often they recur):
1. More than 1,024 px per generation.
2. No credit meter or throttling.
3. Fewer false content blocks.
4. Inpaint and outpaint that work (#86).
5. Low-VRAM and GGUF models (#179).
6. Bring your own workflow (#179, Krita #385).
7. Models in subfolders and in the right folder (#178, #110).
8. New models quickly (Krita's top discussions).
9. Live preview, seed control and wildcards (Krita #1709, #139, #1966).
10. A maintained plugin, in more editors.

**Higgsfield, honestly.**
- What it is:
  - Launched 2026-06-15 per its changelog [H3]. The date came from a summary of the page data, not its visible text.
  - It lists up to 16 tools across its own pages. The pages disagree with each other about whether it is five tools or more [H1, H2].
- **I found no independent artist reviews of Higgsfield's plugin for Photoshop itself.** Searches returned Higgsfield's own pages and one contributed article. Reddit is blocked for my tools. Praise and complaints about it are therefore UNVERIFIED.
- What fits a local, open-source tool:
  - Already covered: Layer Decompose (Unflatten), Angles (Camera Angle), Remove BG, Upscale, Realtime (Live Painting) and Expand (Outpaint).
  - Buildable: Shots (batch plus Multi-Reference), Mockup Studio (a template over Multi-Reference) and Relight (a spike).
  - AI Stylist and Character Swap map to Multi-Reference, with no likeness promise.
- What works only because it is a paid cloud:
  - Nano Banana 2 quality with no GPU.
  - Cinema and Marketing Studio, which are video and proprietary models.
  - One credit balance across apps.
  - Skin Enhancer and Face Swap, which OpenLayer declines on policy: likeness and misuse.

---

## 3. Open-source strategy

Do not copy a cloud product's feature list. Win where a local, open project is structurally better,
and turn each advantage into something a person can see, plus a reason to come back or contribute.

| Advantage | Concrete feature, doc or mechanic | How it brings users or contributors | When |
|---|---|---|---|
| **Local and private** | A "Nothing leaves this computer" section at the top of README and the landing page, with the proof: the panel talks only to the ComfyUI address in Settings, and there is no telemetry. A plain privacy note in the first-run screen. | Retouchers and designers under NDA, who cannot send client files to a cloud. That is a reason Firefly and Higgsfield cannot match. | Pre-beta (README copy) |
| **No credits** | Batch variations (P1): four results from one Generate, keep one. "Generate 40 variations; it costs electricity, not credits." Firefly partner models cost 10 to 40 credits each [F1]. | Credit-fatigued Firefly users, the #2 complaint. | Post-beta, first build item |
| **Any model** | One "Now in OpenLayer: X" Discussion per new model preset, Krita's best-performing pattern. Each Setup row says what the model is good at. | The ComfyUI crowd, who follow model news; gives LLMs and search one page per model to quote. | From the beta on |
| **Custom workflows** | Phase 1: a doc showing how to make a preset from your own graph (today it needs a registry entry). Phase 2: a guided import that maps an API graph's nodes to the panel's inputs and runs it. It answers #179, and Krita already does this [K4]. | Power users, the people who write node packs, and the first real contributors. | Doc pre-beta, feature post-beta (L) |
| **Community presets as contributions** | `docs/contributing-a-preset.md` plus a "Preset proposal" issue form. The tests that already exist (`object_info` snapshot, source/API equivalence, registry build) check a contributed preset automatically, so review costs little. Contributors are credited in release notes and the preset's notes. | A path from user to contributor that needs no knowledge of UXP. Presets are where ComfyUI people are experts. | Doc pre-beta |
| **Transparency** | Keep doing what is already unusual: Known limitations, measured claims ("mean absolute difference 0.0"), published smoke results. Add a public "How each preset was tested" line generated from the registry notes. | Trust, and LLM citations, which already drove the #1 referrer once. | Ongoing |
| **Translations** | Not now. Panel strings live in `appMarkup.ts`, `App.ts` and the registry. Translating means extracting them first, which is an L change inside the untested `renderApp` closure. Rule from today: new copy goes into one module (`toolErrorMessages.ts` and a sibling), so extraction gets cheaper over time. | Krita's 14 languages show the demand. Do it once strings are extractable, not before. | After 90 days |
| **Longevity** | MIT, no server to shut down, no account to expire. A "Coming from Auto-Photoshop-SD" guide (7,316 stars, unmaintained since 2024-04-22) that maps its features to OpenLayer. A CODEOWNERS file and a written "if I disappear" note (fork freely; the registry is the product). | Orphaned users of a dead project, and people choosing tools for the long term. | Post-beta (doc) |
| **Teachability** | Every preset already ships its ComfyUI GUI graph (`src/workflows/source/`). Expose it: "Open this preset in ComfyUI" copies the graph's path, and the docs explain each graph in two lines. | ComfyUI learners and YouTube educators, who need something to teach. | Post-beta |

**What this does not mean.** Open source is not an excuse for a rough panel. Artists compare against
Firefly's polish, not against other open projects. Section 4 exists for that reason.

---

## 4. UX redesign proposal

**Mockups:** [`docs/mockups/panel-redesign/index.html`](mockups/panel-redesign/index.html). Six
clickable screens, each beside today's panel where one exists:

1. Home
2. First run
3. Text to Image
4. Inpaint with Remove and Replace
5. Empty states and errors
6. Presets named by result

To view it, open the file in a browser from the repository, or use `python -m http.server --directory docs`
and go to `/mockups/panel-redesign/`. It is a browser drawing. **It proves nothing about UXP**, and the notes
beside each panel say which UXP rule each choice respects.

### Principles (UX designer, argued against the UXP engineer)

1. **Say what you get, not how it is made.** Model names go in brackets, never first. Preset ids never
   reach the screen.
2. **Progressive disclosure.** Prompt, look, shape and Generate are visible. Steps, CFG, seed, sizes,
   LoRA and model file sit under "More options", closed by default and remembered per tool.
3. **One next step.** Every empty state says what to do in Photoshop. Every error has a title, one or
   two sentences, and a button that does the next thing.
4. **Licences in plain words, at the point of choice.** "Free for client work" (Apache-2.0 or MIT),
   "Personal use only" (non-commercial), "Research only" (Qwen Research License), "Read the licence"
   (custom terms such as Krea-2's).
5. **Keep the tool names.** README, llms.txt, the Exchange listing, the videos and the Agent Bridge
   all use them, and LLMs quote them. Renaming 16 tools would cost more than it gains. Only the
   subtitles change, plus "Workflow" becomes "Custom Workflow", because two different things are
   called Workflow today.

### Information architecture

| Today | Proposed |
|---|---|
| Home: "Generate" (16 cards), "Workflow" (2), "Tools & History" (3), "Preferences" (2) | **Create**: Text to Image, Sketch to Image, Live Painting, Multi-Reference. **Change**: Edit Image, Image to Image, Inpaint, Outpaint, Camera Angle, Style Reference. **Cut and select**: Remove Background, Select by Text, Unflatten, Layer Maps. **Finish**: Upscale, Prompt from Layer. A footer row: History, Prompts, Setup, Settings. A collapsed **For ComfyUI users** group: Workflow Presets, Custom Workflow, Layer Tools. |
| "Status: Ready" row | A connection chip in the top bar with GPU size; click it to re-check |
| Start here card inside Setup | A Start here banner on Home until the starter is installed or dismissed |
| Workflow + Model pickers | One **Look** picker named by result; the model file appears under More options only when there is a real choice |
| Width and Height fields | Shape chips (Square, Portrait, Landscape, Canvas); numbers under More options |
| Inpaint presets include "Remove object" | **Remove it / Replace it** chosen at the top; Remove asks only "small object" or "large, like a person" |
| Import labels differ by tool | **Add as Layer** everywhere, plus an Auto-add toggle |

### First-run path

The pieces exist but are spread across the welcome overlay, Setup's Start here card and Text to
Image. The proposal joins them into three steps, one screen each. It ends with a layer in the document.

1. **Find ComfyUI.** Say what was found in plain words: version, address, GPU size, and "no image
   models yet, that is normal". If nothing answers: Try again, enter an address, or Copy the
   Getting started link (no browser opening until the `openExternal` spike).
2. **Get the starter.** The existing one-button Klein 4B download (12.5 GB, Apache-2.0), with "I
   already have models: skip".
3. **Make your first layer.** A pre-filled prompt plus three more as chips. Generate, then the
   result lands as a layer. Then three buttons for next steps: Remove something, Edit Image,
   Remove Background.

### Presets explained by result

The mockup's sixth screen has draft names for every Text to Image, Inpaint, Upscale and Sketch to
Image preset. For example, `txt2img-flux2-klein` becomes "Fast, all-round (FLUX.2 Klein)",
`upscale-seedvr2-3b` becomes "Restore 2x, invents fine detail", and `inpaint-lama` becomes
"Remove it, small object".

**These names are promises.** Each needs a side-by-side image before it ships, the lesson of the
NitroFusion2 rejection (2026-11-10). Mehran approves the wording.

### UXP buildability (the UXP engineer's conditions)

- **Layout and hiding.**
  - Margins, never flex `gap`.
  - The `hidden` attribute, never `visibility:hidden`.
  - Selected state through `data-selected`, never `aria-pressed`: compact styles every `button[aria-pressed]` as a gold switch.
  - Chips state their height, and their radius is half of it.
- **Controls and assets.**
  - Native `<select>` for every picker, so the wheel-proof picker from #140/#141 still applies.
  - The existing PNG icons only, never data-URI SVG.
- **CSS and text.**
  - New rules go under `.app-shell.theme-compact`, or the compact theme's `!important` blocks win.
  - Every string renders through `textContent`: no markdown, no backticks, no `--`.
- **Process.** One screen per PR, each with a real Photoshop screenshot and smoke blocks 0 plus the area changed.
- **What is not touched.** No capture or import host code changes. Invariants A1 to A5 and B1 stay where they are.

### Screenshots I need from Mehran (window-only, clean document, no desktop)

1. Home at the panel's default width, current theme.
2. The Setup screen with the Start here card showing.
3. Inpaint with a selection captured, and with a "Missing node" error showing.

---

## 5. Next build, ranked

Sizes: **S** is one small PR, **M** one larger PR, **L** several PRs (each still one PR at a time).
Impact is on activation and retention first. Risk is the chance of breaking a working panel.
"PS check" is how it is verified in Photoshop, beyond the four checks every PR runs.

### Pre-beta (allowed under the freeze: fixes, docs, gate work)

| # | Item | Impact | Effort | Risk | PS check |
|---|---|---|---|---|---|
| B1 | **This plan** (docs only) | Sets direction | S | None | n/a |
| B2 | **Show artist names, not preset ids.** Use `displayName` in all 11 Workflow dropdowns (`appMarkup.ts` lines 831 to 2019, `App.ts:8564`) and in the 3 readiness messages (`inpaintReadiness.ts:199,213,251`). Option values stay the preset ids, so saved preferences and the bridge keep working. **Touches panel markup, so it needs your OK under the freeze.** | High: every tool screen | S | Low (text only) | Smoke blocks 0, 1, 2; screenshot of each Workflow dropdown open |
| B3 | **Add gate line G7: the newest Photoshop.** Blocks 0 to 2 on Photoshop 28.0, run by Mehran if he has it, otherwise by a tester. Update `beta-gate.md` and the compatibility note. | Most new installs land on the newest Photoshop | S (docs) | None | Blocks 0 to 2 on 28.0 |
| B4 | **Fix the GitHub repo description** ("editable Photoshop layers" → "real, editable layers in Photoshop"). A repo setting, not a file: Mehran edits it, or I do it with `gh` after his yes. | Exchange reviewer and LLM surface | S | None | n/a |
| B5 | **Contributor docs:** fix CONTRIBUTING (Node 20+, lint; E5), add `docs/contributing-a-preset.md`, a "Preset proposal" issue form, and open five labelled good first issues (§7.5). | First outside contributions | S | None | n/a |
| B6 | **README top rewrite in OpenFill's shape:** one sentence, a 10-second GIF of a result landing as a layer, then "Nothing leaves your computer". Mirror it in `llms.txt` and `index.html` (meta + JSON-LD). | The surface LLMs quote | S | None (wording test covers it) | n/a |
| B7 | **Beta release PR** `release/v0.42.0`: version bump, G4 re-run on that build, CHANGELOG, Exchange resubmission (W2) | The milestone | M | Medium (release) | Full smoke checklist, blocks 0 to 5 |

### Post-beta (in order; each waits for "go")

| # | Item | Impact | Effort | Risk | PS check |
|---|---|---|---|---|---|
| 1 | **Batch variations (P1)**: N results from one Generate, pick one to import (design exists in `BATCH_GENERATION.md`) | High: the no-credits story made visible; the base for Shots | M | Medium (generation controller) | 4 variations at a fixed seed arrive; importing one places exactly that one |
| 2 | **Home regroup**: `HOME_TOOL_SECTIONS` + subtitles + footer row + collapsed ComfyUI group (mockup screen 1) | High: first impression | S | Medium (CSS) | Block 0 + screenshot at min and max panel width |
| 3 | **First-run path** (mockup screen 2) | High: G6's measured clicks | M | Medium | A fresh UXP data folder: count clicks and minutes to a first layer |
| 4 | **Look picker + More options on Text to Image** (mockup screen 3), then one tool per PR | High | M, then S each | Medium (CSS, pickers) | Block 1 + wheel and keyboard on the picker |
| 5 | **Inpaint: Remove it / Replace it** (mockup screen 4) | High: the most-asked edit | S/M | Medium | Block 2 + one Remove and one Replace run |
| 6 | **Three-part errors everywhere** (mockup screen 5), extending E2 | Medium-high | M | Low | Wrong-folder model, missing node pack, ComfyUI stopped |
| 7 | **Guided custom workflow run** (answers #179): map an API graph's prompt/image/mask/seed nodes, validate against `/object_info`, run it. Spike first. | High for contributors | L | High (new surface) | A pasted Flux Fill GGUF graph runs and imports |
| 8 | **Relight spike**: Qwen-Image-Edit relight LoRA on the 2511 stack OpenLayer already ships | Medium (parity with Higgsfield and Photoshop 28) | M | Medium; licence of the LoRA unknown | Side-by-side contact sheet for Mehran **before** any preset |
| 9 | **Shots**: a consistent set from one subject, built on batch + Multi-Reference | Medium | M | Medium | Four shots of one product, judged by eye |
| 10 | **FLUX 3 Image Klein side-by-side** against Klein 4B (licence: FLUX Kommunity, not Apache) | Unknown until seen | S (spike) | Low | Contact sheet only |
| 11 | **Mockup template** over Multi-Reference (product + surface) | Medium for designers | S | Low | One mockup imported as layers |
| 12 | **Agent Bridge session token (W3 / R2b)** | Low (off by default) | S/M | Low | Block 6 |
| 13 | **`App.ts` handler extraction (R8)**, one tool per PR, interleaved with the above | Maintainer health | L | Medium | Smoke block for the moved tool |
| 14 | **P2 object_info cache, P3 lazy workflow loading** | Speed at Generate and panel open | S each | Low | Timings before and after, pasted in the PR |

**Argued and rejected for this window:** a managed ComfyUI install like Krita's. A UXP plugin
cannot start a Python process, so OpenLayer points at Comfy Desktop, which is a managed install,
and makes Getting started lead with it. Also rejected again: partner API nodes, Face Swap and any
uncensor switch (see the 2026-10-15 decision).

---

## 6. First beta plan

### What blocks it

| Line | Status | What closes it |
|---|---|---|
| G5 Photoshop 2024 | Open. One tester confirmed v0.37.1 on 25.7 (issue 127); nothing newer | One outside run of blocks 0 to 2 on Photoshop 2024 with the beta candidate |
| G6 Clean install | Open. Seven clicks timed on the author's machine only | One person on their own machine, from an empty ComfyUI to a first layer, following Getting started, without help |
| G7 Newest Photoshop (proposed, B3) | Open. 28.0 shipped 2026-11-10 | Blocks 0 to 2 on 28.0 |
| W1 macOS | Open. Never run | Wanted; if open, the beta says "Windows only, macOS untested" |
| G4 re-run | Must re-run: code changed after `fd679fc` | Full smoke on the exact build that is tagged |

### Recruiting the testers (PAM's research, 2026-11-15)

- **G5, Photoshop 2024.**
  - Re-ping discovermodo on issue 127 once, on or after 2026-11-19, two weeks after the 11-05 ask. They already run 25.7.
  - No open venue gathers Photoshop 2024 users, and Adobe Community does not allow self-promotion [V1].
  - A line in the Facebook ComfyUI group post asking specifically for 2024 users is the only broad ask worth making.
- **G6, clean install.** One artist from Mehran's own network who has never run ComfyUI.
  - They follow Getting started on their machine and file the tester form. Mehran may watch but not help.
  - Add a one-line "I need one fresh install" ask on mehran-ahmadi.com, the #1 referrer today.
  - Do not recruit in strangers' ComfyUI install-help threads: it reads as spam.
- **W1, macOS.**
  - forum.comfy.org has a Mac feedback area with active Apple Silicon users (latest topic 2026-11-07). Its guidelines are UNVERIFIED, so read them before one post [V3].
  - OpenFill found its Mac tester through a plain issue ask [N1].
  - Do not recruit inside the Krita or OpenFill communities.
- **G7, Photoshop 28.0.** Mehran first, if he has it. Otherwise the same Facebook post asks for 28.0 users too.

Drafts for each ask go in `docs/promo/` and wait for Mehran's yes. Nothing is posted by Claude, and
reddit.com is blocked for Claude's browsers anyway.

### Target date

**Tag `v0.42.0-beta` on Tuesday 2026-12-08.**

- **2026-11-16 to 11-29:** testers asked; B2 to B6 built one at a time; the demo clip recorded.
- **Monday 2026-11-30:** tester checkpoint.
- **12-01 to 12-04:** G4 re-run on the release build; release PR.
- **12-08:** tag, Exchange resubmission, announcement.

**The fallback, decided now so the gate cannot hold the project forever:**
- If G5 or G7 has no outside report by 2026-12-01, it moves to Wanted, and the release notes say exactly which version was last confirmed.
- G6 stays Required, because it is the activation proof. If it is still open on 12-01, the beta slips a week at a time, and recruiting gets all the promotion effort until it passes.

### Release checklist (on top of `docs/release-checklist.md`)

- [ ] Every Required line in `beta-gate.md` passes, or is moved to Wanted by the fallback rule above, with the reason written in the row.
- [ ] Full smoke (blocks 0 to 5) on the tagged build, with a row in the Results table.
- [ ] `package.json` at 0.42.0. `npm test` passes `versionConsistency.test.ts`. Check that it accepts the `-beta` tag suffix the release uses; it is not known to.
- [ ] CHANGELOG section. README "New in", `docs/index.html` (meta description + JSON-LD), `docs/llms.txt`: all say "beta", "Windows tested; macOS untested" (unless W1 passed), and carry the licence lines.
- [ ] **Publish the beta as a normal release, not a pre-release.** `releases/latest` then resolves, and GitHub shows a current release. Every release so far has been a pre-release, so the repo shows none as current.
- [ ] `latest` assets refreshed, and the Download button's `.ccx` SHA-256 matched to the tagged one.
- [ ] Exchange resubmitted with the beta `.ccx` and screenshots at 1,360 × 800. The reviewer note is first person, businesslike, at most 1,000 characters.
- [ ] Discussion announcement plus the tester thank-yous, with testers credited by handle if they agree.

---

## 7. Visibility and feedback plan

### 7.1 Channels, in priority order

1. **Our own pages: README, `llms.txt`, `index.html`.** LLMs quote them, and ChatGPT was the #1
   referrer two months ago. Whether its drop is real or a tracking change is unknown. Submitting
   the sitemap to Bing Webmaster Tools was asked on 2026-09-24; its status is unknown, and it needs
   Mehran's login.
2. **Free, permanent listings**, which need no new image (drafts in `star-push-2026-11/03-listings.md`):
   - awesome-alternative-uis-for-comfyui and lucianosb/awesome-comfyui PRs
   - OpenAlternative
   - AlternativeTo
3. **Adobe Exchange.** Update it with the beta. The listing has 0 ratings, so ask the two known
   testers to rate if they installed from there. Never ask for a star and a rating in the same message.
4. **The demo clip on YouTube**, correctly titled "OpenLayer plugin for Photoshop …". Cut a 9:16
   version for Shorts.
5. **Facebook ComfyUI group** (79.8K members), the best-performing post so far. Mehran posts.
6. **r/StableDiffusion, once, with the clip.** Mehran posts. The rules are second-hand, so read
   them logged in first.
7. **forum.comfy.org** (the Mac ask) and the **Creative Cloud Developer Forums** (the `showcase`
   tag, and the drafted Photoshop-access question).
8. **Show HN** with the Agent Bridge (MCP) angle, linked to the release tag, a week after the beta.
   This is a resubmission: the first went out on 2026-08-28.
9. **comfyui-wiki.com news.** It covered OpenFill. How to submit is UNVERIFIED.
10. **YouTube creators**, only once the clip exists. The two staged Gmail drafts are unsent.
11. **LinkedIn and Behance**, for designers: slow, and a different audience from stars.

**Never:** Adobe Community threads as promotion, anti-AI spaces (ArtStation, "Artists Against
Generative AI"), any title that names a competitor's product, or the word "first".

### 7.2 Eight-week content calendar

Each item is a draft in `docs/promo/` that Mehran approves and, for Reddit and Facebook, posts himself.

| Week (Mon) | Theme | Items |
|---|---|---|
| 1, 11-16 | Testers | Tester asks (issue 127 re-ping, network ask, site line); record the demo clip; awesome-list PRs and directory forms |
| 2, 11-23 | The clip | Clip on YouTube + Shorts; Facebook ComfyUI group post with the clip and the 2024/28.0/Mac tester ask; forum.comfy.org Mac thread |
| 3, 11-30 | Checkpoint | Tester checkpoint; "what testers found" Discussion; Creative Cloud Developer Forums showcase |
| 4, 12-07 | **Beta** | Tag 12-08; Discussion announcement; Exchange resubmission; README GIF; LinkedIn; r/StableDiffusion with the clip |
| 5, 12-14 | Proof | Show HN (MCP angle); a "Remove object in 3 seconds" before/after still for Facebook and Behance |
| 6, 12-21 | Quiet (holidays) | One "Now in OpenLayer" model Discussion; reply to everything |
| 7, 12-28 | Quiet | "Coming from Auto-Photoshop-SD" guide published (docs) |
| 8, 01-04 | First post-beta build | v0.43 preview: batch variations clip; creator outreach with the new clip |

### 7.3 Demo assets to make first, in order

1. **A 60 to 90 second real-window clip**, per `docs/promo/reddit-video-v0.40/BRIEF.md`. It shows Select by Text "cable", then Remove object, then Edit Image, ending with layers in the Layers panel. Window-only, on a fresh document, nothing personal on screen, checked frame by frame. Every post on the list is stronger with this.
2. **Three before/after stills**: Remove Background (with the alpha thumbnail in the Layers panel), Remove object, and Unflatten.
3. **A 10-second README GIF** of a first result landing as a layer.
4. **Exchange screenshots** at 1,360 × 800 of the beta.
5. **A 9:16 cut** of the clip.

Already exists and is enough: the unlisted install video for Exchange reviewers (CPU) and the v0.39
first-run slideshow.

### 7.4 Feedback funnel

The panel's Settings › Copy Diagnostics feeds three places:
- the **tester report** issue form, which already captures `unassisted`, time to first layer and failure stage
- **bug** issues
- **Discussions**: setup help, feature requests, show your results

Then:
1. **A monthly "What we heard" Discussion** lists every ask, what was done, and what was declined and why.
2. **The roadmap links each item to the Discussion that asked for it.**

Two additions:
- E4, a fuller Copy Diagnostics, as a good first issue.
- A "Send feedback" link at the bottom of the panel that copies the Discussions address. A link, not a form, because no telemetry was ever promised away.

### 7.5 Contributor onboarding

- **`CONTRIBUTING.md`**: Node 20+ (22 in CI), the four checks including lint, how to load `dist/` in UXP Developer Tool, and a "you cannot test the panel in a browser" warning.
- **`docs/contributing-a-preset.md`**: the CLAUDE.md "Adding or changing a preset" steps written for an outsider. Copy an entry of the same family, HEAD-verify each URL, record size and SHA-256, add a licence gate when needed, and run `npm run object-info -- --check` against your ComfyUI. The existing tests tell the contributor and the reviewer the same thing.
- **Five good first issues**, all real:
  1. Tests for `comfyPortDiscovery.ts` (69 lines, untested)
  2. Tests for `modelFileDestination.ts` (100 lines, untested)
  3. E4 Copy Diagnostics with the ComfyUI version, preset, and found nodes and models
  4. U3, a scheduled link and model-URL check Action
  5. Remove the dead exports listed in `codebase-review.md` §4
- **Credit**: name contributors in the CHANGELOG and the release body.

### 7.6 Metrics, with today's baseline (2026-11-15)

| Metric | Baseline | Source | Target at day 90 (2027-02-13) |
|---|---|---|---|
| Stars | 51 | GitHub API | 150 |
| Forks | 6 | GitHub API | n/a (follows PRs) |
| 14-day views / uniques | 852 / 338 | traffic API | 1,500 / 600 |
| 14-day clones / uniques | 512 / 196 | traffic API | n/a |
| `.ccx` downloads, newest release | 41 (v0.41, 10 days) | releases API | 150 for the beta in its first 30 days |
| `openlayer-latest.ccx` | 89 lifetime | releases API | n/a |
| Exchange installs | **Unknown**: only Adobe's developer console shows it | Mehran reads it | Record the number |
| Exchange ratings | 0 (2026-11-10) | Exchange page | 5 |
| Tester reports | 0 for v0.41 | issue form | 5, of which at least 3 unassisted (counts, not a rate) |
| Outside contributors with a merged PR | 0 this year | GitHub | 2 |
| Referrers (top) | mehran-ahmadi.com 44/31, github.com 35/19, aocr.org 19/19, youtube 14/7, Google 12/10; ChatGPT absent | traffic API | ChatGPT back in the top 5 |
| Open Discussions from outsiders, last 30 days | 2 (#178, #179) | GraphQL | 8 |

The targets are my guesses to steer by, not forecasts. Report them every two weeks in a single
table row. Metrics are counts; never divide reports by downloads.

---

## 8. 90-day roadmap

| Milestone | Date | Done when |
|---|---|---|
| **M0 Plan agreed** | 2026-11-17 | This PR is reviewed; Mehran's five decisions are made |
| **M1 Beta** | 2026-12-08 | `v0.42.0-beta` tagged as a normal release. The gate passes, or is moved by the fallback rule. The clip is out. Exchange is resubmitted. B2 to B7 are merged. |
| **M2 Artist-first panel, part 1** | 2027-01-12 | v0.43: batch variations, Home regroup, first-run path, Look picker on Text to Image. Each was its own PR with a Photoshop screenshot. |
| **M3 Your workflows** | 2027-02-13 | v0.44: three-part errors and Remove/Replace in Inpaint. A guided custom-workflow spike with a go/no-go. The Relight and FLUX 3 Klein side-by-sides judged by Mehran. At least one outside PR merged. The first "What we heard" post. |

The ordering argument, in one line: the beta is about other people's machines. M2 is about the
first five minutes. M3 is about giving power users a reason to stay and contribute.

---

## 9. Risks

| Risk | Where it bites | Mitigation |
|---|---|---|
| **Licences** | Qwen-Image 2.1 (research only), FLUX dev (non-commercial), Krea-2 (custom terms with content-filtering conditions), FLUX 3 Klein (Kommunity, reported under-$5M commercial), SAM licence (acceptable-use terms), MiniMax-H3 (reported regional exclusions, UNVERIFIED). A wrong "free for client work" badge would be a real harm to an artist. | Badges are derived from the registry's `licenseGate` and a new explicit `licenceClass` field, with a test that no gated model is badged free. Every new model is checked against its Hugging Face `license:` tag and its card. Never pitch a research or NC model "for client work". |
| **Adobe Exchange review** | Wording (rejected once), a reviewer who cannot install ComfyUI (rejected once), content rules (no adult content), a new Photoshop major (28.0) | Wording test plus the repo description fix (B4). The unlisted CPU install video and Comfy Desktop steps in the reviewer note. Never add an uncensor switch. G7 for 28.0. |
| **Solo-maintainer load** | One person gates every PR in Photoshop. Promotion stalls when posting into communities without standing. No second maintainer. | One PR at a time, already the rule. Claude runs smoke checks via computer use where Mehran allows. Batch promotion into one hour a week, using the calendar above. Contributor docs aim at presets and tests, which need no Photoshop gate. A CODEOWNERS file and an "if I disappear" note. |
| **ComfyUI drift** | Weekly ComfyUI releases (0.44 to 0.45 in weeks). Stalled ComfyUI-GGUF (issues 487/488). Unmaintained IPAdapter_plus (Style Reference). | The G1 snapshot test, plus `npm run object-info -- --check` in the monthly freshness PR (U1). Mark the GGUF and IPAdapter presets as at-risk in Known limitations. Prefer core nodes in new presets. |
| **Photoshop drift** | 28.0 untested; the 27.9 UI backend change. Mehran has no access to Photoshop Beta, per his forum draft. | G7. Post the drafted Creative Cloud Developer Forums question about prerelease access. The roadmap's U6 check on each Photoshop release. |
| **Competition** | Photoshop 28 now ships Relight and Remove related elements natively. OpenFill grows fast on the same privacy pitch in other editors. SD-PPP has 43x our stars. | Compete on what they cannot offer: local, no credits, any model, layers in Photoshop, and workflows you own. Do not chase tool count. |
| **Measuring blind** | No telemetry, by promise | Counts from forms and the API only. Exchange installs read by hand. |
| **Promotion channels closed to Claude** | reddit.com is blocked in both of Claude's browsers; Facebook needs Mehran | Claude drafts and stages; Mehran posts. The calendar keeps that to about one hour a week. |

---

## 10. Skills to add for Claude sessions

These are repeated procedures that today live only in memory notes and get re-derived each session.
As Claude Code skills in `.claude/skills/`, each would load the right steps at the right time. Each
one is its own small PR, built with the skill-creator skill, after the beta. Ranked by how much
re-derivation each saves:

1. **`openlayer-pr`**: the four checks, the PR template with "What Mehran should check in Photoshop" and the smoke blocks the touched files require, wording and `textContent` checks on any new copy, and GitHub Desktop click paths.
2. **`openlayer-release`**: the release steps in CLAUDE.md, plus the traps from memory:
   - `versionConsistency`, not a memorised file list
   - check the PR is merged before tagging
   - `latest` refresh and a hash check against the server's copy
   - the release-body link rewrite
3. **`openlayer-preset`**: add or change a preset end to end. Copy the same-family entry, HEAD-verify URLs, record SHA-256, run an `object_info` check, add the GUI twin, regenerate the setup pack. It ends with "show Mehran a side-by-side before building".
4. **`openlayer-smoke`**: drive the UXP smoke checklist through computer use, with the automation traps:
   - clipboard paste instead of typing
   - 30 steps to make Cancel testable
   - a new document every time
   - window-only captures
   - Load, not Reload, in UXP Developer Tool
5. **`openlayer-metrics`**: one command that snapshots stars, traffic, referrers and release downloads into a dated row, reported as counts.
6. **`openlayer-freshness`**: the monthly U1 checklist: dependencies, `object_info` drift, WFL sweep, setup-pack URLs.

The PAM, WFL and OP agents already cover promotion, model research and painting. They should keep
those jobs, not become skills.

---

## Decisions, one recommendation each

The decisions Mehran most needs to make are first. My recommendation is in bold.

1. **The fallback for testers who do not appear.** **Hold the beta for outside testers until
   2026-12-01. Then G5 and G7 may drop to Wanted, with honest release notes, and G6 may not.** The
   product lead and growth argued for tagging now, because a beta label is itself a recruiting
   tool. QA argued for holding until all of G5, G6 and W1 pass. Holding forever repeats the
   self-perpetuating gate that delayed `.ccx` for three releases. Tagging without a single clean
   install would call something a beta that has never worked away from this machine.
2. **Add G7 (the newest Photoshop, 28.0) as a Required gate line.** **Yes.** Most new Exchange
   installs land on an auto-updated Photoshop, and 28.0 shipped five days ago.
3. **Lift the freeze for B2 (artist names in Workflow dropdowns).** **Yes, as a fix, not a
   feature.** It is text only, option values do not change, and it removes the most visible
   jargon on every tool screen. The UXP engineer's condition: it ships alone, with blocks 0 to 2.
4. **Publish the beta as a normal release, not a pre-release.** **Yes.** `releases/latest` starts
   resolving, and the repo shows a current release for the first time.
5. **The first post-beta build is batch variations, then the redesign screen by screen.**
   **Yes, in that order.** The UX designer wanted the redesign first. Growth wanted visible
   "no credits" value first. Batch variations is one PR, makes the strongest open-source argument
   visible in a clip, and is the base Shots needs.
6. **Keep the 16 tool names; change subtitles, grouping and the Look picker.** **Yes.** Renaming
   costs every quoted page and video.
7. **Seedream.** **No integration.** It is closed (no weights or licence found, 2026-11-15). Its
   strengths are covered locally by Klein edit and multi-reference, Qwen 2.1 RGBA and lettering
   (research only), and future batch-based Shots.
8. **Translations.** **Not in 90 days.** Make new strings extractable first.
9. **Managed ComfyUI install.** **No.** UXP cannot start Python. Lead Getting started with Comfy
   Desktop instead.
10. **Skills.** **Build `openlayer-pr` and `openlayer-release` first, after the beta.**

---

## Sources

All read on 2026-11-15 unless noted. "Secondary" means a third party describing the primary source.

- **H1** Higgsfield plugin page, https://higgsfield.ai/plugins/photoshop
- **H2** Higgsfield help center, external integrations (published 2026-08-01, modified 2026-09-24), https://higgsfield.ai/creator-hub/help-center/integrations/external-integrations-higgsfield
- **H3** Higgsfield changelog, entry "Higgsfield plugin for Photoshop", 2026-06-15 (from page data, summarised), https://higgsfield.ai/creator-hub/changelog
- **H4** Secondary pricing summary, https://www.tryatria.com/blog/higgsfield-review (the pricing page itself rendered no text)
- **S1** ByteDance Seed blog, Seedream 5.5 (2026-11-09), https://seed.bytedance.com/zh/blog/%E7%94%9F%E6%88%90%E6%9B%B4%E7%9C%9F%E5%AE%9E-%E7%99%BE%E8%BD%AE%E7%BC%96%E8%BE%91%E6%9B%B4%E7%A8%B3%E5%AE%9A-seedream-5-5-%E5%8F%91%E5%B8%83 (read via a summary)
- **S2** ComfyUI docs, Seedream 5 Partner Nodes, https://docs.comfy.org/tutorials/partner-nodes/bytedance/seedream-5-lite
- **S3** Layer3 Labs, https://www.layer3labs.io/guides/seedream-5-5-explained; FourWeekMBA, https://fourweekmba.com/ai-bytedance-releases-seedream-5-5-with-up-to-100-edit-rounds/ (secondary)
- **S4** Seedream 4.0 limits, https://runware.ai/docs/models/bytedance-seedream-4-0 (secondary)
- **F1** Voyager, Photoshop generative credits (2026-09-21), https://voyager.so/blog/photoshop-generative-credits (secondary)
- **F2** PhLearn, partner models (October 2026), https://phlearn.com/tutorial/10-days-of-ai-in-photoshop-and-lightroom-day-7/ (secondary)
- **F3** Adobe Community, "Photoshop MAX 2026" (2026-11-10, version 28.0), https://community.adobe.com/announcements-710/photoshop-max-2026-relight-restyle-compare-create-like-never-before-1652100
- **K1** https://github.com/Acly/krita-ai-diffusion (README, API)
- **K2** https://docs.interstice.cloud/installation
- **K3** https://newreleases.io/project/github/Acly/krita-ai-diffusion/release/v1.47.0
- **K4** Krita custom graphs (wiki redirect to docs.interstice.cloud/custom-graph, page not opened)
- **K5** GitHub API: stars, forks, releases, contributors, language files, Discussions count
- **B1** https://github.com/NimaNzrii/comfyui-photoshop; https://comfy.icu/extension/NimaNzrii__comfyui-photoshop
- **B2** https://github.com/zombieyang/sd-ppp
- **B3** https://ph-cu-s.com/ (from search results only)
- **N1** https://github.com/beckettharriman/openfill
- **N2** https://comfyui-wiki.com/en/news/2026-10-27-openfill-photocraft
- **W1** https://comfyui-wiki.com/models/minimax/minimax-h3-image
- **W2** https://magica.com/news/comfyui-v0-41-0-flux-3-image-klein-minimax-lightvae (single secondary source)
- **P1** Adobe Community threads on resolution, throttling and content blocks, via search snippets: https://community.adobe.com/t5/photoshop-ecosystem-discussions/what-is-the-max-resolution-for-generative-fill-in-photoshop-in-2025/m-p/15429176, https://community.adobe.com/questions-404/slow-down-we-can-t-wait-to-generate-more-content-for-you-you-can-try-again-in-a-few-hours-1644207, https://community.adobe.com/t5/photoshop-ecosystem-discussions/generative-fill-guidelines-and-censoring/td-p/14940887/page/2, https://community.adobe.com/t5/photoshop-ecosystem-discussions/frustration-with-generative-ai/m-p/15519896
- **V1** Adobe Community guidelines (snippet), https://community.adobe.com/announcements-96/adobe-community-guidelines-583216
- **V3** https://forum.comfy.org/c/v1-feedback/mac/8
- **Licences**: Hugging Face model API, `license:` tags for Tongyi-MAI/Z-Image-Turbo, black-forest-labs/FLUX.2-klein-4b-fp8, Qwen/Qwen-Image-Layered, Qwen/Qwen-Image-Edit-2511 (apache-2.0), krea/Krea-2-Turbo (other, gated auto)
- **OpenLayer numbers**: `gh api` repos, traffic/views, traffic/clones, traffic/popular/referrers, releases; GraphQL discussions

### UNVERIFIED, collected

- Higgsfield pricing (secondary only), its free-credit amount, and every artist opinion of its plugin.
- Seedream 5.5 resolution and reference count. Whether any licence or weights will appear.
- FLUX 3 Image Klein facts (one secondary source). MiniMax-H3 size, VRAM and licence.
- The licence of the Qwen-Image-Edit relight LoRA.
- Reddit rules and content (blocked). forum.comfy.org guidelines. comfyui-wiki submission process.
- Why ChatGPT referrals fell. What aocr.org is.
- Exchange install count.
- Krita's cloud pricing and Discord size.
- That Photoshop 28.0 loads OpenLayer at all.
