# OpenLayer Inpainting Status

Inpaint/Repaint Selection is experimental in the current alpha. It is available so testers can help verify Photoshop selection capture, ComfyUI workflow behavior, and layer import, but it is not production-ready yet.

## Current Status

Experimental.

Use this feature for debugging and feedback. Do not rely on it for final artwork until the output quality, mask interpretation, and Photoshop alignment are confirmed stable.

## What Currently Works

- Photoshop selection detection
- Selected-region PNG/lossless source capture
- Grayscale mask preview from the active selection
- Source and mask upload to ComfyUI
- Inpaint generation attempt with mapped experimental presets
- Result preview inside the OpenLayer panel
- Import to Layers for the generated result
- Inpaint debug diagnostics for source, mask, raw result dimensions, output kind, mask polarity, and import mode
- Aligned context import for generated inpaint results
- Separate Inpaint source capture modes for Visible Canvas and Active Layer
- Experimental Photoshop-native layer mask import attempt, with aligned context fallback if Photoshop rejects the mask command

## What Is Not Confirmed Yet

- Final image quality
- Correct SD inpaint workflow behavior across checkpoints
- Correct Flux Fill workflow behavior without extra tuning
- Exact mask interpretation for every workflow
- Flux Fill guidance, denoise, mask blur, and context-size tuning
- Perfect Photoshop-native aligned import
- Whether the imported result should be a full canvas, a cropped patch, or transparent outside the mask
- Whether OpenLayer should import a visible patch, a layer mask, or transparent outside-mask pixels
- Whether Photoshop-native layer mask import is reliable enough to replace the aligned context fallback in all Photoshop documents

## Current Observed Issue

Generated inpaint output may appear incorrect, gray, patch-like, partial, or disconnected from the source image. The result may not yet be artist-usable.

This does not mean selection capture, mask export, or upload is completely broken. It means the full inpaint pipeline still needs controlled testing inside both Photoshop and ComfyUI.

OpenLayer now retrieves the generated image from the preset's expected `SaveImage` node instead of the first image in ComfyUI history. This avoids accidentally importing uploaded source or mask previews as final output. The transparent PNG compositing experiment is disabled in the active Photoshop path because UXP canvas/blob compositing is not trusted yet.

OpenLayer now attempts Photoshop-native masked import for Inpaint by placing the generated context result, aligning it to the captured selection context, and creating a layer mask from the active Photoshop selection. If Photoshop rejects that layer-mask command, OpenLayer falls back to aligned context import and reports the fallback in diagnostics.

Visible Canvas capture includes all currently visible Photoshop layers, including previous OpenLayer result layers. For cleaner inpaint tests, hide old OpenLayer generated layers or use Active Layer capture.

## Next Debugging Checklist

1. Verify the exported source PNG visually.
2. Verify the exported mask PNG visually.
3. Run the same source and mask directly inside ComfyUI.
4. Compare SD inpaint behavior with Flux Fill behavior.
5. Tune mask grow, mask blur, denoise, guidance, and context area.
6. Confirm whether the workflow expects white mask = repaint or black mask = repaint.
7. Confirm whether the imported result should be full canvas, cropped patch, or transparent outside the mask.
8. Decide whether OpenLayer should import with a layer mask or transparent outside-mask pixels.

## Tester Guidance

Start with small selections and SD 1.x inpaint checkpoints. Record the source preview, mask preview, checkpoint, preset, prompt, denoise, CFG, and seed whenever a result looks wrong.

Flux Fill is available only as an experimental path. It may require workflow-specific tuning before it becomes dependable.

## Experimental Flux Fill Setup

The `inpaint-flux-fill-basic` preset is a test path for Flux.1 Fill Dev style inpainting. It is not stable yet.

Expected local ComfyUI files:

- `models/diffusion_models/flux1-fill-dev.safetensors`
- `models/text_encoders/t5xxl_fp16.safetensors` preferred
- `models/text_encoders/t5xxl_fp8_e4m3fn.safetensors` accepted as a T5 fallback
- `models/text_encoders/clip_l.safetensors`
- `models/vae/ae.safetensors`

