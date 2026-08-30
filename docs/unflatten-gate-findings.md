# Unflatten: Gate Findings

Live results for the questions [`unflatten-v0.20.0.md`](unflatten-v0.20.0.md) put in front
of the UI work. Run from 2026-08-30 against ComfyUI 0.30.0 on 127.0.0.1:8190, RTX 4070 Ti
12 GB, PyTorch 2.13.0+cu130, Python 3.10.11.

**This document is incomplete and says so.** Two questions are answered, six are open. The
answered pair is recorded now rather than at the end because both already change the build
plan, and one of them -- Q8 -- was not in the original gate at all.

**A failed gate remains an acceptable outcome.** Nothing below commits the release to
shipping a tool.

---

## Environment

All three model files are on disk and the graph runs:

| File | Folder | Present |
| --- | --- | --- |
| `qwen_image_layered_fp8mixed.safetensors` | `diffusion_models` | yes |
| `qwen_2.5_vl_7b_fp8_scaled.safetensors` | `text_encoders` | yes |
| `qwen_image_layered_vae.safetensors` | `vae` | yes |

`EmptyQwenImageLayeredLatentImage`, `LatentCutToBatch` and `ImageScaleToMaxDimension` are
all registered on this build (2846 classes), so no ComfyUI upgrade is needed. The naming
trap the plan warned about is real and worth repeating: `qwen_image_layered_vae` sits in
the same folder as `qwen_image_vae`, which is Krea-2's, and the wrong one loads far enough
to fail confusingly rather than obviously.

The only download still outstanding anywhere in this plan is the Q4_K_M GGUF for Q6, which
is conditional and last -- it can shrink the setup story but cannot decide go/no-go.

**Verified working settings**, read back from the run history rather than transcribed:
20 steps, CFG 2.5, `euler`/`simple`, denoise 1.0, `ModelSamplingAuraFlow` shift 1.0,
`ImageScaleToMaxDimension` at `largest_size: 640` with lanczos, prompt encoded once for
positive and once empty for negative, both through `ReferenceLatent` off a `VAEEncode` of
the scaled source.

### A note on sources

The two runs behind Q8 used a source image that cannot be published: it is watermarked
commercial stock. Their numbers are reproduced here because the finding is structural and
holds regardless of subject, but the imagery is not, and those runs do not count toward
Q1. Every run from here uses licensed sources (Wikimedia / CC0) recorded in a manifest, as
v0.19 did -- this document is public and the release recording is public with it.

---

## Q5 -- Does the alpha survive the trip into Photoshop?

**Answer: yes, and it was never the risk. The risk is that Photoshop silently resizes the
layer, and nothing in the current import path corrects it.**

This ran first, before any GPU time, because it is the only question that needed no model
and the only one whose failure is unconditional: every other question grades how good the
decomposition is, this one decides whether the product can exist.

### The byte path was already safe, by reading

Nothing between ComfyUI and Photoshop decodes or re-encodes the image:

- `retrieveFirstOutputImage` takes the bytes straight from `fetch().blob()`.
- `saveBlobToTemporaryFile` writes the arrayBuffer with `formats.binary`.
- `placeFileAsLayer` hands that file to `placeEvent`.

There is no canvas, no `toBlob`, no pixel round-trip anywhere on that path. The plan's
"nothing in this codebase has ever moved an alpha channel" is true as history but
overstates the code risk: all seven `applyAlpha: false` sites in `photoshopAdapter.ts` are
`imaging.getPixels` calls, which is the **capture** direction. Import never touches an
alpha option because it never touches pixels.

So the open question was host behaviour, not fidelity.

### The test

Four hand-made RGBA PNGs, every one exactly 1024 x 1024, placed with `File > Place
Embedded` into a document with a saturated green background layer -- green rather than
white specifically because the failure mode *is* white, and white on white is invisible.

| File | Content | What it isolates |
| --- | --- | --- |
| A1 | Opaque square, bottom-left, touching no edge | Binary alpha, and bounds |
| A3 | Opaque square, top-right | Two layers with different opaque regions must register to the same canvas |
| A2 | Full-canvas horizontal alpha ramp, 255 -> 0 | Gradient alpha -- the hair-matte case |
| A4 | 40px fully clear border, feathered interior edge | The realistic layer shape |

A1 and A3 are the pair that matters. If Photoshop trimmed a placed layer to its visible
pixels, the two squares would land in the same place instead of staying diagonal, and a
decomposed stack would come apart layer by layer -- each layer's opaque region is
different, so each would be trimmed differently.

### Results

- **Bounds are preserved.** A1 stayed bottom-left, A3 stayed top-right. No trimming.
  Confirmed twice, in two separate documents.
- **Transparency is real transparency.** The green background shows through everywhere it
  should; the Layers panel thumbnails carry the checkerboard.
- **Gradient alpha holds.** A2's ramp is smooth and A4's feathered edge survived, so this
  is not a binary-cutout-only result.
