import { describe, expect, it } from "vitest";
import { buildTxt2ImgWorkflow } from "../../src/comfy/workflowBuilder";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import { getTechnicalErrorDetails } from "../../src/utils/errors";

const BASE = {
  presetId: "txt2img-krea2-turbo",
  prompt: "a cinematic scene",
  checkpointName: "krea2_turbo_fp8_scaled.safetensors",
  width: 1024,
  height: 1024,
  steps: 8,
  cfg: 1,
  seed: 42
};

const LORA = {
  loraName: "krea2_darkbrush.safetensors",
  strengthModel: 0.8,
  strengthClip: 0.8
};

describe("optional LoRA insertion", () => {
  it("leaves the graph exactly as shipped when no LoRA is chosen", async () => {
    const withoutLora = await buildTxt2ImgWorkflow(BASE);
    const insertion = getWorkflowPreset("txt2img-krea2-turbo").loraInsertion;

    expect(insertion).toBeDefined();
    expect(withoutLora.workflow[insertion!.nodeId]).toBeUndefined();

    // The sampler still reads the diffusion model loader directly.
    expect(withoutLora.workflow["3"].inputs.model).toEqual(["20", 0]);
    expect(withoutLora.workflow["6"].inputs.clip).toEqual(["21", 0]);
  });

  it("treats an empty lora name as no LoRA rather than inserting a broken node", async () => {
    const built = await buildTxt2ImgWorkflow({
      ...BASE,
      lora: { loraName: "", strengthModel: 1, strengthClip: 1 }
    });

    expect(built.workflow["23"]).toBeUndefined();
    expect(built.workflow["3"].inputs.model).toEqual(["20", 0]);
  });

  it("splices the loader in and rewires every consumer when a LoRA is chosen", async () => {
    const built = await buildTxt2ImgWorkflow({ ...BASE, lora: LORA });
    const node = built.workflow["23"];

    expect(node.class_type).toBe("LoraLoader");
    expect(node.inputs.lora_name).toBe("krea2_darkbrush.safetensors");
    expect(node.inputs.strength_model).toBe(0.8);
    expect(node.inputs.strength_clip).toBe(0.8);

    // Reads from the original loaders...
    expect(node.inputs.model).toEqual(["20", 0]);
    expect(node.inputs.clip).toEqual(["21", 0]);

    // ...and everything downstream now reads from it instead.
    expect(built.workflow["3"].inputs.model).toEqual(["23", 0]);
    expect(built.workflow["6"].inputs.clip).toEqual(["23", 1]);
    expect(built.workflow["7"].inputs.clip).toEqual(["23", 1]);
  });

  it("leaves no consumer still reading the bare model or CLIP", async () => {
    const built = await buildTxt2ImgWorkflow({ ...BASE, lora: LORA });

    // The whole point of the rewire: nothing except the LoRA node itself may
    // still take a link straight from the diffusion or CLIP loader, or the
    // LoRA would load and then apply to nothing.
    for (const [id, node] of Object.entries(built.workflow)) {
      if (id === "23") {
        continue;
      }

      for (const value of Object.values(node.inputs)) {
        if (Array.isArray(value) && (value[0] === "20" || value[0] === "21")) {
          throw new Error(`node ${id} still reads directly from loader ${String(value[0])}`);
        }
      }
    }
  });

  it("refuses a LoRA on a preset that declares no insertion point", async () => {
    let thrown: unknown;

    try {
      await buildTxt2ImgWorkflow({ ...BASE, presetId: "txt2img-basic", lora: LORA });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(getTechnicalErrorDetails(thrown)).toContain("loraInsertion");
  });

  it("still passes the preset's own workflow validation after surgery", async () => {
    // A rewire that broke a required input would surface here, because the
    // builder validates again after the splice.
    await expect(buildTxt2ImgWorkflow({ ...BASE, lora: LORA })).resolves.toBeDefined();
  });
});
