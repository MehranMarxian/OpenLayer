# Unflatten - v0.20.0 plan

Written 2026-08-30, after the feasibility spike. This is the shared written plan
for v0.20.0 in the sense of `ORCHESTRATION.md` section 5a: the numbered task list
with per-task acceptance criteria that Codex and the reviewing assistant both
work from.

## The feature

**Unflatten.** Hand the panel a flat Photoshop layer, get the picture back
decomposed into separate layers with real transparency, imported into the open
document in stacking order.

Card subtitle: "Split a flat layer into separate layers with transparency."
Status on arrival: experimental. It groups with the tools that act on a layer you
already have - Prompt from Layer, Upscale - not with Generate, because it makes
nothing new.

The model is Qwen-Image-Layered, run locally through ComfyUI. Every node in the
graph is core ComfyUI; there is no new node package. Nothing else in this space
puts a decomposed layer stack into a host application - the ecosystem's current
answer to "what do I do with the output" is a `.psd` save node, which is a
confession that the technique has nowhere to go. That is the opportunity, and it
is a Photoshop-plugin opportunity specifically: a layered result is worth very
little in a web UI and nearly nothing in a canvas app.

## What the spike established

One run, 2026-08-30, on the verified machine.

| | |
|---|---|
| Settings | fp8mixed, 640px, `layers: 2` |
| Time | **58.98 s** |
| Alpha edge on hair | Held. Individual strands survive against the checker, no halo, no hard cut line. |
| Background layer | A smeared patch where the subject occluded the road. Clean elsewhere. |
| Source | One of OpenLayer's own Krea-2 generations - the flattering case, not a photograph. |

The timing matters more than it looks. Klein is 11.6 s and Krea-2 Turbo is
38-48 s, so at 59 s Unflatten is the slowest tool in the panel but in the same
family. It is an ordinary button. It does not need a warning, a walk-away
treatment, or a different progress design.

The two untested things are why phase one exists.

## Models

Three files, roughly 30 GB, none shared with any existing preset. Two different
Comfy-Org repositories, all ungated, no licence click-through.

| File | Size | Folder | Repo |
|---|---|---|---|
| `qwen_image_layered_fp8mixed.safetensors` | 20.5 GB | `diffusion_models` | `Comfy-Org/Qwen-Image-Layered_ComfyUI` |
| `qwen_2.5_vl_7b_fp8_scaled.safetensors` | 9.4 GB | `text_encoders` | `Comfy-Org/Qwen-Image_ComfyUI` |
| `qwen_image_layered_vae.safetensors` | 242 MB | `vae` | `Comfy-Org/Qwen-Image-Layered_ComfyUI` |

Two traps worth a comment in the registry when these are added:

- The layered VAE is **not** `qwen_image_vae.safetensors`, which is already on
  disk for Krea-2. The names differ by one word and the wrong one loads far
  enough to produce a confusing failure rather than an obvious one.
- The text encoder is not in the layered repository. That repository has no
  `text_encoders` folder at all, which is what sends people to the wrong file.

The bf16 weight in that repo is 40.9 GB and will not run on 12 GB. Q4_K_M GGUF at
13.2 GB is the candidate for reducing the download; see Q6.

## Environment note

The verified machine runs **PyTorch 2.13.0+cu130**, ComfyUI 0.30.0, Python
3.10.11, RTX 4070 Ti 12 GB. `.claude/agents/WFL.md` states 2.6.0 as a verified
fact; that is stale and should be corrected, because it is load-bearing for every
recommendation that agent makes about what will run.

All three layered-specific node classes are present on 0.30.0:
`EmptyQwenImageLayeredLatentImage` (width, height, layers, batch_size),
`LatentCutToBatch`, `ImageScaleToMaxDimension`. No ComfyUI upgrade is required.

## Phase one: the gate

No UI code until this is written up. Output is
`docs/unflatten-gate-findings.md`, in the shape of
`docs/multi-reference-gate-findings.md`: control/variant pairs, the same seed
within a pair, and every negative result recorded rather than dropped.

The reason for the discipline is the same as it was in v0.19. Three of that
release's four gate answers shrank the feature that got built, and the fourth
became the limitation stated in three places. The spike result above is real, but
it is the optimistic corner of the space.

**Q1. Does the matte hold on a real photograph?**
Three photographs against three generated images of comparable content. The v0.19
finding predicts the generated sources will look markedly better. If the
photographs fall apart, the honest tool is "decompose your generated layers", not
"decompose your client's photo" - a much smaller product, and better known now.

**Q2. How does it behave as layer count rises?**
2, 3, 4, 6 on one source and seed. Two things to watch: whether extra layers find
real structure or begin inventing it, and whether the background smear seen at 2
improves or worsens. The answer sets the panel's default and its cap.

**Q3. How does the 59 s scale?**
Measured: 640px, 2 layers, 58.98 s. Unknown: cost per added layer, and the jump to
1024. Multi-reference cost a flat +4 s per reference; if layer count behaves the
same way, this stays an ordinary button at every setting. If it multiplies, the
panel needs a cap and the screen has to say why.

