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

## What Is Not Confirmed Yet

- Final image quality
- Correct SD inpaint workflow behavior across checkpoints
- Correct Flux Fill workflow behavior without extra tuning
- Exact mask interpretation for every workflow
- Flux Fill guidance, denoise, mask blur, and context-size tuning
- Perfect Photoshop-native aligned import
- Whether the imported result should be a full canvas, a cropped patch, or transparent outside the mask
- Whether OpenLayer should import a visible patch, a layer mask, or transparent outside-mask pixels

## Current Observed Issue

Generated inpaint output may appear incorrect, gray, patch-like, partial, or disconnected from the source image. The result may not yet be artist-usable.

This does not mean selection capture, mask export, or upload is completely broken. It means the full inpaint pipeline still needs controlled testing inside both Photoshop and ComfyUI.

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
