import { describe, expect, it } from "vitest";
import { buildImg2ImgWorkflow } from "../../src/comfy/workflowBuilder";

const base = {
  presetId: "edit-qwen-image-21",
  prompt: "replace the cart in <image1> with the teapot from <image2>",
  sourceImageName: "scene.png",
  steps: 25,
  cfg: 1,
  seed: 71,
  denoise: 1
};

describe("reference layers inside an edit (v0.37)", () => {
  it("keeps the edited layer as image_1 and adds references from image_2", async () => {
    const { workflow } = await buildImg2ImgWorkflow({ ...base, referenceImageNames: ["teapot.png", "jacket.png"] });

    expect(workflow["10"].inputs.image).toBe("scene.png");
    expect(workflow["6"].inputs["images.image_1"]).toEqual(["11", 0]);
    expect(workflow.ref2load.inputs.image).toBe("teapot.png");
    expect(workflow.ref2alpha.inputs.alpha).toEqual(["ref2load", 1]);
    expect(workflow["6"].inputs["images.image_2"]).toEqual(["ref2alpha", 0]);
    expect(workflow["6"].inputs["images.image_3"]).toEqual(["ref3alpha", 0]);
  });

  it("combines with a selection edit: the source goes in plain, references keep their alpha", async () => {
    const { workflow } = await buildImg2ImgWorkflow({
      ...base,
      referenceImageNames: ["teapot.png"],
      selectionEdit: { strength: 1.6 }
    });

    expect(workflow["6"].inputs["images.image_1"]).toEqual(["10", 0]);
    expect(workflow["6"].inputs["images.image_2"]).toEqual(["ref2alpha", 0]);
    expect(workflow.selring.inputs.source).toEqual(["10", 0]);
    expect(workflow["9"].inputs.images).toEqual(["anchorjoin", 0]);
  });

  it("refuses references on a preset that cannot take them", async () => {
    await expect(
      buildImg2ImgWorkflow({ ...base, presetId: "edit-flux2-klein", steps: 4, referenceImageNames: ["teapot.png"] })
    ).rejects.toThrow(/cannot take reference layers/);
  });

  it("caps references at four beside the edited layer", async () => {
    await expect(
      buildImg2ImgWorkflow({ ...base, referenceImageNames: ["a.png", "b.png", "c.png", "d.png", "e.png"] })
    ).rejects.toThrow(/at most/);
    await expect(
      buildImg2ImgWorkflow({ ...base, referenceImageNames: ["a.png", "b.png", "c.png", "d.png"] })
    ).resolves.toBeTruthy();
  });

  it("leaves the graph untouched when no references are given", async () => {
    const { workflow } = await buildImg2ImgWorkflow(base);

    expect(Object.keys(workflow).some((id) => id.startsWith("ref"))).toBe(false);
  });
});
