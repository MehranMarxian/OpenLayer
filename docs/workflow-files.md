# OpenLayer Workflow Files

OpenLayer keeps ComfyUI workflows in two forms.

## API Workflows

Folder:

```text
src/workflows/api/
```

These are runnable ComfyUI API workflows. OpenLayer sends these files to ComfyUI's `/prompt` endpoint after injecting prompts, settings, model names, and source image names.

Current runnable API workflows:

- `txt2img-basic.json`
- `txt2img-flux1-dev-fp8.json`
- `img2img-basic.json`
- `txt2img-z-image-turbo.json`
- `img2img-z-image-turbo.json`
- `sketch2img-linecn-basic.json`

The Flux1-dev fp8 and Z_image_Turbo workflows are experimental and should be tested carefully against the user's local ComfyUI node versions.

## Source Workflows

Folder:

```text
src/workflows/source/
```

These are ComfyUI GUI-editable workflow files. They are meant to be opened, inspected, and edited in the ComfyUI browser interface.

Source workflow files are not submitted directly by OpenLayer. They are project references for artists and developers.

## Adding A New Workflow Safely

1. Build the workflow in the ComfyUI GUI.
2. Save the GUI-editable source workflow into `src/workflows/source/`.
3. Export the API workflow JSON from ComfyUI.
4. Save the API JSON into `src/workflows/api/`.
5. Update `src/comfy/presetRegistry.ts`.
6. Add exact injection targets for prompt, negative prompt, model names, seed, steps, CFG, source image, denoise, or ControlNet strength as needed.
7. Run TypeScript and a production build.
8. Test in Photoshop with ComfyUI running on the active OpenLayer port.

See `docs/custom-workflows.md` for the longer mapping guide.

## Workflow Health Diagnostics

The Settings `Check Workflow Health` action compares registered preset metadata against the active local ComfyUI install. It checks known node classes, required model files, setup-required presets, experimental presets, and missing runnable API workflow JSON files.

This diagnostic pass does not edit workflow JSON, remap node IDs, install models, or change generation behavior. It is a readability and support tool for testers.

Use `Copy Diagnostics` after running Workflow Health to prepare a compact local report for issues or test notes.

## Why Z_image_Turbo Is Different

`Z_image_Turbo` is not a checkpoint. It is a diffusion model stack.

The local audit found and v0.4.3-alpha uses this stack:

- `UNETLoader` with `z_image_turbo_bf16.safetensors`
- `CLIPLoader` with `qwen_3_4b.safetensors`
- `CLIPLoader` type `lumina2`
- `VAELoader` with `ae.safetensors`
- `ModelSamplingAuraFlow`
- `CLIPTextEncode`
- `KSampler` with `res_multistep` and `simple`

That means it cannot appear in `CheckpointLoaderSimple`. OpenLayer must switch the model selector to the diffusion model loader for Z_image_Turbo presets.

OpenLayer now includes experimental API workflows for `txt2img-z-image-turbo` and `img2img-z-image-turbo`. The editable GUI workflow exports are kept under `src/workflows/source/`.

## Why Flux Is Different

Most Flux workflows use model-stack style loading instead of the starter checkpoint workflow. The `txt2img-flux1-dev-fp8` preset is the current exception because the attached working ComfyUI graph loads `flux1-dev-fp8.safetensors` through `CheckpointLoaderSimple`.

The validated Flux1-dev fp8 Text to Image workflow uses:

- `CheckpointLoaderSimple` with `flux1-dev-fp8.safetensors`
- `EmptySD3LatentImage`
- `CLIPTextEncode`
- `FluxGuidance`
- `KSampler`
- `VAEDecode`
- `SaveImage`

OpenLayer maps the UI CFG field to `FluxGuidance.guidance`. The sampler CFG remains `1`, matching the source ComfyUI workflow.

Generic Flux diffusion-model-stack workflows still use model-stack style loading.

The local audit found:

- `UNETLoader`
- `DualCLIPLoader`
- `CLIPTextEncodeFlux`
- `FluxSampler`

OpenLayer now has a runnable experimental `txt2img-flux1-dev-fp8` preset plus disabled preset metadata for future generic Flux workflows. The generic Flux presets are not selectable until a real API workflow exists.
