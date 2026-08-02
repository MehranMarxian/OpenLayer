import { getErrorMessage, getTechnicalErrorDetails } from "../utils/errors";

/**
 * Artist-facing failure copy for the generating tools.
 *
 * Every tool has a pair: a *hint*, which recognises a known failure from the
 * technical error text and says what to do about it, and a *friendly message*,
 * which is what lands in the tool status bar. When nothing is recognised both
 * fall back to the raw error rather than inventing an explanation — a confident
 * wrong diagnosis costs more time than an unhelpful accurate one.
 *
 * These are pure string-to-string functions with no DOM and no Photoshop, which
 * is why they can live outside App.ts and be tested directly. They were
 * untested for their whole life despite being the words every artist reads when
 * something breaks.
 */

export function getImageToImageFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "This looks like a workflow/model mismatch. img2img-basic is safest with SD 1.x and SDXL checkpoints; SD3, Flux, and Z_image_Turbo usually need dedicated loader nodes.";
  }

  if (
    details.includes("vae") ||
    details.includes("loader") ||
    details.includes("missing node") ||
    details.includes("invalid prompt")
  ) {
    return "ComfyUI rejected part of the workflow. Try an SD 1.x or SDXL checkpoint with img2img-basic, or use Experimental mode only with a matching custom workflow.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 160 ? `${message.slice(0, 160)}...` : message;
}

export function getFriendlyImageToImageErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "The selected checkpoint needs a different Image to Image workflow preset.";
  }

  if (
    details.includes("vae") ||
    details.includes("loader") ||
    details.includes("missing node") ||
    details.includes("invalid prompt")
  ) {
    return "ComfyUI rejected this workflow for the selected checkpoint.";
  }

  return getErrorMessage(error);
}

export function getSketchFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("sketch2img-linecn-basic.json") || details.includes("linecn workflow json")) {
    return "The bundled LINECN workflow file was not found in this build. Rebuild OpenLayer and reload the plugin.";
  }

  if (details.includes("comfy_setup_missing") || details.includes("missing lineart controlnet")) {
    return "Install the SD 1.5 LineArt ControlNet model and required LineArt preprocessor nodes, then click Check ComfyUI again.";
  }

  if (
    // Matches both the old LineArtPreprocessor and the LineartStandardPreprocessor
    // now shipped — "lineartpreprocessor" is not a substring of the latter.
    details.includes("lineart") ||
    details.includes("controlnet") ||
    details.includes("aio aux preprocessor") ||
    details.includes("missing node")
  ) {
    return "This LINECN workflow needs the matching LineArt preprocessor and ControlNet custom nodes installed in ComfyUI.";
  }

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "This looks like a checkpoint/workflow mismatch. The first LINECN preset is intended for SD 1.x checkpoints such as epicrealism_naturalSinRC1VAE.safetensors.";
  }

  if (details.includes("vae") || details.includes("loader") || details.includes("invalid prompt")) {
    return "ComfyUI rejected part of the LINECN workflow. Check that the preset node IDs match the exported API workflow.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 160 ? `${message.slice(0, 160)}...` : message;
}

export function getFriendlySketchErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("sketch2img-linecn-basic.json") || details.includes("linecn workflow json")) {
    return "LINECN workflow file missing from this build.";
  }

  if (details.includes("comfy_setup_missing") || details.includes("missing lineart controlnet")) {
    return "Required LINECN setup is missing in ComfyUI.";
  }

  if (
    // Matches both the old LineArtPreprocessor and the LineartStandardPreprocessor
    // now shipped — "lineartpreprocessor" is not a substring of the latter.
    details.includes("lineart") ||
    details.includes("controlnet") ||
    details.includes("aio aux preprocessor") ||
    details.includes("missing node")
  ) {
    return "The LINECN workflow needs matching ComfyUI LineArt/ControlNet nodes.";
  }

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "The selected checkpoint needs a matching SD 1.x LINECN workflow.";
  }

  return getErrorMessage(error);
}

