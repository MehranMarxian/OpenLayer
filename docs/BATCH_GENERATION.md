# Batch / multi-variation generation — design

Status: **draft for review**. No code written. Written 2026-08-07.

Generate several variations from one prompt in a single run, look at them, and
import the one that works. Today every generation is one image, so exploring
means clicking Generate repeatedly and losing each previous result.

---

## What is actually true today

Verified against the current tree rather than assumed.

**ComfyUI already batches.** `batch_size` is a plain input on the empty-latent
node, and it is already present in **8 of the shipped workflows**:

| Preset | Latent node with `batch_size` |
| --- | --- |
| `txt2img-basic`, `txt2img-krea2-turbo` | `EmptyLatentImage` |
| `txt2img-flux1-dev-fp8`, `txt2img-z-image-turbo` | `EmptySD3LatentImage` |
| `txt2img-flux2-dev-gguf` | `EmptyFlux2LatentImage` |
| `sketch2img-linecn-basic`, `-scribble-basic`, `-depth-basic` | `EmptyLatentImage` |

The three **img2img** presets do not have one: they build their latent with
`VAEEncode` from the captured layer, so there is no `batch_size` to set. Batching
those needs a `RepeatLatentBatch` node spliced in — the same kind of topology
change the LoRA work introduced, and a separate piece of work from this one.

Inpaint, outpaint, upscale and prompt-from-layer are out of scope: their output
is a patch or a caption tied to one region, and "four variations" is not a
meaningful thing to import.

**Nothing currently reads more than one image back.** `findImageOutput`
(`src/comfy/comfyClient.ts:954`) takes `output.images?.[0]` and returns the
first match; `retrieveFirstOutputImage` wraps it. ComfyUI's history already
contains every image of the batch — the client simply discards them.

**There is no `batchSize` injection name** in `WorkflowInjectionName`
(`src/comfy/types.ts`).

---

## Correcting an assumption

The earlier concern — that batch breaks the generation controller's
one-run-at-a-time invariant (A4) — **does not hold**, and it changed the shape of
this design.

`createGenerationController` (`src/ui/generationController.ts:110`) gates on
*which run is current*: `publish`, `assertCanCommit` and `finish` all compare a
run id. A batch is still **one prompt, one prompt id, one run**. The controller
never inspects the result's shape; `runPipeline` is generic in `TImage` and
simply hands whatever it retrieved to `commit`.

So A4 is untouched. What breaks is narrower and real:

1. **The result type.** `retrieveFirstOutputImage` returns one
   `GeneratedImageResult`; `commit` takes one.
2. **Preview URL ownership (A5).** `createResultPreviewPanel`
   (`src/ui/previewState.ts:99`) owns exactly two URL slots — one result, one
   live frame. N results need N owned slots, all revoked together.
3. **Import.** One result means "Import" is unambiguous. N results is a
   product question, not a plumbing one — see the decisions below.

That reframing means the risky part is the **preview panel and import UX**, not
the run controller.

---

## Proposed design

### Getting N images back

Add `findImageOutputs` alongside `findImageOutput` (keeping the single-image
path untouched for every tool that is not batching), and a
`retrieveOutputImages` that returns `GeneratedImageResult[]`.

`runPipeline` needs no change: `TImage` becomes `GeneratedImageResult[]` for the
batching tools, and `commit` receives the array. The run-integrity gates are
shape-agnostic and stay exactly as they are.

### Setting the batch size

A new `batchSize` injection name, targeting each preset's existing empty-latent
node. **No graph surgery** — this is an ordinary value injection, unlike the
LoRA work. Eight presets get it by adding one line each to their injection map.

### Preview

The result panel gains a **thumbnail strip** under the main image. The main
image shows the selected variation; clicking a thumbnail selects it. With a
batch of 1 the strip is hidden and the panel behaves exactly as it does today —
that fallback is what keeps the change safe for every existing flow.

Ownership: one `OwnedObjectUrl` per variation, released as a set whenever a new
run commits or the panel clears. The existing single `resultUrl` slot becomes
the *selected* one, which keeps `showResult(blob)` working unchanged for
non-batch tools.

### Live preview during the run

Unchanged. ComfyUI streams preview frames for the batch as a single image strip
or the first member depending on the sampler; either way the existing
`showProgress` path handles it, and the thumbnail strip only appears once the
run completes.

---

## Decisions needed before implementation

These change what gets built, so they are yours rather than mine.

### D1 — What does Import do with N images?

| Option | Behaviour |
| --- | --- |
| **A (recommended)** | "Import to Layers" imports **only the selected** variation. One extra button, "Import All", adds every variation as its own layer. |
| B | Import always brings in all N as layers; the artist deletes the ones they do not want. |
| C | Import only ever brings in the selected one; no bulk option. |

A keeps today's one-click behaviour identical for a batch of 1, and makes the
bulk case explicit rather than surprising. B risks dumping four full-size layers
into a document on a single click.

### D2 — Default and maximum batch size

Cost is linear: on the reference machine Krea-2 Turbo is ~38–48 s per image, so
a batch of 4 is roughly 3 minutes. `txt2img-flux2-dev-gguf` measured **207 s for
one image**, so a batch of 4 is ~14 minutes.

Recommendation: **default 1** (today's behaviour, so nothing changes until
asked), **maximum 4**, and a visible time-estimate note once the batch size is
above 1. A different, lower cap specifically for Flux.2 is worth considering.

### D3 — One history entry per run, or per image?

Recommendation: **one entry per imported image**, created at import time rather
than at generation time — history exists to get a result back, and a variation
that was never imported has no layer to return to. This needs confirming against
how `addHistoryEntry` is used today.

### D4 — Does the sketch tool get batching in the first pass?

The three sketch presets can batch with the same one-line injection as txt2img,
since their latent is empty and only the ControlNet reads the captured image. It
is nearly free. The question is whether the thumbnail strip is worth the panel
space on that card in the first pass, or whether pass 1 should be txt2img only.

---

## Staging

1. **Retrieval + injection** — `findImageOutputs`, `retrieveOutputImages`,
   `batchSize` injection on the 8 eligible presets, plus tests. No UI. Nothing
   user-visible changes because the panel still asks for 1.
2. **Preview strip + selection + import** — the real UI work, gated on D1–D4.
3. **img2img batching** — `RepeatLatentBatch` splice, reusing the insertion
   machinery the LoRA work established. Separate piece.

Stage 1 is safe to build before the decisions land; stage 2 is not.

---

## What this design does not do

- No parallel runs. One prompt, one run, one cancel — unchanged.
- No change to how cancellation works: cancelling a batch cancels the whole
  prompt, as it does now.
- No re-roll-one-variation feature. That needs per-image seeds and is a
  different design.
