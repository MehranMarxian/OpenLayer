# Multi-Reference Composition (planned for v0.19)

Give several Photoshop layers to one generation, each as a named reference, and
compose them with a prompt:

> "Use the first image as the background. The man from the second image is
> hugging the woman from the third image."

This document is the plan. Nothing in it is built yet.

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
2. **Does identity hold on real photographs of specific people?** STILL OPEN --
   every source tested was model-generated. A deliberately messy candid source
   (cluttered kitchen, tungsten light) carried perfectly, which covers the hard
   part of real-photo conditions, but real photographs have not been tested. This
   remains the gate on whether the feature is useful rather than fun.
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

1. ~~Answer the four questions above with live runs. No code.~~ Done for 1, 3 and
   4; question 2 (real photographs) still needs source images to test with.
2. `WorkflowMode` gains `multi-reference`; `WorkflowPreset` gains the Klein
   preset; injections need a **list** shape rather than today's single
   `sourceImage` target, which is the one genuinely new registry concept.
3. A new `AppView` and screen: an ordered reference list with add/remove/reorder,
   per-slot thumbnails, prompt, and the standard settings block. No masking or
   cut-out controls (Q4), and no cap on the list length (Q1).
4. `App.ts` state moves from `styleReferenceSource`-style singletons to an array,
   with the busy-state and history tables extended to match.
5. Real Photoshop smoke test before anything else is built on top.

Step 1 is the gate. Questions 1, 3 and 4 came back favourably and shrank the
screen rather than growing it. Question 2 is the one that can still change the
feature's shape: if identity does not hold on real photographs, the UI work should
not start.