**Q4. Is the background layer usable, or merely present?**
The smear is the one visible defect so far. Test whether it scales with how much
of the frame the subject occupies, and whether it is the model's limit or an
artifact of 640. A background layer that needs repainting anyway is worth saying
out loud rather than shipping quietly.

**Q5. Does the alpha survive the trip into Photoshop?**
Not a ComfyUI question, and the riskiest item here. Nothing in this codebase has
ever moved an alpha channel: captures run `applyAlpha: false` and every import to
date has been opaque RGB. Spike this on a hand-made RGBA PNG through the real
import path before trusting a model output through it.

**Q6. Is the shippable quant good enough?**
fp8mixed (20.5 GB, offloads hard) against Q4_K_M (13.2 GB), same source. Compare
the alpha edge specifically, since that is where quantisation damage shows. This
model is documented as unusually quantisation-sensitive - the 3-bit builds came
back as noise before being re-cut. If Q4_K_M holds, the download drops by 7 GB
and the setup story gets materially easier.

**A failed gate is an acceptable outcome for this release.** If photographs come
back as mush and four layers at 1024 takes nine minutes, the write-up is the
deliverable and v0.20.0 becomes something else. That is still worth more than
another checkpoint preset.

## Phase two: the build

Ordered by dependency.

### 1. The preset and the workflow pair

Source-format and API-format workflows under `src/workflows/`, plus a registry
entry naming models, node classes and injection points. One injection is new to
the project: **layer count**, on `EmptyQwenImageLayeredLatentImage.layers`.

Acceptance: `workflowSourceEquivalence` passes for the new pair; the preset
appears in the Workflow Presets catalogue with its three models listed;
`npm run setup-pack` output includes them.

Delegable under section 5a.

### 2. Retrieve more than one image from a run

`comfyClient` reads `outputs[node].images?.[0]` in two places, and everything
downstream - `runPipeline`, the preview panel, the result contract - assumes one
image per generation. This is the first tool that returns several, and the change
propagates upward.

Acceptance: a run returning N images yields N results in order; every existing
single-image tool behaves identically; the single-run contract (A4) and run-id
gating are untouched.

Not delegable.

### 3. Import N layers, in order, with alpha, in one transaction

The heart of the feature and the highest-risk change in the release. N placements
in stacking order inside a layer group named for the source, each aligned to the
captured bounds, all inside a single transaction bound to the originating
document (A1) and cleaning up completely on failure (A3). Plus alpha, which this
codebase has never carried through an import.

Acceptance: a failure at layer 3 of 5 leaves the document exactly as it was
found; the group lands above the source layer; transparency is real transparency
rather than white; the PR carries a literal click-path smoke checklist.

**Not delegable** - this is import-class host code under section 5a.

### 4. The tool card and screen

`id: "unflatten"`, experimental, capture source, a layer-count control, and
whatever progress treatment Q3 concludes is warranted.

Acceptance: card inventory tests updated; the screen respects both themes; the
four compact-theme CSS traps in `ORCHESTRATION.md` section 3 are checked before
any new rule is written.

Delegable.

### 5. Setup entries for the three models

With the VAE naming trap called out in the entry itself.

Acceptance: Setup lists all three with correct folders and sizes; "What will run
well" rates the preset honestly against 12 GB rather than optimistically.

Delegable.

### 6. `unflatten` joins the MCP bridge

Tenth bridged tool, same boundary as the other nine: an agent can set parameters
and press the button, and cannot capture a source. Whatever Q1 concludes about
photographs goes in the tool description, the way the likeness limit did for
`multi_reference`.

Acceptance: the capability is published through the existing `syncBusy` snapshot
rather than a second gate in the handler.

Delegable.

### 7. The write-up, and the honest subtitle

`docs/unflatten-gate-findings.md` ships with the feature, and whatever the gate
found that constrains the tool is stated in three places: the subtitle, the
in-panel info note, and the MCP tool description. That triple is the house
pattern now, and it is the reason anyone believes the good half.

Acceptance: no claim in the README, the CHANGELOG or the panel that the gate
findings do not support.

Not delegable.

### 8. One recording, thirty seconds, uncut

Layers panel visible throughout. A flat photograph goes in; a group of named
layers arrives; one is dragged aside on camera to show the transparency is real.

This is the asset the release is judged on and the only thing here that nobody
else can currently film. It also clears the standing asset gap: the newest
screenshot of this product is still v0.6 UI from 2026-07-17.

## What is still open

- **The timing curve.** The base case is answered. How it scales to four layers
  at 1024 - the setting a real document would use - is not.
- **Alpha through UXP.** Unverifiable outside Photoshop, unprecedented in this
  codebase, and load-bearing for the whole feature. Spike it early rather than
  discovering it at task 3.
- **The 30 GB.** Unflatten shares nothing with the existing stacks. It is the
  largest single addition the setup manifest has taken, and the Setup screen's
  framing has to carry it.
- **Reach.** 86 release-asset downloads across 21 releases, zero issues ever
  opened. Nothing in this plan fixes that except task 8.
