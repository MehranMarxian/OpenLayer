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
- `img2img-basic.json`
- `sketch2img-linecn-basic.json`

These are the only workflow files that should be treated as working presets.

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

## Why Z_image_Turbo Is Different

`Z_image_Turbo` is not a checkpoint. It is a diffusion model stack.

The local audit found this likely stack:

- `UNETLoader` with `z_image_turbo_bf16.safetensors`
- `CLIPLoader` with `qwen_3_4b.safetensors`
- `CLIPLoader` type `lumina2`
- `VAELoader` with `ae.safetensors`
- `CLIPTextEncodeLumina2`

That means it cannot be safely added to the existing checkpoint selector or reused with `txt2img-basic`.

OpenLayer now has disabled preset metadata for future `Z_image_Turbo` workflows, but generation stays disabled until a real API workflow JSON exists and is validated against local ComfyUI node schemas.

## Why Flux Is Different

Flux workflows also use model-stack style loading instead of the starter checkpoint workflow.

The local audit found:

- `UNETLoader`
- `DualCLIPLoader`
- `CLIPTextEncodeFlux`
- `FluxSampler`

OpenLayer now has disabled preset metadata for future Flux workflows. These presets are not selectable until a real API workflow exists.
