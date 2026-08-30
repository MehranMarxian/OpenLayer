# Unflatten: Gate Findings

Live results for the questions [`unflatten-v0.20.0.md`](unflatten-v0.20.0.md) put in front
of the UI work. Run from 2026-08-30 against ComfyUI 0.30.0 on 127.0.0.1:8190, RTX 4070 Ti
12 GB, PyTorch 2.13.0+cu130, Python 3.10.11.

**Seven of the eight questions are answered. Q6 alone is open, and it is conditional.**
Two of the answers -- Q7 and Q8 -- were not in the original gate; both were added because
the build plan already depended on assumptions nobody had checked.

**The gate passes**, and it passes differently from the way the plan expected: the axis Q1
names turns out not to be the axis that moves, and the setting the plan assumed a real
document would use turns out to be the one setting that should not ship.

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

## Q1 -- Does the matte hold on a real photograph?

**Answer: yes, when the picture has a discrete subject sitting on visible ground.
Provenance is not the variable at all. Composition is.**

The plan expected the v0.19 result to repeat: that this model family reproduces its own
output more faithfully than it reproduces a photograph. It does not repeat, and the
question as posed has no answer, because the axis it names is not the axis that moves.

The premise needs correcting first. The plan records the spike's source as *"one of
OpenLayer's own Krea-2 generations - the flattering case, not a photograph."* The run
history shows it loaded a `.jpg` stock photograph. **The spike was already a photograph and
it already worked.** What made it the flattering case was its composition -- a figure
standing clear of its background -- not where it came from.

So the axes were crossed instead. Four sources, two compositions, two provenances, same
settings, same seed, `layers: 2`. The generated members were made locally with the shipped
Krea-2 Turbo stack and matched to their photographs by composition.

| Source | Composition | Provenance | Foreground coverage | Separation |
| --- | --- | --- | --- | --- |
| P1 cat | frame-filling close-up | photograph | **0.0%** (alpha max 8) | 2.50 |
| G1 cat | frame-filling close-up | **generated** | **3.1%** | 3.62 |
| P3 portrait | frame-filling close-up | photograph | **0.0%** (alpha max 20) | 2.48 |
| P2 bench | contained subject | photograph | 26.2% | 13.25 |
| G2 bench | contained subject | **generated** | 21.6% | 12.71 |

*Separation* is the mean absolute RGB difference between the background layer and the
composite. Near zero means nothing was moved off the background -- the model handed the
picture back unchanged.

A generated close-up fails exactly as a photographed one does. A photographed contained
subject succeeds exactly as a generated one does. Provenance moves nothing; composition
moves everything.

### The failure mode is benign, and that matters

When it fails it does not produce mush, a halo, or a plausible-but-wrong matte. It returns
**the input as the background layer and a blank plate as the foreground** -- P1's foreground
layer has a maximum alpha of 8 across the entire image, P3's is 20. Both are invisible.

That is a detectable failure. The panel can compare the background layer against the source
and say "this picture could not be separated" rather than importing an empty layer and
letting the artist work out why. Compare v0.19, where the failure was a plausible face that
happened to be the wrong person's -- undetectable by any check, and so it had to be handled
in copy. This one can be handled in code.

### What to tell an artist

Not "works on photographs" and not "works on our generations". **It separates pictures that
have something standing in front of something else.** A close-up that fills the frame has no
front and back to find, and the model says so by giving you nothing.

## Q2 -- How does it behave as layer count rises?

**Answer: four is the number. Two fuses distinct objects together, three is worse than
four, and six pads the result with blank layers.**

One source, one seed, 640px:

| Layers | Time | Separation | Populated | Per-layer coverage |
| --- | --- | --- | --- | --- |
| 2 | 87.7 s | 13.25 | 1 / 1 | 26.2% |
| 3 | 103.8 s | 9.32 | 2 / 2 | 16.0%, 10.2% |
| **4** | **127.2 s** | **19.44** | **3 / 3** | 33.8%, 16.0%, 14.7% |
| 6 | 180.0 s | 14.99 | 2 / 5 | 0.4%, 3.6%, 4.4%, 19.1%, 13.5% |

At four layers the split is genuinely semantic and correctly ordered back to front:
**ground plane, then bench, then person**, each cleanly cut with real alpha. At two layers
the person and the bench are fused into a single plate -- which is what the spike produced,
and why the spike's background looked worse than it needed to.

At six, three of the five layers come back essentially blank. The model does not invent
structure to fill the layers it was given; it leaves them empty. That is the better of the
two possible failures, but it means layer count is a ceiling, not a request.

## Q3 -- How does the 59 s scale?

**Answer: it never OOMs on 12 GB, but the corner the plan called "the setting a real
document would use" takes seven and a half minutes -- and produces a worse result than 640.**

