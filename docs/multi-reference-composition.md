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

**Reference order matters.** Image 1 sets the output canvas, so the panel must
let an artist reorder references, not just collect them. The prompt refers to
them positionally ("the second image"), so the list order the artist sees has to
be the order the chain is built in.

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

Cheap to test, and they shape the screen:

1. **How many references before it degrades?** Three confirmed. If the ceiling is
   four or five, the UI can be a fixed short list; if it is higher, it needs
   scrolling and a cap.
2. **Does identity hold on real photographs of specific people**, rather than on
   generated sources that the model may find easy to reproduce? This is the
   difference between a fun tool and a useful one.
3. **How sensitive is it to prompt phrasing?** The phrasing that worked verbatim
   was "Use the first image as the background. The man from the second image is
   hugging the woman from the third image, standing together on the beach at
   sunset." If positional references ("the second image") are required, the panel
   should number the reference slots visibly and say so.
4. **Does a masked or cut-out reference beat a full photo** for carrying a person
   without dragging their original background along?

## Sketch of the work

1. Answer the four questions above with live runs. No code.
2. `WorkflowMode` gains `multi-reference`; `WorkflowPreset` gains the Klein
   preset; injections need a **list** shape rather than today's single
   `sourceImage` target, which is the one genuinely new registry concept.
3. A new `AppView` and screen: an ordered reference list with add/remove/reorder,
   per-slot thumbnails and numbering, prompt, and the standard settings block.
4. `App.ts` state moves from `styleReferenceSource`-style singletons to an array,
   with the busy-state and history tables extended to match.
5. Real Photoshop smoke test before anything else is built on top.

Step 1 is the gate. If identity does not hold on real photographs, the shape of
the feature changes and the UI work should not start.
