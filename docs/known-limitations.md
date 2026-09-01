# What works, and what does not

OpenLayer is an alpha. This page is the honest version of both halves — what is built and
tested, and where it stops. Nothing here is a bug report; these are the known edges.

## Working foundation

- Photoshop UXP panel scaffold for Photoshop 2024+
- Dark, minimal UXP-friendly TypeScript UI
- Photoshop-dark Home dashboard with Text to Image, Image to Image, Sketch to Image, Inpaint, Prompt from Layer, Settings, History, and future workflow cards
- Experimental Outpaint card and screen for Flux Fill canvas expansion testing
- Configurable local ComfyUI server URL
- ComfyUI connection check
- Checkpoint/model selector loaded from ComfyUI
- Settings page with saved local defaults and diagnostics
- Settings hardware advisor for detecting ComfyUI GPU/VRAM and recommending safe model families
- Session history for recent generated images
- `txt2img-basic` workflow generation
- Experimental `txt2img-z-image-turbo` workflow generation
- `img2img-basic` workflow generation foundation
- Experimental `img2img-z-image-turbo` workflow generation foundation
- `sketch2img-linecn-basic` Sketch to Image generation foundation
- Experimental `prompt-from-layer-florence2` text workflow with Task and Num beams controls
- Experimental `upscale-basic` pixel/model upscale workflow
- Active-layer or visible-canvas source capture and ComfyUI image upload
- Experimental Inpaint/Repaint Selection screen with Photoshop selection detection, selected-region PNG source capture, grayscale mask export, and SD 1.x `inpaint-basic`
- Experimental checkpoint mode for trying non-SD/SDXL model families with clear warnings
- `/prompt` submission
- `/history/{prompt_id}` polling
- `/view` image retrieval
- Result preview in the panel
- Import result into the active Photoshop document as a new layer

Future placeholders are included for regional import alignment and selection preservation.

## Known boundaries

