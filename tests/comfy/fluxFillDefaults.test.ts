import { describe, expect, it } from "vitest";
import {
  applyFluxFillReferenceDefaults,
  FLUX_FILL_PRESET_ID,
  FLUX_FILL_REFERENCE_DEFAULTS,
  formatFluxFillLockedControlsNote,
  presetLocksSamplerControls
} from "../../src/comfy/fluxFillDefaults";
import { ComfyWorkflow } from "../../src/comfy/types";

describe("presets that override the panel's sampler controls", () => {
  it("locks the controls for the Flux Fill preset", () => {
    expect(presetLocksSamplerControls(FLUX_FILL_PRESET_ID)).toBe(true);
  });

  it("leaves the controls editable for every other Inpaint preset", () => {
    expect(presetLocksSamplerControls("inpaint-basic")).toBe(false);
    expect(presetLocksSamplerControls("")).toBe(false);
  });

  // The lock exists because buildInpaintWorkflow hands this preset to
  // applyFluxFillReferenceDefaults instead of injecting the panel's values. If
  // that override ever stops touching steps/cfg/denoise, the lock is wrong.
  it("stays justified: the override still replaces steps, guidance, and denoise", () => {
    const workflow: ComfyWorkflow = {
      "26": { class_type: "FluxGuidance", inputs: { guidance: 3.5 } },
      "3": { class_type: "KSampler", inputs: { steps: 8, cfg: 7, denoise: 0.5 } },
      "39": { class_type: "DifferentialDiffusion", inputs: {} }
    };

    applyFluxFillReferenceDefaults(workflow);

    expect(workflow["26"].inputs.guidance).toBe(FLUX_FILL_REFERENCE_DEFAULTS.guidance);
    expect(workflow["3"].inputs.steps).toBe(FLUX_FILL_REFERENCE_DEFAULTS.steps);
    expect(workflow["3"].inputs.cfg).toBe(FLUX_FILL_REFERENCE_DEFAULTS.cfg);
    expect(workflow["3"].inputs.denoise).toBe(FLUX_FILL_REFERENCE_DEFAULTS.denoise);
  });

  it("names the values the artist will actually get, straight from the defaults", () => {
    const note = formatFluxFillLockedControlsNote();

    expect(note).toContain(String(FLUX_FILL_REFERENCE_DEFAULTS.steps));
    expect(note).toContain(String(FLUX_FILL_REFERENCE_DEFAULTS.guidance));
    expect(note).toContain(String(FLUX_FILL_REFERENCE_DEFAULTS.denoise));
    expect(note).toMatch(/another Inpaint workflow/i);
  });
});
