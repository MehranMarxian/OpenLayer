import { describe, expect, it } from "vitest";
import { buildTxt2ImgWorkflow } from "../../src/comfy/workflowBuilder";
import { WORKFLOW_PRESETS, getWorkflowPreset } from "../../src/comfy/presetRegistry";

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

  it("leaves presets that should not take a LoRA without an insertion point", () => {
    // The builder's guard throws for a preset with no insertion point, but
    // every txt2img preset now declares one, so that path is unreachable from
    // buildTxt2ImgWorkflow and cannot honestly be exercised here. What is still
    // worth pinning is that tools which never offer a LoRA have not quietly
    // acquired one.
    for (const id of ["inpaint-basic", "outpaint-flux-fill-basic", "upscale-basic"] as const) {
      expect(getWorkflowPreset(id).loraInsertion).toBeUndefined();
    }
  });

  it("still passes the preset's own workflow validation after surgery", async () => {
    // A rewire that broke a required input would surface here, because the
    // builder validates again after the splice.
    await expect(buildTxt2ImgWorkflow({ ...BASE, lora: LORA })).resolves.toBeDefined();
  });
});

describe("every declared LoRA insertion point", () => {
  const withLora = WORKFLOW_PRESETS.filter((preset) => preset.loraInsertion);

  it("covers the presets that are meant to have one", () => {
    expect(withLora.map((preset) => preset.id).sort()).toEqual([
      "txt2img-basic",
      "txt2img-flux1-dev-fp8",
      "txt2img-flux2-dev-gguf",
      "txt2img-krea2-turbo",
      "txt2img-z-image-turbo"
    ]);
  });

  for (const preset of withLora) {
    describe(preset.id, () => {
      const insertion = preset.loraInsertion!;

      it("takes a node id its workflow does not already use", async () => {
        const built = await buildTxt2ImgWorkflow({
          presetId: preset.id,
          prompt: "a test",
          width: 512,
          height: 512,
          steps: 4,
          cfg: 1,
          seed: 1
        });

        // Without this the splice would overwrite a real node and still pass
        // validation, because validateWorkflowForPreset only checks that the
        // required nodes are present.
        expect(built.workflow[insertion.nodeId]).toBeUndefined();
      });

      it("names sources and consumers that exist, and rewires all of them", async () => {
        const built = await buildTxt2ImgWorkflow({
          presetId: preset.id,
          prompt: "a test",
          width: 512,
          height: 512,
          steps: 4,
          cfg: 1,
          seed: 1,
          lora: LORA
        });

        expect(built.workflow[insertion.modelSource.nodeId]).toBeDefined();
        expect(built.workflow[insertion.clipSource.nodeId]).toBeDefined();

        for (const consumer of insertion.modelConsumers) {
          expect(built.workflow[consumer.nodeId]?.inputs[consumer.inputName]).toEqual([insertion.nodeId, 0]);
        }

        for (const consumer of insertion.clipConsumers) {
          expect(built.workflow[consumer.nodeId]?.inputs[consumer.inputName]).toEqual([insertion.nodeId, 1]);
        }
      });

      it("leaves nothing downstream still reading the bare model or CLIP", async () => {
        const built = await buildTxt2ImgWorkflow({
          presetId: preset.id,
          prompt: "a test",
          width: 512,
          height: 512,
          steps: 4,
          cfg: 1,
          seed: 1,
          lora: LORA
        });

        // The failure this guards against is silent: a consumer left on the
        // original loader means the LoRA loads and then applies to nothing.
        for (const [id, node] of Object.entries(built.workflow)) {
          if (id === insertion.nodeId) {
            continue;
          }

          for (const [inputName, value] of Object.entries(node.inputs)) {
            if (!Array.isArray(value) || value.length < 2) {
              continue;
            }

            const readsModel = String(value[0]) === insertion.modelSource.nodeId && value[1] === insertion.modelSource.slot;
            const readsClip = String(value[0]) === insertion.clipSource.nodeId && value[1] === insertion.clipSource.slot;

            if (readsModel && inputName === "model") {
              throw new Error(`${preset.id}: node ${id}.${inputName} still reads the bare model`);
            }

            if (readsClip && inputName === "clip") {
              throw new Error(`${preset.id}: node ${id}.${inputName} still reads the bare CLIP`);
            }
          }
        }
      });
    });
  }
});
