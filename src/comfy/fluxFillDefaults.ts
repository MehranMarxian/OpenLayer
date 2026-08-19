import { ComfyWorkflow } from "./types";

export const FLUX_FILL_PRESET_ID = "inpaint-flux-fill-basic";
export const FLUX_FILL_CROPSTITCH_PRESET_ID = "inpaint-flux-fill-cropstitch";

/**
 * Every preset built on the Flux Fill reference graph. They share the embedded
 * alpha-mask upload, the locked sampler values, and the node ids those values
 * are written to, so each of the several places that used to compare against
 * the one literal id asks this instead. A crop-and-stitch variant that missed
 * one of those call sites would look correct and repaint the wrong area.
 */
export const FLUX_FILL_PRESET_IDS: readonly string[] = [
  FLUX_FILL_PRESET_ID,
  FLUX_FILL_CROPSTITCH_PRESET_ID
];

export function isFluxFillPreset(presetId: string) {
  return FLUX_FILL_PRESET_IDS.includes(presetId);
}

export const FLUX_FILL_REFERENCE_DEFAULTS = {
  guidance: 30,
  steps: 20,
  cfg: 1,
  samplerName: "euler",
  scheduler: "simple",
  denoise: 1,
  differentialDiffusionStrength: 1
} as const;

const FLUX_GUIDANCE_NODE_ID = "26";
const FLUX_SAMPLER_NODE_ID = "3";
const FLUX_DIFFERENTIAL_DIFFUSION_NODE_ID = "39";

// buildInpaintWorkflow hands this preset to applyFluxFillReferenceDefaults
// instead of injecting the panel's steps/cfg/denoise, so those three controls
// have no effect while it is selected. The panel disables them and says so
// rather than letting an artist tune values that are silently discarded.
export function presetLocksSamplerControls(presetId: string) {
  return isFluxFillPreset(presetId);
}

export function formatFluxFillLockedControlsNote() {
  return [
    "Steps, CFG, and Denoise are fixed by the Flux Fill reference workflow",
    `(steps ${FLUX_FILL_REFERENCE_DEFAULTS.steps},`,
    `guidance ${FLUX_FILL_REFERENCE_DEFAULTS.guidance},`,
    `denoise ${FLUX_FILL_REFERENCE_DEFAULTS.denoise}).`,
    "Choose another Inpaint workflow to set them yourself."
  ].join(" ");
}

export function applyFluxFillReferenceDefaults(workflow: ComfyWorkflow) {
  const guidanceNode = workflow[FLUX_GUIDANCE_NODE_ID];
  const samplerNode = workflow[FLUX_SAMPLER_NODE_ID];
  const differentialDiffusionNode = workflow[FLUX_DIFFERENTIAL_DIFFUSION_NODE_ID];

  if (guidanceNode) {
    guidanceNode.inputs.guidance = FLUX_FILL_REFERENCE_DEFAULTS.guidance;
  }

  if (samplerNode) {
    samplerNode.inputs.steps = FLUX_FILL_REFERENCE_DEFAULTS.steps;
    samplerNode.inputs.cfg = FLUX_FILL_REFERENCE_DEFAULTS.cfg;
    samplerNode.inputs.sampler_name = FLUX_FILL_REFERENCE_DEFAULTS.samplerName;
    samplerNode.inputs.scheduler = FLUX_FILL_REFERENCE_DEFAULTS.scheduler;
    samplerNode.inputs.denoise = FLUX_FILL_REFERENCE_DEFAULTS.denoise;
  }

  if (differentialDiffusionNode) {
    differentialDiffusionNode.inputs.strength = FLUX_FILL_REFERENCE_DEFAULTS.differentialDiffusionStrength;
  }
}

export function formatFluxFillReferenceDefaults() {
  return [
    "Flux Fill submitted with reference defaults:",
    `guidance ${FLUX_FILL_REFERENCE_DEFAULTS.guidance}`,
    `steps ${FLUX_FILL_REFERENCE_DEFAULTS.steps}`,
    `CFG ${FLUX_FILL_REFERENCE_DEFAULTS.cfg}`,
    `sampler ${FLUX_FILL_REFERENCE_DEFAULTS.samplerName}`,
    `scheduler ${FLUX_FILL_REFERENCE_DEFAULTS.scheduler}`,
    `denoise ${FLUX_FILL_REFERENCE_DEFAULTS.denoise}`,
    `Differential Diffusion strength ${FLUX_FILL_REFERENCE_DEFAULTS.differentialDiffusionStrength}.`
  ].join(" ");
}
