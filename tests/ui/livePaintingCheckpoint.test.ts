import { describe, expect, it } from "vitest";
import { chooseLivePaintingCheckpoint } from "../../src/ui/tools/livePainting";

const EPIC = "epicrealism_naturalSinRC1VAE.safetensors";
const KLEIN = "flux-2-klein-4b-fp8.safetensors";

/**
 * Live Painting's graph is SD 1.5 + the LCM LoRA through CheckpointLoaderSimple.
 * A starter install opens Text to Image on FLUX.2 Klein, and Live Painting used
 * to pass that file straight in: every cycle failed. Beta gate G4, finding 1.
 */
describe("chooseLivePaintingCheckpoint", () => {
  it("uses an SD 1.5 checkpoint instead of FLUX.2 Klein, and says so", () => {
    const choice = chooseLivePaintingCheckpoint(KLEIN, ["sd_xl_base_1.0.safetensors", EPIC], EPIC);

    expect(choice.checkpointName).toBe(EPIC);
    expect(choice.substituted).toBe(true);
    expect(choice.message).toBe(`Live Painting runs on SD 1.5, so it uses ${EPIC} instead of ${KLEIN}.`);
  });

  it("keeps the Text to Image model when it is an SD 1.5 checkpoint", () => {
    const choice = chooseLivePaintingCheckpoint("dreamshaper_v1.5.safetensors", ["dreamshaper_v1.5.safetensors", EPIC], EPIC);

    expect(choice).toEqual({ checkpointName: "dreamshaper_v1.5.safetensors", substituted: false, message: "" });
  });

  it("keeps a checkpoint whose family the name does not reveal, as before", () => {
    // An SD 1.5 fine-tune with an unhelpful name is the common case.
    expect(chooseLivePaintingCheckpoint("myStyle_final.safetensors", ["myStyle_final.safetensors", EPIC], EPIC).checkpointName)
      .toBe("myStyle_final.safetensors");
  });

  it("does not run SDXL live, which the LCM SD 1.5 LoRA cannot drive", () => {
    expect(chooseLivePaintingCheckpoint("sd_xl_base_1.0.safetensors", ["sd_xl_base_1.0.safetensors", EPIC], EPIC).checkpointName)
      .toBe(EPIC);
  });

  it("falls back to the first SD 1.x checkpoint when the recommended one is missing", () => {
    expect(chooseLivePaintingCheckpoint(KLEIN, ["sd_xl_base_1.0.safetensors", "v1-5-pruned-emaonly.safetensors"], EPIC).checkpointName)
      .toBe("v1-5-pruned-emaonly.safetensors");
  });

  it("refuses with a plain message when there is no SD 1.5 checkpoint at all", () => {
    const choice = chooseLivePaintingCheckpoint(KLEIN, ["sd_xl_base_1.0.safetensors"], EPIC);

    expect(choice.checkpointName).toBeNull();
    expect(choice.message).toMatch(/SD 1\.5 checkpoint/);
    expect(choice.message).not.toMatch(/`|--|\*\*/);
  });

  it("picks one when Text to Image has no model selected yet", () => {
    const choice = chooseLivePaintingCheckpoint("", [EPIC], EPIC);

    expect(choice.checkpointName).toBe(EPIC);
    expect(choice.message).toBe(`Live Painting runs on SD 1.5 and uses ${EPIC}.`);
  });
});
