import { describe, expect, it } from "vitest";
import { planAssistedInstall } from "../../src/comfy/assistedInstall";
import { listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import { evaluateSetupRequirements } from "../../src/comfy/setupRequirements";
import { evaluateStarter } from "../../src/comfy/starterKit";
import { ComfyModelInventory } from "../../src/comfy/types";
import { createStarterCardView, getStarterDownloadItems } from "../../src/ui/starterCardModel";

const KLEIN = "flux-2-klein-4b-fp8.safetensors";
const ENCODER = "qwen_3_4b.safetensors";
const VAE = "flux2-vae.safetensors";

const allNodes = Object.fromEntries(
  listRunnableWorkflowPresets().flatMap((preset) => preset.requiredNodes.map((node) => [node.classType, node.requiredInputs]))
);

function card(inventory: Partial<ComfyModelInventory> | null, phase: Parameters<typeof createStarterCardView>[2] = { kind: "idle" }, busyElsewhere = false) {
  const report = inventory
    ? evaluateSetupRequirements({ pluginVersion: "9.9.9", inventory, nodeAvailability: allNodes })
    : evaluateSetupRequirements({ pluginVersion: "9.9.9" });
  const status = evaluateStarter(report);
  const items = getStarterDownloadItems(status, planAssistedInstall(report));
  return { items, view: createStarterCardView(status, items, phase, { busyElsewhere }) };
}

describe("getStarterDownloadItems", () => {
  it("fetches the missing starter files smallest first, so a folder problem shows after 336 MB, not 8 GB", () => {
    expect(card({}).items.map((item) => item.modelName)).toEqual([VAE, KLEIN, ENCODER]);
  });

  it("skips what is already installed", () => {
    expect(card({ clipModels: [ENCODER] }).items.map((item) => item.modelName)).toEqual([VAE, KLEIN]);
  });

  it("offers nothing before a check, because nothing is known to be missing", () => {
    expect(card(null).items).toEqual([]);
  });
});

describe("createStarterCardView", () => {
  it("on a fresh ComfyUI, shows the summary and one Download starter button with the size", () => {
    const { view } = card({});

    expect(view.hidden).toBe(false);
    expect(view.title).toBe("Start here");
    expect(view.meta).toBe("FLUX.2 Klein 4B, Apache-2.0");
    expect(view.summary).toMatch(/^Download FLUX.2 Klein 4B \(3 of 3 files, 12.5 GB, Apache-2.0\) to run Text to Image/);
    expect(view.buttons).toEqual([{ label: "Download starter (12.5 GB)", action: "request" }]);
    expect(view.confirm).toBeNull();
  });

  it("asks before downloading, naming every file, its size, folder and host", () => {
    const { view } = card({ clipModels: [ENCODER] }, { kind: "confirming" });

    expect(view.confirm?.headline).toBe("Download these 2 files (4.4 GB) one after another?");
    expect(view.confirm?.files[0]).toEqual([
      { label: "File", value: VAE },
      { label: "Size", value: "336 MB" },
      { label: "Into", value: "models/vae/" },
      { label: "From", value: "huggingface.co" }
    ]);
    expect(view.confirm?.files[1][2]).toEqual({ label: "Into", value: "models/diffusion_models/" });
    expect(view.buttons.map((button) => button.action)).toEqual(["confirm", "cancel"]);
  });

  it("does not say one after another when there is only one file", () => {
    const { view } = card({ diffusionModels: [KLEIN], clipModels: [ENCODER] }, { kind: "confirming" });

    expect(view.confirm?.headline).toBe("Download this file (336 MB)?");
  });

  it("offers Stop while downloading, and says which file", () => {
    const { view } = card({}, { kind: "downloading", index: 2, total: 3, modelName: KLEIN });

    expect(view.summary).toBe(`Downloading file 2 of 3: ${KLEIN}. Progress is shown below.`);
    expect(view.buttons).toEqual([{ label: "Stop", action: "stop" }]);
  });

  it("hides itself once the starter is installed, leaving Setup as it was", () => {
    expect(card({ diffusionModels: [KLEIN], clipModels: [ENCODER], vaeModels: [VAE] }).view.hidden).toBe(true);
  });

  it("before a check, says so and offers no button", () => {
    const { view } = card(null);

    expect(view.summary).toBe("FLUX.2 Klein 4B, 3 files, 12.5 GB. Check Again to see what you already have.");
    expect(view.buttons).toEqual([]);
  });

  it("asks for a move, with no button, when a file sits in the wrong folder", () => {
    const { view } = card({ checkpoints: [KLEIN] });

    expect(view.summary).toContain("is on disk in the wrong folder");
    expect(view.buttons).toEqual([]);
  });

  it("hides the button while a row's download holds the single download slot", () => {
    expect(card({}, { kind: "idle" }, true).view.buttons).toEqual([]);
  });

  it("writes plain text, because every line is drawn with textContent", () => {
    for (const phase of [{ kind: "idle" }, { kind: "confirming" }] as const) {
      const { view } = card({}, phase);
      const text = [view.summary, view.meta, view.confirm?.headline ?? "", view.confirm?.note ?? "", ...view.buttons.map((b) => b.label)];
      for (const line of text) expect(line).not.toMatch(/`|--/);
    }
  });
});