The workflow follows the reference-style Flux Fill graph saved at `src/workflows/source/inpaint-flux-fill-basic.workflow.json`. It uses `UNETLoader`, `DifferentialDiffusion`, `DualCLIPLoader`, `VAELoader`, `LoadImage`, `CLIPTextEncode`, `FluxGuidance`, `ConditioningZeroOut`, `InpaintModelConditioning`, regular `KSampler`, `VAEDecode`, and `SaveImage`.

The working ComfyUI graph expects one `LoadImage` node that provides both the image and mask. OpenLayer still captures source and mask separately in Photoshop, then builds an alpha-masked PNG for Flux Fill upload. ComfyUI's `LoadImage` reads alpha as `mask = 1 - alpha`, so OpenLayer embeds white repaint mask pixels as transparent alpha.

OpenLayer checks that the captured source PNG and mask PNG both exist, have known dimensions, and match in size before sending Flux Fill to ComfyUI. The current mask polarity assumption is white = repaint.

After generation, OpenLayer records local debug information and temporary copies of the source PNG, mask PNG, and raw result PNG. These files stay local and are intended for tester troubleshooting.

## Context-aware crop and stitch

`inpaint-flux-fill-cropstitch` is the same Flux Fill graph with lquesada's
[ComfyUI-Inpaint-CropAndStitch](https://github.com/lquesada/ComfyUI-Inpaint-CropAndStitch)
wrapped around the sampler. It needs that node pack installed; `inpaint-flux-fill-basic`
does not, and stays the fallback for anyone who has not installed it.

What it changes: `InpaintCropImproved` crops the uploaded context down to the mask
plus 50% of the mask's size in every direction, resizes that to 1024x1024 for
sampling, and hands `InpaintStitchImproved` a stitcher handle that puts the
result back with a 32-pixel blended seam.

Why it matters in Photoshop. OpenLayer already crops on the Photoshop side --
`createInpaintContextBounds` captures the selection plus adaptive padding rather
than the whole document -- so this is not the difference between "the whole
canvas" and "a crop". It is the difference between sampling that captured
context at *whatever size it happened to be* and sampling it at the resolution
Flux Fill was trained for. A 200x200 mask on a 4096x3072 document yields a
context of a few hundred pixels, which Flux Fill renders poorly; a large
selection yields a multi-thousand-pixel context, which is slow and drifts. Both
land on 1024 here.

The stitched output is the same size as the uploaded context, which is what keeps
the translate-only aligned import valid. If that ever stops being true the import
falls back to the context-sized path rather than misplacing the patch, but the
symptom to watch for is a result that is 1024px rather than context-sized -- that
means `SaveImage` is reading the decode rather than the stitcher.

The models are identical to `inpaint-flux-fill-basic`, so switching between the
two costs no extra download.

Suggested Flux Fill test:

1. Use a small clear selection.
2. Capture Selection and confirm the source and mask previews look correct.
3. Use a simple prompt.
4. If output looks wrong, run the same source PNG and mask PNG directly in ComfyUI, or create a single alpha-masked source image like the bundled Flux Fill bridge does.
5. Compare the result with different denoise, guidance, mask blur, and context size values.

## FLUX.2 Klein inpainting

`inpaint-flux2-klein` is the first inpaint preset in the registry that is not Flux Fill. It
reuses the FLUX.2 Klein 4B stack already installed for Text to Image and Image to Image, so it
costs no extra model download; its only extra requirement is lquesada's
`comfyui-inpaint-cropandstitch`, shared with `inpaint-flux-fill-cropstitch`.

The graph:

`LoadImage` (one PNG with the Photoshop mask in its alpha) -> `InpaintCropImproved` ->
`VAEEncode` -> `SetLatentNoiseMask` -> `KSampler` (4 steps, CFG 1, `er_sde`, `simple`,
`ModelSamplingAuraFlow` shift 3), with `ReferenceLatent` carrying the encoded crop into **both**
the positive and the negative conditioning -> `VAEDecode` -> `InpaintStitchImproved` ->
`SaveImage`.

Everything except the crop and stitch pair is core ComfyUI. There is no
`InpaintModelConditioning`, no Fill checkpoint, and no `FluxGuidance`.

**Crop and stitch is not optional here, it is what makes the preset work.** Measured on the
shared ComfyUI instance, three seeds per cell, one 130x190 mask on a 752x1328 image, prompt "a
small black swallow bird tattoo on her bare shoulder skin":

| graph | Klein 4B | Krea2-Turbo |
|---|---|---|
| `SetLatentNoiseMask` + `KSampler`, sampling the whole context | 0/3 | 1/3 |
| the same, cropped to the mask + 50% and sampled at 1024 | **3/3** | 3/3, wrong subject scale |

Sampling the whole captured context, the model reproduces the surroundings and ignores the
prompt: the artist asks for something to be *added* and gets a clean, plausible, empty shoulder.
Cropping raises the masked area's share of the frame, and the prompt lands. The same reasoning
already written up for `inpaint-flux-fill-cropstitch` applies, but for Flux Fill the crop is a
quality refinement; here it is the difference between working and not.

`context_from_mask_extend_factor` is therefore load-bearing, not cosmetic. At the shipped 1.5,
Klein produced a tattoo in 3 of 3 runs; at 3.0 -- a looser crop -- 0 of 3. Widening the context
puts the graph back in the regime that fails.

Denoise stays at 1. `SetLatentNoiseMask` protects the pixels outside the mask, so the usual
image-to-image trade does not apply inside the masked region, and outside-mask pixels came back
within a mean absolute difference of 0.03/255 of the source -- `InpaintStitchImproved`
composites the original back around a 32px blended seam.

### Why LanPaint was evaluated and not adopted

[`scraed/LanPaint`](https://github.com/scraed/LanPaint) (GPL-3.0) was installed on the shared
instance and compared head to head, because research had flagged it as the technique that gives
Klein and Krea2-Turbo a real masked-inpaint path. It does work: `LanPaint_ImageEncode` +
`LanPaint_KSampler` + `LanPaint_ImageDecode` produced a prompt-following result in 3 of 3 runs
where the plain sampler produced 0 of 3 *without* crop and stitch. But crop and stitch fixes the
same failure using a node pack the project already ships and declares, and adding LanPaint on
top of it made Klein slightly worse -- `LanPaint_ImageDecode` and `InpaintStitchImproved` each
composite and blend the patch, and the doubled blend showed at the seam. So: no new dependency.

Three things worth recording from that comparison, because they contradict what the research
notes assumed:

- LanPaint's own Klein example workflow is **9B base** (`flux-2-klein-base-9b-fp8`, the
  `qwen_3_8b` encoder, `CFGGuider` at cfg 5, 20 steps), not the 4B distilled stack OpenLayer
  ships, and it uses `LanPaint_SamplerCustomAdvanced` rather than `LanPaint_KSampler`. The
  "9B versus 4B" contradiction was never a contradiction about conditioning shape.
- The claim that the 4B tier needs plain `InpaintModelConditioning` is wrong. It runs, but it
  is no better than `SetLatentNoiseMask` and does not fix the small-mask failure either
  (1 of 2 runs followed the prompt, and that one produced a literal bird rather than a tattoo).
- `FluxGuidance` is inert on this stack. Inserting it at 1.5 produced a byte-identical image to
  omitting it, so LanPaint's "keep guidance between 1.0 and 2.0 on distilled models" advice
  has nothing to act on here.

### Krea2-Turbo inpainting: tested, not shipped

The same graph on the Krea2-Turbo stack follows prompts but does not match its surroundings. On
a small mask it repaints the whole masked region as a flat patch whose skin tone and detail do
not meet the pixels around it -- visible with a hard-edged mask and still visible with a
feathered elliptical one, so it is not an artefact of the test mask. It also renders the subject
at crop scale rather than scene scale: at `context_from_mask_extend_factor` 1.5 a "small tattoo"
came out filling the shoulder. Two settings improve it and each breaks the other case:
extend factor 2.0 fixes the scale, and denoise 0.7 fixes the tone but then refuses a large-mask
replacement (asked for a red sweater, it kept the white one and reddened the trim). Klein needs
no such compromise, so `inpaint-krea2-turbo` is not in the registry. Reviving it means picking
per-mask-size defaults, which is a UI decision, not a graph one.

### Out of scope

Qwen-Image-Edit-2509's inpaint ControlNet is a real technique, but it is not in the registry at
all, so adding it is a new-model decision rather than an inpaint-preset decision. Still a
"watch" item.
