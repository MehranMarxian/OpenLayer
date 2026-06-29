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

## What Is Not Confirmed Yet

- Final image quality
- Correct SD inpaint workflow behavior across checkpoints
- Correct Flux Fill workflow behavior without extra tuning
- Exact mask interpretation for every workflow
- Flux Fill guidance, denoise, mask blur, and context-size tuning
- Perfect Photoshop-native aligned import
- Whether the imported result should be a full canvas, a cropped patch, or transparent outside the mask
- Whether OpenLayer should import a visible patch, a layer mask, or transparent outside-mask pixels
- Whether Photoshop-native layer mask import should replace the disabled UXP canvas compositing experiment

## Current Observed Issue

Generated inpaint output may appear incorrect, gray, patch-like, partial, or disconnected from the source image. The result may not yet be artist-usable.

This does not mean selection capture, mask export, or upload is completely broken. It means the full inpaint pipeline still needs controlled testing inside both Photoshop and ComfyUI.

OpenLayer now retrieves the generated image from the preset's expected `SaveImage` node instead of the first image in ComfyUI history. This avoids accidentally importing uploaded source or mask previews as final output. The transparent PNG compositing experiment is disabled in the active Photoshop path because UXP canvas/blob compositing is not trusted yet. Inpaint uses aligned context import and reports this fallback in diagnostics.

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

Suggested Flux Fill test:

1. Use a small clear selection.
2. Capture Selection and confirm the source and mask previews look correct.
3. Use a simple prompt.
4. If output looks wrong, run the same source PNG and mask PNG directly in ComfyUI, or create a single alpha-masked source image like the bundled Flux Fill bridge does.
5. Compare the result with different denoise, guidance, mask blur, and context size values.
