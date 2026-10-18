import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateSetupRequirements } from "../../src/comfy/setupRequirements";
import { ComfyModelInventory } from "../../src/comfy/types";
import { shouldRefreshToolModels } from "../../src/ui/setupInventoryChange";

// The walkthrough's two states: diffusion_models empty, then the three FLUX.2
// Klein 4B starter files present.
const EMPTY: Partial<ComfyModelInventory> = { checkpoints: ["epicrealism_naturalSinRC1VAE.safetensors"] };
const STARTER: Partial<ComfyModelInventory> = {
  ...EMPTY,
  diffusionModels: ["flux-2-klein-4b-fp8.safetensors"],
  clipModels: ["qwen_3_4b.safetensors"],
  vaeModels: ["flux2-vae.safetensors"]
};

function checked(inventory: Partial<ComfyModelInventory>) {
  return evaluateSetupRequirements({ pluginVersion: "9.9.9", inventory });
}

const unchecked = evaluateSetupRequirements({ pluginVersion: "9.9.9" });

describe("shouldRefreshToolModels", () => {
  it("refreshes once the starter files appear", () => {
    expect(shouldRefreshToolModels(checked(EMPTY), checked(STARTER))).toBe(true);
  });

  it("refreshes when a model disappears too", () => {
    expect(shouldRefreshToolModels(checked(STARTER), checked(EMPTY))).toBe(true);
  });

  it("leaves the dropdowns alone when a re-check finds the same models", () => {
    expect(shouldRefreshToolModels(checked(STARTER), checked(STARTER))).toBe(false);
  });

  it("refreshes on the first real check, since the panel may have loaded the fallback list", () => {
    expect(shouldRefreshToolModels(null, checked(EMPTY))).toBe(true);
    expect(shouldRefreshToolModels(unchecked, checked(EMPTY))).toBe(true);
  });

  it("never refreshes from a report that was not checked against ComfyUI", () => {
    expect(shouldRefreshToolModels(checked(STARTER), unchecked)).toBe(false);
    expect(shouldRefreshToolModels(null, unchecked)).toBe(false);
  });
});

describe("App.ts wiring", () => {
  const app = readFileSync(new URL("../../src/ui/App.ts", import.meta.url), "utf8");
  const checkSetup = app.slice(
    app.indexOf("async function handleCheckSetup("),
    app.indexOf("function renderSetupTab()")
  );

  it("refreshes the tool model lists from the Setup check, before its early return", () => {
    const refresh = checkSetup.indexOf("await refreshToolModelLists(client)");

    expect(checkSetup).toContain("shouldRefreshToolModels(previousReport, setupReport)");
    expect(refresh).toBeGreaterThan(-1);
    expect(refresh).toBeLessThan(checkSetup.indexOf("if (options.keepStatus)"));
  });

  it("re-applies the starter default before filling the Text to Image list", () => {
    const helper = app.slice(app.indexOf("async function refreshToolModelLists("), app.indexOf("async function handleCheckComfy("));

    expect(helper.indexOf("applyStarterDefaults(client)")).toBeGreaterThan(-1);
    expect(helper.indexOf("applyStarterDefaults(client)")).toBeLessThan(
      helper.indexOf("refreshTextModelOptionsForSelectedPreset(elements, client)")
    );
    expect(helper).toContain("refreshImageModelOptionsForSelectedPreset(elements, client)");
  });
});