| Resolution | Layers | Time |
| --- | --- | --- |
| 640 (640x424) | 2 | 58.1 s |
| 640 (640x616) | 2 | 87.7 s |
| 640 (640x616) | 3 | 103.8 s |
| 640 (640x616) | 4 | 127.2 s |
| 640 (640x616) | 6 | 180.0 s |
| 1024 (1024x984) | 2 | 247.6 s |
| **1024 (1024x984)** | **4** | **438.0 s** |

Resolution costs slightly worse than linear in pixel count; layer count costs sub-linear
(2 to 4 layers is only 1.45x). Nothing failed to allocate.

The plan's conclusion -- *"It is an ordinary button. It does not need a warning, a walk-away
treatment"* -- holds at 640 and fails at 1024.

**A measurement caveat that nearly poisoned this table:** re-submitting an identical graph
returns in 0.1 s, because ComfyUI caches on graph hash. Warm timings require a changed seed
or they measure the cache. Every number above is a real execution.

### 1024 is not merely slower, it is worse

| Run | Separation | Populated |
| --- | --- | --- |
| 640 x 4, seed 777 | **19.44** | 3 / 3 |
| 640 x 4, seed 778 | **17.63** | 2 / 3 |
| 1024 x 4, seed 777 | 8.59 | 1 / 3 |
| 1024 x 4, seed 778 | 9.11 | 2 / 3 |

Confirmed on two seeds each. The expensive setting separates roughly half as much as the
cheap one and leaves more layers blank, at 3.5x the wall time.

**So the panel should not offer 1024.** Not as a warned option, not as an advanced setting:
it is worse on every axis measured. This is the opposite of the usual quality/time
trade-off, and it is the single most useful thing the timing work produced.

## Q4 -- Is the background layer usable, or merely present?

**Answer: at four layers, usable when the subject occludes flat or uniform ground.
Not usable when it occludes complex structure, and never usable at two layers.**

The bar was declared before the runs: the background is usable if the subject layer can be
moved by roughly 10% of frame width and the revealed region does not read as damage at 100%
zoom.

**At two layers it fails, and the plan's "smear" was not the worst of it.** On the 9.2%
crop the foreground correctly took the bin *and* the person and bench -- but the background
still contained the person and bench. The subject was present on both layers. Moving the
top layer reveals a copy of the subject underneath. On the 68% crop the background kept the
bench and a leg plus a soft wash where the body had been. On the 39.6% crop a shoe was left
behind on the background.

**At four layers, on the same source, it passes.** The background comes back as a complete,
coherent paving surface: no ghost of the subject, no leftover shoe, no hard-edged smear.
Slightly soft in the reconstructed region, but it reads as out-of-focus paving rather than
damage.

**But it depends on what is behind the subject.** The monochrome source (P4), where the man
occludes a wooden market stall rather than flat ground, reconstructed as a **flat grey
block** the size of his body. That is the plan's feared smear, and it is worse than a smear.
Flat ground the model can invent; structure it cannot.

So the honest statement is that layer count controls background quality more than subject
size does, and that the remaining variable is the complexity of what was hidden.

## Q6 -- Is the shippable quant good enough?

**Still open, and still conditional.** Not run. It cannot change the go/no-go and it costs
another 13.2 GB; now that the gate has passed it is worth running before the setup work in
task 5, not before task 1.

The trap recorded earlier stands: quantisation shifts the sample, so fp8 and Q4_K_M at one
seed give two different pictures. The comparison must be made on the layer that stayed most
nearly identical, and the write-up must say when they diverged too far to compare.

## Q7 -- Is the decomposition stable across seeds?

**Answer: the split is stable in kind. The number of populated layers is not.**

At 640 x 4 on one source, seed 777 filled all three layers (33.8%, 16.0%, 14.7% coverage)
and seed 778 filled two, leaving layer 2 blank (0.0%, 21.4%, 23.6%). Both are good
decompositions and both put the same kinds of thing on the same kinds of layer, back to
front. But you cannot promise an artist four layers of content from `layers: 4`.

**Consequence for task 3: the composite at index 0 must be skipped.** Skipping *blank* layers
was also stated here as a task 3 requirement, and that has since been qualified -- see below.

### Skipping blank layers: wanted, deferred, and not by the obvious route

Detecting a blank plate needs its alpha channel, and nothing in this codebase can decode a
PNG. Captures run the other way, from Photoshop's pixels outward, and UXP has no canvas.

The obvious cheap proxy is file size, on the reasoning that a blank plate compresses to
nothing. **Measured across the 63 layers these runs produced, it does not:**