- **16-bit behaves identically.** Repeated in a 16-bit RGB document with no difference,
  which matters because that is the mode a photographer actually opens.

### The negative result, which is the useful half

The options bar during placement read **`W: 97.66%`**. The document was 1000px tall and the
file is 1024px tall, and 1000 / 1024 = 0.9766 exactly. `placeEvent` **auto-fits an oversized
image down to the canvas**, unasked.

Placing the same file into a 2000 x 2000 document read `W: 100.00%`. So the behaviour is
one-directional: **Place shrinks to fit and never enlarges.**

`alignActiveLayerToBounds` cannot rescue this. It reads the layer bounds, computes an
offset and calls `moveActiveLayerBy` -- it translates, and never scales. Neither does
`centerActiveLayerOnCanvas`.

That is acute for this feature specifically. `ImageScaleToMaxDimension` caps the graph's
output at 640px on the long side, so a layer captured from a 4000px document comes back at
roughly one sixth of the size it has to occupy. Place will not grow it and the aligner will
not either.

**Consequence for task 3: the import must carry an explicit scale-to-target-bounds step.**
Only the enlarging direction needs handling, because the output is always small -- which is
the easier version of this problem, but it does not solve itself.

### What this does not prove

The test exercised Photoshop's `Place Embedded`, which issues the same `placeEvent` command
OpenLayer issues, but it did not go through `importGeneratedImageAsLayer` -- the session
token, the `executeAsModal` wrapper and `alignActiveLayerToBounds` are still untested
against a transparent layer. The byte path is proven by reading and the host behaviour is
proven by this test; the seam between them is not.

Separately: the first attempt used an **artboard** document by accident and was re-run on a
plain one. Whether OpenLayer imports correctly into artboard documents is untested and
unrelated to alpha, but it is now a known gap.

---

## Q8 -- How many images come back, and what order are they in?

**Answer: `layers: N` returns N+1 images. Index 0 is the flattened composite, not a layer.
The layers run back-to-front from index 1.**

This question was not in the plan. It should have been: task 3's acceptance criteria say
"in stacking order" and task 2's say "a run returning N images yields N results in order",
and both sentences assume a mapping nobody had checked.

Measured on the two `layers: 2` runs, which returned **three** images each:

| Output | Fully transparent | Opaque | What it is |
| --- | --- | --- | --- |
| index 0 | 0.0% | 39.7% (rest 251-254) | The flattened composite |
| index 1 | 0.0% | 18.2% (rest 251-254, min 176) | Background -- effectively opaque |
| index 2 | 48.5% | 29.9% | Subject -- real alpha, with a genuine soft gradient |

Compositing index 2 over index 1 reproduces index 0 to a **mean absolute error of 2.87/255**
(p95 = 8). That is VAE round-trip noise. The decomposition is sound, and the identity
confirms which output is the composite rather than leaving it to inspection.

Two things follow:

- **Task 3 must skip index 0.** Importing all N+1 outputs would stack a flat copy of the
  entire picture on top of the group, which would read as an import bug rather than a
  misunderstood contract.
- **Task 2's cost model is N+1 decodes, not N.** Minor, but it belongs in Q3's timing
  arithmetic.

One caveat, and it is a real one: this is verified at `layers: 2` only, on two runs of a
single source. Whether index 0 stays the composite at 3, 4 and 6 layers is folded into Q2's
run list below and must be confirmed before task 3 relies on it.

Worth noting the alpha values on the opaque layers sit at 251-254 rather than a clean 255.
That is VAE quantisation, it is visually opaque, and it needs no handling -- but a future
equality check against 255 would fail, so nothing downstream should write one.

---

## Open questions

Six remain. The run list below is the agreed plan for them; nothing in it has been run yet.

`D` = whatever layer-count default Q2 lands on; 3 until it has one. All runs 640px / fp8
unless the row says otherwise, and the same seed within a group.

| ID | Q | Source | px | Layers | Role |
| --- | --- | --- | --- | --- | --- |
| R1 | all | SP (spike source) | 640 | 2 | **Control** -- reproduce the spike, or stop and fix the environment |
| R2 | Q3 | SP | 1024 | 4 | **Corner probe.** Completes or OOMs; changes everything downstream |
| R3 | Q3 | SP | 1024 | 2 | Resolution axis |
| R4 | Q3/Q2 | SP | 640 | 4 | Layer-count axis; completes the 2x2 with R1-R3 |
| R5 | Q2 | SP | 640 | 3 | |
| R6 | Q2 | SP | 640 | 6 | Do extra layers find structure or invent it? |
| R7 | Q1 | P1 photo, clean separation | 640 | D | |
| R8 | Q1 | G1 generated, matched to P1 | 640 | D | Control for R7 |
| R9 | Q1/Q4 | P2 photo, contact and occlusion, subject ~40% of frame | 640 | D | Also Q4's 40% point |
| R10 | Q1 | G2 generated, matched to P2 | 640 | D | Control for R9 |
| R11 | Q1 | P3 photo, fine matte (hair / fur / foliage) | 640 | D | |
| R12 | Q1 | G3 generated, matched to P3 | 640 | D | Control for R11 |
| R13 | Q1 | P4 monochrome or heavily graded photo | 640 | D | v0.19 found this family silently colourises monochrome |
| R14-15 | Q1 | Worst pair from R7-R12, second seed | 640 | D | Nothing is "reproducible" on one seed |
| R16 | Q4 | P2 cropped, subject ~15% | 640 | D | |
| R17 | Q4 | P2 cropped, subject ~70% | 640 | D | Same picture, three crops -- isolates occlusion fraction |
| R18 | Q4 | Worst of R9/R16/R17 | 1024 | D | Is the smear the model's limit or a 640 artifact? |
| R19-21 | Q7 | G2 | 640 | 3 | Three further seeds; four total with R5 |
| R22-24 | Q6 | **Conditional -- only on a go** | | | Q4_K_M against R1, against the hardest passing source, and at the corner |

