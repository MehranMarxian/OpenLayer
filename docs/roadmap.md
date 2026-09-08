# OpenLayer Roadmap

OpenLayer is a local-first Photoshop UXP plugin for artist-friendly ComfyUI workflows. The roadmap favors a trustworthy foundation before larger creative features.

## Where it is now

Eleven generation tools, all running against a local ComfyUI: Text to Image, Image to Image,
Sketch to Image, Inpaint, Outpaint, Upscale, Prompt from Layer, Live Painting, Style Reference,
Multi-Reference and Unflatten, plus Layer Tools, History, the Prompt Wallet, Workflow Presets,
custom workflow checking, and a Setup screen that checks what you have against what each preset
needs and can download what is missing.

Four of those carry a caveat rather than a clean bill of health, and the list is deliberately
honest rather than short: Inpaint, Outpaint, Multi-Reference and Unflatten. What each one does and
does not do is in [known limitations](known-limitations.md), which is the document to read before
this one.

The foundations under all of it: a preset registry every other surface is derived from, a workflow
health check, GPU-aware model recommendations, LoRA support, results imported as real named layers
with masks and alignment, generation history, cancellation, themes, and an optional MCP bridge that
lets an agent drive the panel.

## What is being worked on

- **Making the experimental four less experimental.** Reliability before reach: nothing new is worth
  as much as one of these becoming something a person can rely on.
- **Unflatten's background quality.** The gate found the bottleneck is not segmentation but what the
  model paints into the hole a subject leaves. Flat ground reconstructs well; a complex scene does
  not. Raising the resolution makes it worse, so the likely route is a masked inpaint pass over the
  background using the crop-and-stitch stacks already shipped.
- **First-run friction.** Every step between downloading the plugin and seeing it work once.

## Still ahead, roughly in order of appetite

- One-click background removal with real alpha, which ComfyUI now has a core node for
- Relighting and compositing harmonisation, so an extracted layer can be matched to its new scene
- Creative and tiled upscaling, rather than the pixel/model enlargement Upscale does today
- A LoRA browser, batch variants and contact sheets
- Guided custom workflow import with node mapping and validation against `/object_info`
- Persistent per-layer generation metadata, so a layer remembers how it was made
- Better guide previews for lineart, depth and pose

## History

Earlier milestones, kept because the reasoning in them still explains why parts of the panel are
shaped the way they are. Everything in this section has shipped.

<details>
<summary>v0.3 stabilization, v0.4 inpainting and masks, v0.6 compact interface</summary>

**v0.3 Stabilization** — GitHub Actions CI for install, type-check, tests and build; unit tests for
pure TypeScript workflow logic; PNG/lossless capture from raw Photoshop Imaging API pixels; clearer
validation errors for custom API workflow remapping; contributor, security and custom workflow docs.

**v0.4 Inpainting And Mask Workflows** — selection bounds capture, selected-region lossless capture,
selection mask export, the `inpaint-basic` and Flux Fill presets, aligned import back into the
original selection context, and the long run of mask-polarity and import-shape decisions behind
them.

**v0.6 Compact UXP Interface** — the compact dashboard with grouped tool rows and clear unavailable
states, sticky tool headers, determinate progress from the numeric WebSocket channel, collapsible
Advanced sections, scrollable prompt fields, and consistent gutters and status tones.

**v0.15 MCP Agent Bridge** — an agentic AI drives the panel's tools from natural language over a
loopback-only bridge speaking MCP to the agent and WebSocket to the panel. Bidirectional, so the
panel can ask the agent for a prompt too. Off by default, with an explicit opt-in before anything
connects. Architecture in [`docs/mcp-bridge.md`](mcp-bridge.md).

</details>

---

Anything not listed here is not refused, just unclaimed. The
[Discussions](https://github.com/MehranMarxian/OpenLayer/discussions) board is the place to argue
for something, and a report that one of the four experimental tools failed on a real picture is
worth more to this list than a feature request.