- **Unflatten needs a subject standing in front of a background.** A close-up that fills the frame has no front and back to find: it comes back with the picture unchanged on the background layer and empty layers above it. This is true of photographs and generated images alike — it is about the composition, not the source. The panel cannot detect this and say so, because deciding it needs the image's alpha channel and nothing in a UXP panel can decode a PNG; two cheap proxies were measured and both failed. So the limit is stated on the screen, in the tool description an agent reads, and here.
- **The background layer is softer than the original; the layers in front are not.** The decomposition runs at 640px because higher resolution measurably separates worse. Rather than import that re-render, every layer in front of the background is rebuilt from your captured layer's own pixels wearing the model's matte, so the subject stays at the resolution you captured and only its cut edge is soft. That edge comes from the 640px matte, which makes it a starting point rather than a production cut-out — Photoshop’s own Select and Mask refines it far better than anything the panel could do, and the layer masks are there to be refined. The background cannot work that way — it holds content the model invented to fill the hole the subject left, which by definition is not in your source — so it arrives at 640 and repainting it is expected.
- **The number of layers you ask Unflatten for is a ceiling, not a promise.** A four-layer run may come back with only two carrying anything, and which ones varies with the seed. Empty plates are left out rather than imported, and the layers that remain are renumbered so there are no gaps — so asking for four and receiving two is the tool working, not failing. A plate that is faint rather than truly empty can still slip through.
- **Multi-Reference Composition does not preserve a specific person's likeness.** It carries clothing, props, setting and lighting from a reference; a person's face comes back as a plausible stranger rather than the person photographed, confirmed against four real photographs and dozens of Klein-generated sources. Treat it as scene composition, not as a way to put someone recognisable into a picture.
- **The reference list is capped at 8**, a sanity bound rather than a measured quality limit — testing found no reference count at which composition degraded, up to 6. Reference order matters more than count: an object that has to sit behind the other subjects is more likely to render cleanly if it comes earlier in the list.
- **The Agent Bridge is not in the `.ccx`/`.zip` download.** A Photoshop plugin package cannot install or start a Node program, so it lives in the repository — see `bridge/README.md`. It is off by default in the panel either way. "Ask the Agent for a Prompt" additionally depends on your AI client supporting MCP *sampling*, which is optional in the protocol; a client that does not offer it gets a clear, instant refusal rather than the button working.
- **The Setup screen downloads missing models, but not custom nodes.** A missing model's row offers **Download** beside Copy Link, and OpenLayer fetches the file from the URL the registry pins — in resumable 8 MiB chunks, one model at a time, and never before a confirmation naming the size, the destination folder and the download host. What it will not do is unchanged and deliberate: licence-gated weights are never fetched anonymously, because an unauthenticated request saves an HTML sign-in page under the model's filename; a model already on disk in the wrong folder asks you to move it rather than downloading a second copy; and an entry published as a repository folder rather than a single file points you at the model page. Custom node packages keep Copy Link and go through ComfyUI-Manager. Full reasoning in the CHANGELOG.
- The **Flux.2 GGUF preset is slow on a 12 GB card**: minutes per image, not seconds, and its text encoder is licence-gated, so accept the licence in a browser and download it by hand.
- "What will run well" rates on published model weight sizes against reported VRAM. It is not a measurement of VRAM use during a run, and a preset with an unpublished model size is reported as unknown rather than guessed at.
- Setup and Check Workflow Health overlap on purpose. Setup answers what you need and where it goes; Health answers whether a given preset can run right now.
- Image to Image is an early foundation path, not a full production workflow yet.
- Sketch to Image has five presets: three SD 1.x ControlNets (LineArt, Scribble, Depth) and two Z_image_Turbo presets that read the sketch through Alibaba-PAI's Z-Image Fun ControlNet Union patch -- `sketch2img-zimage-fun-controlnet` (lite, 2.0 GB, faster) and `sketch2img-zimage-fun-controlnet-full` (6.7 GB, slower). Neither Z_image_Turbo preset replaced the other, because they measured as complementary rather than ranked: the full weights render shaded or densely drawn work more photographically, while the lite weights hold bold sparse line art that the full weights flatten into a filled shape at any control strength. Their default control strengths differ for the same reason -- 1.0 for lite, 0.6 for full, which patches five times as many layer blocks. The SD 1.x presets are tested with `epicrealism_naturalSinRC1VAE.safetensors` and their respective `control_v11p_sd15_*` ControlNets; the Z_image_Turbo presets with `z_image_turbo_bf16.safetensors` and, respectively, `Z-Image-Turbo-Fun-Controlnet-Union-2.1-lite-2602-8steps.safetensors` and `Z-Image-Turbo-Fun-Controlnet-Union-2.1.safetensors`.
- Active-layer and canvas capture now encode raw Photoshop Imaging API pixels as PNG/lossless source images.
- Inpaint can detect and capture the selected rectangular region as a PNG/lossless source image.
- Inpaint now attempts a temporary-layer grayscale PNG mask export and can run the experimental SD 1.x `inpaint-basic` workflow when ComfyUI has the required nodes.
- Inpainting is available for testing, but output quality and Photoshop alignment are not confirmed stable yet.
- Inpaint has three presets: `inpaint-basic` (SD 1.x), `inpaint-flux-fill-basic` (Flux Fill), and `inpaint-flux-fill-cropstitch` (Flux Fill with crop-and-stitch). The crop-and-stitch preset requires lquesada's `comfyui-inpaint-cropandstitch` custom-node package; without it the preset is unavailable and the original Flux Fill preset still works.
- `img2img-basic` is the default SD 1.x/SDXL preset. SD3, SD3.5, and Flux checkpoints remain visible but are marked experimental because they usually need dedicated future workflow presets.
- Z_image_Turbo presets are experimental and use `UNETLoader`, `CLIPLoader`, and `VAELoader` instead of the checkpoint loader.
- `txt2img-flux1-dev-fp8` is an experimental checkpoint-style Flux Text to Image preset for `flux1-dev-fp8.safetensors`.
- FLUX.2 Klein presets (`txt2img-flux2-klein`, `img2img-flux2-klein`, `edit-flux2-klein`) use `flux-2-klein-4b-fp8.safetensors` (4.07 GB), `qwen_3_4b.safetensors` (8 GB, shared with Z_image_Turbo), and `ae.safetensors` (336 MB). Klein is Apache-2.0 and ungated. `edit-flux2-klein` is structurally different from image-to-image: it uses `ReferenceLatent` conditioning at denoise 1, not a starting latent at partial denoise.
- Full-precision Flux1-dev Text to Image and Image to Image presets have been removed rather than left disabled. The bf16 weight is 23.8 GB before its text encoders and VAE, which does not fit the 12 GB cards this project targets, and `txt2img-flux1-dev-fp8` already covers Flux Text to Image. Every preset the panel lists is now one you can actually run.
- Cancel Generation uses ComfyUI's interrupt endpoint and stops OpenLayer watchers/polling for active generation tools, but cancellation cannot undo work ComfyUI already completed.
- The Settings workflow health checker reports local readiness, but it does not auto-fix missing models, missing nodes, or workflow mappings.
- Workflow Health now gives beginner-friendly next checks for missing models, missing ComfyUI nodes, missing workflow JSON, setup-required presets, and experimental presets.
- Persistent Photoshop layer metadata is not confirmed safe in this UXP environment yet. OpenLayer keeps structured metadata in session history and prepares a serialized payload for future persistence.
- Copy Diagnostics prepares a setup report for testers. It does not send data anywhere.
- Prompt from Layer requires `comfyui-florence2` and `Florence-2-base-PromptGen-v2.0`. The `comfyui-custom-scripts` pack is no longer needed.
- Outpaint is experimental and currently uses `outpaint-flux-fill-basic` with `flux1-fill-dev.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors` or the accepted T5 fp8 fallback, and `ae.safetensors`.
- Upscale currently uses a simple pixel/model upscale path. It does not use prompts, latent upscale, tiled diffusion, or creative enhancement.
- Upscale needs ComfyUI's `UpscaleModelLoader` and `ImageUpscaleWithModel` nodes plus an installed upscale model such as `4x-UltraSharp.pth` or `RealESRGAN_x4plus.pth`.
- The setup pack contains no model weights. Every registered preset's files come to roughly 177 GB deduplicated, and four of them are licence-restricted, so it ships the requirements list and a downloader instead. An internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.
- Panel-wide diagnostics such as the port scan, the GPU report, and workflow health are reported on the Settings screen rather than on every tool screen. Each tool's own diagnostics line also mirrors to Settings, which is the panel-wide log.
- Progress is no longer pinned while a tool's form is scrolled, which is the accepted cost of taking the progress bar out of the sticky header.
- The 0.8 releases focus on correctness and maintainability. Existing generation capabilities should remain compatible with v0.7.0.
- The Preview panel offers each tool's primary import only. Live Painting's "Import Refined as Layer" stays on the dashboard.
- Layer, canvas, selection, and mask capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- Layer Tools' Send to ComfyUI puts the image in ComfyUI's `input` folder. It does not build or run a workflow for you — you reference the uploaded file from a workflow yourself.
- The Layer Tools card on Home does not dim when ComfyUI is unreachable, unlike the generation tools. Saving to a file still works with ComfyUI stopped; Send to ComfyUI reports the connection error on the Layer Tools status line.
- Live sampler previews require ComfyUI to be started with `--preview-method auto`, and the preview panel may flicker between steps until a future UI polish pass.
- Classic v0.4 theme preserves the older visual feel, but it does not duplicate every old layout detail.
- SDXL, SD3, and Flux Sketch to Image workflows still need dedicated future presets.
- Workflow node IDs may need adjustment for custom ComfyUI workflows.
- Dedicated selected-layer PNG file export, selection preservation, aligned regional workflows, advanced ControlNet-style workflows, and generative upscaling are not included yet.
- The UI is functional and responsive enough for testing, but final visual polish will continue in later releases.