| | Count | PNG size |
| --- | --- | --- |
| Blank (coverage under 1%) | 8 | 201 KB - 845 KB |
| Populated | 55 | 243 KB - 2.3 MB |

The ranges overlap almost completely, and the largest blank plate is bigger than most real
ones. A blank layer is not uniform transparency: it carries ordinary RGB noise underneath a
near-zero alpha, and that noise does not compress away. Any threshold that caught the blanks
would also discard real layers.

So task 3 imports every plate except the composite, and the failure it protects against is
the asymmetric one: an unwanted empty layer is visible in the Layers panel and takes one
click to delete, while a wrongly discarded faint layer is silent data loss. The layers are
named by stacking position so an empty one is obvious rather than mysterious.

Doing it properly needs a downsampled alpha read of each placed layer through the imaging
API. That is a real option and not a large one, but it puts a pixel read inside the
transaction that mutates the artist's document, and it is not worth that risk to save a
click. Worth revisiting once the tool has been used on real work.

## Q8 -- addendum

Confirmed at 2, 3, 4 and 6 layers: `layers: N` returns N+1 outputs, index 0 is the
composite, and layers run back-to-front from index 1. The structural finding recorded above
holds across the whole range now, not just at 2.

## The monochrome question

The v0.19 finding does **not** repeat. FLUX.2 Klein silently colourised sepia portraits;
this model does not colourise a monochrome source.

Measured over visible pixels only -- transparent pixels carry arbitrary RGB and including
them produced a wrong answer on the first pass -- the pure-greyscale source (chroma 0.00)
came back with per-layer chroma of 2.20 to 3.92 on a 0-255 scale. That is a faint cast from
the VAE round-trip, not re-colouring. The extracted man is still a black-and-white
photograph.

The monochrome source also decomposed well despite heavy occlusion: separation 18.46 with
three of three layers populated, comparable to the best run in the set. Its weakness was the
background, recorded under Q4.

---

## The verdict

**The gate passes.** The feature is real, it works on photographs, and at 640 with four
layers it produces a genuinely semantic, correctly ordered, cleanly matted layer stack in
about two minutes.

It passes smaller than the plan imagined in one respect and larger in another. Smaller:
1024 must not be offered, and close-ups cannot be decomposed at all. Larger: the failure is
detectable in code rather than only in copy, and four layers turns out to fix the background
problem the spike blamed on the model.

## What this changes in the plan

- **Two corrections to the plan document itself.** The spike's source was a photograph, not
  a Krea-2 generation, so the "flattering corner" framing was mistaken about which corner it
  was. And "it is an ordinary button" is true at 640 only.
- **Defaults: 640px, 4 layers.** Both are measured optima rather than round numbers.
- **Do not offer 1024** (Q3). Worse separation, more blank layers, 3.5x the time.
- **Cap layer count at 4** (Q2). Six pads with blanks.
- **Task 3 must skip the composite at index 0** (Q8). Skipping blank layers is deferred with
  a measured reason -- file size cannot identify them and nothing here can decode a PNG (Q7).
- **Task 3 needs the scale-to-target-bounds step** (Q5), enlarging direction only.
- **Task 4 should detect and report the close-up failure** (Q1) rather than importing an
  empty layer. Comparing the background layer against the source is enough to catch it.
- **The subtitle cannot promise "any layer".** It separates pictures with a subject in front
  of a background. That belongs in the three places the house pattern requires.
- **Q6 moves to before task 5**, not before task 1.

---

## Reproducing

All runs went through a single harness against the shared ComfyUI on 127.0.0.1:8190,
submitting only its own jobs -- it never interrupts, never clears the queue and never
touches another job. It rebuilds the spike's graph with clean node ids from the settings
recorded above, submits, waits on `/history`, and reports timing from the run's own
`execution_start`/`execution_success` stamps rather than from wall clock.

Outputs are in `output/gate-runs/` (gitignored), named `<run>_layer<N>.png` in batch order.
Sources and their licences are in [`unflatten-gate-sources.md`](unflatten-gate-sources.md).

Two metrics are used throughout and both are worth stating plainly, because a reader should
be able to disagree with them:

- **Separation** -- mean absolute RGB difference between the background layer and the
  composite. It answers "was anything actually moved off the background", which visual
  inspection answers badly when the change is a soft wash.
- **Coverage** -- percentage of the frame where a layer's alpha exceeds 32. It answers "is
  this layer populated or is it a blank plate", which the fully-transparent percentage
  answers badly when a layer is a faint ghost rather than truly empty.

One measurement error is recorded rather than quietly fixed, because it would have produced
a wrong published finding: chroma was first computed across the whole frame, including
fully transparent pixels whose RGB is arbitrary. That reported the monochrome source as
heavily colourised. Measured over visible pixels only, it is not.
