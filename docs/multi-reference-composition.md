# Multi-Reference Composition (planned for v0.19)

Give several Photoshop layers to one generation, each as a named reference, and
compose them with a prompt:

> "Use the first image as the background. The man from the second image is
> hugging the woman from the third image."

This document was the plan. It is built as of v0.19 development: preset
`multi-reference-flux2-klein`, a Multi-Reference screen, and an MCP
`multi_reference` tool. What follows is kept as the reasoning behind the shape
it took, with the gate results folded in.

> **Read the gate findings first.**
> [`multi-reference-gate-findings.md`](multi-reference-gate-findings.md) answered all
> four open questions on 2026-08-27 and moved two of them. The important one: on
> **real photographs**, wardrobe, props and setting transfer but the specific face
> does not. The example above still works as a composition; it does not put a
> particular man and woman in the frame. Nothing user-facing may promise likeness.

## Why this is its own tool, not a preset

Every capture path in OpenLayer today produces **one** source image. Image to
Image, Sketch to Image, Inpaint, Outpaint, Upscale, Prompt from Layer and Style
Reference all hold a single `ImageSourceState` and a single `sourceImage`
injection target. Multi-reference needs an **ordered list** of captured layers,
each individually previewable and removable, and reference order is
load-bearing (see below). That is a new screen and a new state shape, which is
why it is a release of its own rather than another entry in an existing
Workflow dropdown.

## It is proven, not speculative

Run end to end against a live ComfyUI on 2026-08-27, first attempt: three
generated sources (an empty beach sunset, a blond man in a light blue
button-up on white, a dark curly-haired woman in a red-and-black racing jacket
on grey) produced exactly the requested composite -- correct background, both
identities carried across with their clothing, a natural hug pose, coherent
sunset lighting.

**A control run proves the references did the work.** Same prompt, same seed,
with the `ReferenceLatent` chains removed, the model produced a different
bearded man in a purple t-shirt and a different straight-haired woman in white
against a generic pink sunset. The composition prompt never describes hair or
clothing -- it only says "the man from the second image" -- so text alone
cannot account for the match.

## Mechanism

ComfyUI's own `ReferenceLatent` description states it:

> "This node sets the guiding latent for an edit model. If the model supports it
> you can chain multiple to set multiple reference images."

FLUX.2 Klein supports it. One `ReferenceLatent` per reference, chained into the
positive conditioning, with an identical chain into the negative:

```
CLIPTextEncode -> ReferenceLatent(ref1) -> ReferenceLatent(ref2) -> ReferenceLatent(ref3) -> KSampler.positive
```

Each reference is independently normalised with `ImageScaleToTotalPixels` to
1 MP, then `VAEEncode`d. Sampling size comes from `GetImageSize` on the **first**
reference through `EmptyFlux2LatentImage`.

**Reference order matters**, for two reasons -- neither of which is the one first
assumed here. Image 1 sets the output canvas via `GetImageSize`, and chain order
changes whether secondary objects stay coherent (Q1 in
[`multi-reference-gate-findings.md`](multi-reference-gate-findings.md): moving a
bicycle ahead of a dog fixed a reproducible duplication). Order does **not** drive
prompt binding -- gate testing showed the model type-matches references to the
prompt and ignores positional wording entirely, so the panel does not have to make
slot numbers load-bearing.

### What this costs

Nothing new. It reuses the FLUX.2 Klein 4B stack already installed for
`edit-flux2-klein` and `inpaint-flux2-klein` (Apache-2.0, ungated), and every
node is **core ComfyUI** -- `LoadImage`, `ImageScaleToTotalPixels`, `VAEEncode`,
`ReferenceLatent`, `EmptyFlux2LatentImage`, `GetImageSize`, `KSampler`,
`VAEDecode`. No custom node pack, so nothing third-party to rot. Sampling is
4 steps at CFG 1, `er_sde`/`simple`, shift 3.

This is a materially better foundation than the Style Reference work, which
needed a maintenance-mode pack for the SD 1.5 route and a three-month-old
single-author pack for the Krea-2 route that was ultimately reverted.

## The reframe worth remembering

`ReferenceLatent` was set aside during the v0.18 Style Reference work precisely
because it copies identity and content instead of abstracting style. That is the
wrong property for style transfer and exactly the right one here. The earlier
"defer ReferenceLatent" note was a judgement about style transfer only, and
should not be read as a judgement about composition.

## Open questions to answer before building UI

Answered 2026-08-27 -- full results, seeds and controls in
[`multi-reference-gate-findings.md`](multi-reference-gate-findings.md).

1. **How many references before it degrades?** ANSWERED -- no ceiling to cap at.
   Human identity held at 3, 4, 5 and 6. What breaks is placement of secondary
   objects, and it tracks the kind of object, not the count: a bicycle that has to
   sit behind the couple broke at four references on 3/3 seeds, while a dog and a
   hat were clean at five. Reordering the chain fixed it.
2. **Does identity hold on real photographs of specific people?** ANSWERED -- **no.**
   Four real CC-licensed photographs, control/variant, two seeds: wardrobe, props,
   hair, build and photographic era all transferred, and the specific face did not,
   every time. Even a clean square frontal studio portrait came back re-imagined.
   The model reproduces its own generated output far more faithfully than a
   photograph. The feature still works as *composition* -- it cannot be sold as
   likeness.
3. **How sensitive is it to prompt phrasing?** ANSWERED -- barely. Positional
   wording is decorative: deliberately swapping "second"/"third" changed nothing,
   claiming the background from the wrong slot changed nothing, and dropping
   positional language entirely still produced both correct identities. The model
   type-matches. The panel does **not** need to number slots for correctness.
4. **Does a masked or cut-out reference beat a full photo?** ANSWERED -- no, and
   the premise was wrong. A full photo does not drag its background along; a
   cluttered-kitchen source leaked nothing. Cut-out, full photo and prompt-scoped
   were indistinguishable. No masking subsystem is needed. Partial extraction by
   prompt (take the jacket, not the wearer) does work.

## Sketch of the work

1. ~~Answer the four questions above with live runs. No code.~~ Done -- all four,
   48 runs.
2. ~~`WorkflowMode` gains `multi-reference`; `WorkflowPreset` gains the Klein
   preset.~~ Done. The list shape did **not** land as a new injection kind: an
   injection sets a value on a node the shipped graph already has, and here the
   number of nodes is what varies. It is a `referenceChain` declaration plus a
   build-time clone instead, alongside `loraInsertion` as the second place a
   workflow's topology changes.
3. ~~A new `AppView` and screen.~~ Done: an ordered reference list with
   add/remove/reorder and per-slot thumbnails. No masking or cut-out controls
   (Q4), no cap below the measured range (Q1), and no width, height or denoise
   -- reference 1 sets the canvas and denoise is fixed at 1.
4. ~~`App.ts` state moves to an array~~, with the busy tables gating Compose on
   the list being non-empty rather than on a single source. The list operations
   live in `src/ui/multiReferenceList.ts` rather than the `App.ts` closure,
   because an off-by-one there silently changes which layer sets the canvas.
5. **Real Photoshop smoke test** -- still outstanding, and the only thing between
   this and being shippable. Everything above is verified against live ComfyUI
   and in a browser-rendered panel, neither of which is the UXP host.

The gate did its job: questions 1, 3 and 4 came back favourably and shrank the
screen rather than growing it, and question 2 shrank the claim instead. The
feature composes; it does not place a specific person, and nothing user-facing
says otherwise.
