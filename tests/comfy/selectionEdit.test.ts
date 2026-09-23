import { describe, expect, it } from "vitest";
import { MAX_SELECTION_EDIT_STRENGTH, measureSelectionFraction, selectionEditStrength } from "../../src/comfy/selectionEdit";
import { buildImg2ImgWorkflow } from "../../src/comfy/workflowBuilder";

function mask(selected: number, total: number) {
  const rgba = new Uint8Array(total * 4);

  for (let pixel = 0; pixel < total; pixel += 1) {
    const value = pixel < selected ? 255 : 0;
    rgba.set([value, value, value, 255], pixel * 4);
  }

  return rgba;
}

describe("selection edit maths", () => {
  it("measures the selected share of the crop", () => {
    expect(measureSelectionFraction(mask(22, 100))).toBeCloseTo(0.22);
    expect(measureSelectionFraction(new Uint8Array(0))).toBe(0);
  });

  it("undoes the ring dilution with strength 1/(1-f), capped", () => {
    // The two spike cases: sky f=0.221 -> 1.284, street f=0.381 -> 1.615.
    expect(selectionEditStrength(0.221)).toBeCloseTo(1.284, 3);
    expect(selectionEditStrength(0.381)).toBeCloseTo(1.616, 2);
    expect(selectionEditStrength(0)).toBe(1);
    expect(selectionEditStrength(0.95)).toBe(MAX_SELECTION_EDIT_STRENGTH);
  });
});

describe("selection edit graph", () => {
  const options = {
    prompt: "add a hot air balloon",
    sourceImageName: "selection.png",
    steps: 25,
    cfg: 1,
    seed: 62,
    denoise: 1
  };

  it("feeds the encoder the plain crop, matches colour from the ring, and saves a feathered cut-out", async () => {
    const { workflow } = await buildImg2ImgWorkflow({
      ...options,
      presetId: "edit-qwen-image-21",
      selectionEdit: { strength: 1.284 },
      // A selection edit owns the output even if the capture were a cut-out.
      keepTransparency: true
    });

    // The upload's alpha is the selection, so the encoder must not rejoin it.
    expect(workflow["6"].inputs["images.image_1"]).toEqual(["10", 0]);

    expect(workflow.selring.inputs).toMatchObject({ destination: ["30", 0], source: ["10", 0], mask: ["10", 1] });
    expect(workflow.selbatch.inputs).toEqual({ image1: ["selring", 0], image2: ["30", 0] });
    expect(workflow.selmatch.inputs).toMatchObject({
      image_target: ["selbatch", 0],
      image_ref: ["10", 0],
      method: "reinhard_lab",
      source_stats: "target_frame",
      "source_stats.target_index": 0,
      strength: 1.284
    });
    expect(workflow.selpick.inputs).toEqual({ image: ["selmatch", 0], batch_index: 1, length: 1 });
    expect(workflow.selrgba.inputs).toEqual({ image: ["selpick", 0], alpha: ["selinvert", 0] });
    expect(workflow.anchorsplit.inputs.image).toEqual(["selrgba", 0]);
    expect(workflow["9"].inputs.images).toEqual(["anchorjoin", 0]);
    // Two corner pixels at 1% alpha, so Photoshop measures the whole crop.
    expect(workflow.anchordot.inputs).toEqual({ value: 0.99, width: 1, height: 1 });
    expect(workflow.anchorrot.inputs.rotation).toBe("180 degrees");
  });

  it("refuses a selection on a preset that cannot edit one", async () => {
    await expect(
      buildImg2ImgWorkflow({ ...options, presetId: "edit-flux2-klein", steps: 4, selectionEdit: { strength: 1 } })
    ).rejects.toThrow(/cannot edit just a selection/);
  });
});
