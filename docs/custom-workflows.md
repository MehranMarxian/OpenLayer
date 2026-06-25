# Custom ComfyUI Workflows

OpenLayer does not yet include a visual custom workflow importer. For now, custom workflows are developer-mapped.

## Current Structure

- `src/workflows/source/` contains GUI-editable ComfyUI workflow references.
- `src/workflows/api/` contains runnable API-format workflows sent to ComfyUI.

OpenLayer only submits API workflows.

## Why Mapping Is Required

When OpenLayer runs a workflow, it injects values into specific ComfyUI node IDs:

- prompt
- negative prompt
- checkpoint or model name
- source image name
- width and height
- seed
- steps
- CFG or guidance
- denoise
- ControlNet strength
- selection source image
- grayscale selection mask image

Those node IDs are different in every custom workflow. The mapping lives in `src/comfy/presetRegistry.ts`.

## Inpaint Workflow Status

`inpaint-basic` is an experimental runnable preset in `v0.4.1-alpha`.

The current Inpaint screen can capture Photoshop selection bounds, a selected-region PNG/lossless source image, and a grayscale PNG mask from the active selection. The bundled starter workflow uses:

- `CheckpointLoaderSimple`
- `LoadImage` for the selected-region source
- `LoadImage` for the mask image
- `ImageToMask`
- `CLIPTextEncode`
- `InpaintModelConditioning`
- `KSampler`
- `VAEDecode`
- `ImageCompositeMasked`
- `SaveImage`

The mapping for prompt, negative prompt, checkpoint, source image, mask image, seed, steps, CFG, and denoise lives in `src/comfy/presetRegistry.ts`. If you replace the API workflow JSON, remap those node IDs before testing.

`inpaint-flux-fill-basic` is an experimental Flux Fill preset. It uses a diffusion model stack instead of `CheckpointLoaderSimple`, so the model selector must point to `UNETLoader` models such as `flux1-fill-dev.safetensors`. It also expects `DualCLIPLoader`, `VAELoader`, `CLIPTextEncodeFlux`, `ModelSamplingFlux`, `BasicGuider`, `BasicScheduler`, `KSamplerSelect`, `RandomNoise`, `SamplerCustomAdvanced`, `InpaintModelConditioning`, `ImageCompositeMasked`, and `SaveImage`.

Aligned regional import has started for Inpaint context patches. Selection preservation is still future work.

## Safe Custom Workflow Process

1. Build and test the workflow in ComfyUI.
2. Save the GUI workflow into `src/workflows/source/`.
3. Export the API workflow JSON from ComfyUI.
4. Save the API workflow into `src/workflows/api/`.
5. Add or update a preset in `src/comfy/presetRegistry.ts`.
6. Map every injection target to the correct node ID and input name.
7. Add required node validation.
8. Run:

```bash
npm test
npm run build
```

9. Test inside Photoshop with ComfyUI running locally.

## Common Error Meaning

If OpenLayer says a workflow node or input is missing, the API workflow JSON and `presetRegistry.ts` mapping do not match. Re-export the API workflow or update the mapping.

Future v0.5 work should turn this into a guided importer so artists do not need to edit TypeScript manually.
