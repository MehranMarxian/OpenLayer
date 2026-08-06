import { describe, expect, it } from "vitest";
import { formatLoraHintSuffix, getLoraFamilyHint } from "../../src/comfy/loraCompatibility";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";

const KREA2 = getWorkflowPreset("txt2img-krea2-turbo");
const NO_LORA_PRESET = getWorkflowPreset("txt2img-basic");

/**
 * The real contents of the reference machine's loras folder, with the
 * architecture each file actually is -- read from its safetensors tensor keys,
 * not from its name and not from its metadata.
 *
 * Two of these (`illustration`, `meat_v1`) declare `ss_base_model_version:
 * sd_1.5` in metadata while their keys are Flux, which is exactly why the hint
 * is filename-based and advisory rather than authoritative.
 */
const REAL_LORAS = [
  { name: "krea2_darkbrush.safetensors", actual: "krea2" },
  { name: "aidmaMJ6.1-FLUX-v0.5.safetensors", actual: "flux" },
  { name: "flux_realism_lora.safetensors", actual: "flux" },
  { name: "lcm\\SD1.5\\pytorch_lora_weights.safetensors", actual: "sd1.5" },
  { name: "qinglong_detailedeye_z-imageV2(comfy).safetensors", actual: "zimage" },
  { name: "Martin_French.safetensors", actual: "flux" },
  { name: "Memoria_xyzVntg.safetensors", actual: "sd1.5" },
  { name: "add_detail.safetensors", actual: "sd1.5" },
  { name: "illustration.safetensors", actual: "flux" },
  { name: "lora.safetensors", actual: "flux" },
  { name: "meat_v1.safetensors", actual: "flux" }
] as const;

describe("LoRA family hints", () => {
  it("never claims a match for a LoRA that is not actually this preset's family", () => {
    // The one error that would genuinely mislead. A missed mismatch costs a
    // wasted generation; a false "matches" sends the artist looking for a bug
    // in the wrong place.
    for (const lora of REAL_LORAS) {
      if (getLoraFamilyHint(lora.name, KREA2) === "matches") {
        expect(lora.actual, `${lora.name} was labelled a match`).toBe("krea2");
      }
    }
  });

  it("recognises the one genuinely compatible LoRA on the reference machine", () => {
    expect(getLoraFamilyHint("krea2_darkbrush.safetensors", KREA2)).toBe("matches");
  });

  it("flags the foreign LoRAs whose names say so", () => {
    expect(getLoraFamilyHint("aidmaMJ6.1-FLUX-v0.5.safetensors", KREA2)).toBe("foreign");
    expect(getLoraFamilyHint("flux_realism_lora.safetensors", KREA2)).toBe("foreign");
    expect(getLoraFamilyHint("lcm\\SD1.5\\pytorch_lora_weights.safetensors", KREA2)).toBe("foreign");
    expect(getLoraFamilyHint("qinglong_detailedeye_z-imageV2(comfy).safetensors", KREA2)).toBe("foreign");
  });

  it("admits it does not know for names that carry no signal", () => {
    // These really are incompatible, but nothing in the filename says so, and
    // guessing would be dishonest.
    for (const name of ["Martin_French.safetensors", "add_detail.safetensors", "lora.safetensors"]) {
      expect(getLoraFamilyHint(name, KREA2)).toBe("unknown");
    }
  });

  it("treats a preset with no LoRA support as having no positive tokens", () => {
    expect(getLoraFamilyHint("krea2_darkbrush.safetensors", NO_LORA_PRESET)).toBe("unknown");
    expect(getLoraFamilyHint("flux_realism_lora.safetensors", NO_LORA_PRESET)).toBe("foreign");
  });

  it("is case- and separator-insensitive", () => {
    expect(getLoraFamilyHint("KREA2_Bold.safetensors", KREA2)).toBe("matches");
    expect(getLoraFamilyHint("krea-2-bold.safetensors", KREA2)).toBe("matches");
    expect(getLoraFamilyHint("sub/dir/FLUX_thing.safetensors", KREA2)).toBe("foreign");
  });

  it("labels only what is worth saying", () => {
    expect(formatLoraHintSuffix("matches")).toContain("matches this model");
    expect(formatLoraHintSuffix("foreign")).toContain("another model");
    expect(formatLoraHintSuffix("unknown")).toBe("");
  });
});
