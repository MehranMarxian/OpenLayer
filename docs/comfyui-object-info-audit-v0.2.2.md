# ComfyUI Object Info Audit For OpenLayer v0.2.2

Date: 2026-06-24  
Server: `http://127.0.0.1:8190/object_info`

This audit records the local ComfyUI node classes OpenLayer inspected before adding disabled future metadata for Z_image_Turbo and Flux workflows.

## Important Installed Node Classes

| Purpose | Local class | Required inputs |
| --- | --- | --- |
| SD/SDXL checkpoint loading | `CheckpointLoaderSimple` | `ckpt_name` |
| Diffusion model loading | `UNETLoader` | `unet_name`, `weight_dtype` |
| CLIP loading | `CLIPLoader` | `clip_name`, `type` |
| Dual CLIP loading | `DualCLIPLoader` | `clip_name1`, `clip_name2`, `type` |
| VAE loading | `VAELoader` | `vae_name` |
| Basic text encoding | `CLIPTextEncode` | `text`, `clip` |
| Flux text encoding | `CLIPTextEncodeFlux` | `clip`, `clip_l`, `t5xxl`, `guidance` |
| Lumina2 text encoding | `CLIPTextEncodeLumina2` | `system_prompt`, `user_prompt`, `clip` |
| Basic sampling | `KSampler` | `model`, `seed`, `steps`, `cfg`, `sampler_name`, `scheduler`, `positive`, `negative`, `latent_image`, `denoise` |
| Flux sampling | `FluxSampler` | `model`, `conditioning`, `latent_image`, `sampler_name`, `scheduler`, `steps`, `denoise`, `noise_seed` |
| Empty latent | `EmptyLatentImage` | `width`, `height`, `batch_size` |
| SD3 latent | `EmptySD3LatentImage` | `width`, `height`, `batch_size` |
| Flux latent | `EmptyFlux2LatentImage` | `width`, `height`, `batch_size` |
| Image loading | `LoadImage` | `image` |
| Image saving | `SaveImage` | `images`, `filename_prefix` |
| Image to latent | `VAEEncode` | `pixels`, `vae` |
| Latent to image | `VAEDecode` | `samples`, `vae` |
| LineArt preprocessor | `LineArtPreprocessor` | `image` |
| ControlNet loading | `ControlNetLoader` | `control_net_name` |
| ControlNet apply | `ControlNetApplyAdvanced` | `positive`, `negative`, `control_net`, `image`, `strength`, `start_percent`, `end_percent` |

## Detected Model Lists

CheckpointLoaderSimple reported:

- `epicrealism_naturalSinRC1VAE.safetensors`
- `epicrealism_pureEvolutionV5-inpainting.safetensors`
- `flux1-dev-fp8.safetensors`
- `model.safetensors`
- `sd3.5_large.safetensors`
- `sd3_medium_incl_clips_t5xxlfp8.safetensors`
- `sd_xl_base_1.0.safetensors`
- `sd_xl_refiner_1.0.safetensors`

UNETLoader reported:

- `flux1-dev.safetensors`
- `flux1-fill-dev.safetensors`
- `z_image_turbo_bf16.safetensors`

CLIPLoader reported:

- `clip_g.safetensors`
- `clip_l.safetensors`
- `qwen_3_4b.safetensors`
- `t5xxl_fp16.safetensors`
- `t5xxl_fp8_e4m3fn.safetensors`

VAELoader reported:

- `ae.safetensors`
- `ae.sft`
- `diffusion_pytorch_model.safetensors`
- `pixel_space`

ControlNetLoader reported:

- `control_v11p_sd15_inpaint_fp16.safetensors`
- `control_v11p_sd15_lineart_fp16.safetensors`
- `control_v11p_sd15_scribble_fp16.safetensors`
- `controlnet.safetensors`
- `diffusion_pytorch_model.safetensors`

## v0.2.2 Decision

OpenLayer should not add Z_image_Turbo or Flux to the current checkpoint selector.

Reason:

- `txt2img-basic`, `img2img-basic`, and `sketch2img-linecn-basic` are checkpoint-based workflows.
- Z_image_Turbo appears in `UNETLoader`, not `CheckpointLoaderSimple`.
- Flux also has dedicated stack-style loaders and text encoding requirements.

OpenLayer now stores disabled preset metadata for these future workflows, but they remain non-runnable until matching API workflow JSON files exist and pass validation.