**Recorded per run:** source, provenance, resolution, layers, seed, quant; wall time and
whether cold or warm; peak VRAM; verbatim error text on failure; what each output contains
in batch order; whether index 0 is still the composite; matte quality on the hardest edge
in frame (hold / soft halo / hard cut / failed); background layer state (clean / smear /
hole) and the move test below; colour shift against the source; and anything invented that
was not in the source.

**Stop and review after R1, after R2, and after R7-R13.** That third one is the gate's
actual verdict and it gets read before anything else runs, however the earlier runs looked.

### Q1 -- Does the matte hold on a real photograph?

Open. Designed as **matched pairs** rather than the plan's "three photographs against three
generated images of comparable content", because provenance and compositional separability
would otherwise vary together: three busy photographs against three clean generations
measures clutter and reports it as provenance. Each pair holds composition as near constant
as the tools allow, across three archetypes -- clean separation, contact and occlusion, and
fine matte -- plus one unpaired adversarial monochrome source.

The v0.19 finding this inherits is that this model family reproduces its own output far
more faithfully than it reproduces a photograph. The spike's success used an OpenLayer
generation, so it is the flattering corner.

### Q2 -- How does it behave as layer count rises?

Open. 2, 3, 4 and 6 on one source and seed (R1, R5, R4, R6). Also carries the Q8
re-confirmation: index 0 must still be the composite at every layer count.

### Q3 -- How does the 59 s scale?

Open, and deliberately given almost no runs of its own -- every run produces a timing, so
this is a column rather than a question with a budget. The two runs it does need are the
corner (R2) and the resolution control (R3), and the corner goes early because a 20.5 GB
fp8 weight on 12 GB is already offloading at 640; if it will not run at all, the settings
space shrinks and half of Q2 becomes moot.

Every timing is recorded as **warm** -- the second run of that configuration -- with the
cold number noted separately. On this card the first run after a model change pays the
load, and mixing the two would make the curve meaningless.

### Q4 -- Is the background layer usable, or merely present?

Open, with the bar declared in advance so it cannot be moved after the results are in:

> The background layer is **usable** if the subject layer can be moved by roughly 10% of the
> frame width and the revealed region does not read as damage at 100% zoom.

That is the actual reason to want a layer stack. Anything short of it is "present, repaint
before use" -- a legitimate answer that belongs in the subtitle rather than in a support
thread.

Tested as three crops of one photograph rather than three different photographs, so
occlusion fraction is the only variable.

### Q6 -- Is the shippable quant good enough?

Open and **conditional**: it runs only after Q1, Q2 and Q4 say go. It costs another 13.2 GB
and it cannot change the go/no-go decision -- it changes the download size.

Its own trap, which the plan does not name: quantisation shifts the sample, so fp8 and
Q4_K_M at the same seed produce two *different pictures*, and "compare the alpha edge"
degenerates into judging which is prettier. The comparison has to be made on the layer that
stayed most nearly identical between the two, and the write-up has to say explicitly when
they diverged too far for any comparison to be meaningful.

### Q7 -- Is the decomposition stable across seeds?

Open, and added to the gate. Not "is it good" but "is it the same": if one seed splits a
picture into subject and background while another splits it into subject-plus-shadow and
background, the layer *semantics* are unstable. The tool then cannot name its layers,
cannot promise that a re-run improves anything, and the re-roll affordance every other tool
has means something different here.

One generated source, `layers: 3`, four seeds.

---

## What has changed in the plan so far

- **Task 3 gains a scale-to-target-bounds step** (Q5). Only the enlarging direction.
- **Task 3 must skip output index 0** and task 2's "N images" is N+1 (Q8).
- **Q5 is answered and needs no further GPU time**, beyond one remaining seam: the same
  four PNGs through `importGeneratedImageAsLayer` rather than through Photoshop's own Place.
- **Artboard documents are an untested import case**, unrelated to this feature but found
  by it.