export function getInpaintFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("inpaint-basic.json") || details.includes("inpaint workflow json")) {
    return "The bundled inpaint-basic workflow file was not found in this build. Rebuild OpenLayer and reload the plugin.";
  }

  if (
    details.includes("vaeencodeforinpaint") ||
    details.includes("inpaintmodelconditioning") ||
    details.includes("imagetomask") ||
    details.includes("loadimage") ||
    details.includes("missing node")
  ) {
    return "This Inpaint workflow needs ComfyUI's standard LoadImage, ImageToMask, and InpaintModelConditioning nodes. Rebuild or remap the inpaint-basic workflow if node IDs changed.";
  }

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "This looks like a checkpoint/workflow mismatch. inpaint-basic is intended for SD 1.x checkpoints first.";
  }

  if (details.includes("mask") || details.includes("vae") || details.includes("invalid prompt")) {
    return "ComfyUI rejected part of the inpaint workflow. Check that the source image, mask image, and selected checkpoint match inpaint-basic.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 160 ? `${message.slice(0, 160)}...` : message;
}

export function getFriendlyInpaintErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("inpaint-basic.json") || details.includes("inpaint workflow json")) {
    return "Inpaint workflow file missing from this build.";
  }

  if (
    details.includes("vaeencodeforinpaint") ||
    details.includes("inpaintmodelconditioning") ||
    details.includes("imagetomask") ||
    details.includes("loadimage") ||
    details.includes("missing node")
  ) {
    return "The Inpaint workflow needs matching ComfyUI inpaint nodes.";
  }

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "The selected checkpoint needs a matching SD 1.x Inpaint workflow.";
  }

  return getErrorMessage(error);
}

export function getOutpaintFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("outpaint-flux-fill-basic.json") || details.includes("outpaint workflow json")) {
    return "The bundled Outpaint workflow file was not found in this build. Rebuild OpenLayer and reload the plugin.";
  }

  if (
    details.includes("imagepadforoutpaint") ||
    details.includes("differentialdiffusion") ||
    details.includes("fluxguidance") ||
    details.includes("unetloader") ||
    details.includes("dualcliploader") ||
    details.includes("missing node")
  ) {
    return "This Outpaint workflow needs the local Flux Fill node stack, including ImagePadForOutpaint, DifferentialDiffusion, FluxGuidance, UNETLoader, DualCLIPLoader, VAELoader, and KSampler.";
  }

  if (
    details.includes("text encoder") ||
    details.includes("t5") ||
    details.includes("clip_l") ||
    details.includes("vae") ||
    details.includes("ae.safetensors")
  ) {
    return "Flux Fill Outpaint needs flux1-fill-dev.safetensors, clip_l.safetensors, t5xxl_fp16.safetensors or the accepted fp8 fallback, and ae.safetensors.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

export function getFriendlyOutpaintErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("outpaint-flux-fill-basic.json") || details.includes("outpaint workflow json")) {
    return "Outpaint workflow file missing from this build.";
  }

  if (
    details.includes("imagepadforoutpaint") ||
    details.includes("differentialdiffusion") ||
    details.includes("fluxguidance") ||
    details.includes("unetloader") ||
    details.includes("dualcliploader") ||
    details.includes("missing node")
  ) {
    return "The Outpaint workflow needs matching Flux Fill ComfyUI nodes.";
  }

  return getErrorMessage(error);
}

export function getUpscaleFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("upscale-basic.json") || details.includes("workflow file")) {
    return "The bundled upscale-basic workflow file was not found in this build. Rebuild OpenLayer and reload the plugin.";
  }

  if (
    details.includes("upscalemodelloader") ||
    details.includes("imageupscalewithmodel") ||
    details.includes("loadimage") ||
    details.includes("missing node")
  ) {
    return "This Upscale preset needs ComfyUI's LoadImage, UpscaleModelLoader, ImageUpscaleWithModel, and SaveImage nodes.";
  }

  if (
    details.includes("4x-ultrasharp") ||
    details.includes("realesrgan") ||
    details.includes("upscale model") ||
    details.includes("not found")
  ) {
    return "Install an upscale model such as 4x-UltraSharp.pth or RealESRGAN_x4plus.pth, then click Check ComfyUI again.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

export function getFriendlyUpscaleErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (
    details.includes("upscalemodelloader") ||
    details.includes("imageupscalewithmodel") ||
    details.includes("missing node")
  ) {
    return "The Upscale workflow needs matching ComfyUI upscale nodes.";
  }

  if (
    details.includes("4x-ultrasharp") ||
    details.includes("realesrgan") ||
    details.includes("upscale model") ||
    details.includes("not found")
  ) {
    return "The selected upscale model was not found in ComfyUI.";
  }

  return getErrorMessage(error);
}
