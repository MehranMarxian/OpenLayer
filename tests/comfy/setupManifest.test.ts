import { describe, expect, it } from "vitest";
import {
  CUSTOM_NODE_PACKAGES,
  DEFAULT_COMFYUI_PORT,
  buildSetupManifest,
  formatBytes,
  getCustomNodePackagesForPreset
} from "../../src/comfy/setupManifest";
import { getWorkflowPreset, listRunnableWorkflowPresets, listWorkflowPresets } from "../../src/comfy/presetRegistry";

const FIXED_TIMESTAMP = "2026-07-24T00:00:00.000Z";

function build() {
  return buildSetupManifest({ pluginVersion: "9.9.9", generatedAt: FIXED_TIMESTAMP });
}

describe("setup manifest", () => {
  it("covers every runnable preset and no todo ones", () => {
    const manifest = build();
    const runnableIds = listRunnableWorkflowPresets().map((preset) => preset.id);
    const todoIds = listWorkflowPresets()
      .filter((preset) => preset.status === "todo")
      .map((preset) => preset.id);

    expect(manifest.presets.map((preset) => preset.id)).toEqual(runnableIds);
    expect(manifest.totals.presets).toBe(runnableIds.length);

    // A todo preset has no authored workflow JSON, so shipping setup
    // instructions for it would point at a file that does not exist.
    for (const id of todoIds) {
      expect(manifest.presets.map((preset) => preset.id)).not.toContain(id);
    }
  });

  it("lists every stable preset by name", () => {
    const manifest = build();
    const stableIds = listWorkflowPresets()
      .filter((preset) => preset.status === "stable")
      .map((preset) => preset.id);

    expect(stableIds.length).toBeGreaterThan(0);

    for (const id of stableIds) {
      expect(manifest.presets.map((preset) => preset.id)).toContain(id);
    }
  });

  it("gives every model an install path under the ComfyUI models folder", () => {
    const manifest = build();

    expect(manifest.models.length).toBeGreaterThan(0);

    for (const model of manifest.models) {
      expect(model.targetPath).toBe(`models/${model.targetFolder}`);
      expect(model.key).toBe(`${model.targetFolder}/${model.modelName}`);
      expect(model.usedByPresets.length).toBeGreaterThan(0);
    }
  });

  it("points every preset's model keys at models the manifest actually carries", () => {
    const manifest = build();
    const knownKeys = new Set(manifest.models.map((model) => model.key));

    for (const preset of manifest.presets) {
      for (const key of preset.modelKeys) {
        expect(knownKeys, `${preset.id} references unknown model ${key}`).toContain(key);
      }
    }
  });

  it("attributes shared models to every preset that loads them", () => {
    const manifest = build();
    const sharedVae = manifest.models.find((model) => model.key === "vae/ae.safetensors");

    expect(sharedVae).toBeDefined();
    expect(sharedVae?.usedByPresets).toContain("inpaint-flux-fill-basic");
    expect(sharedVae?.usedByPresets).toContain("txt2img-z-image-turbo");
  });

  it("requires only the two custom node packages that are left", () => {
    const manifest = build();

    expect(manifest.customNodes.map((node) => node.name)).toEqual([
      "comfyui_controlnet_aux",
      "ComfyUI-Florence2"
    ]);

    for (const node of manifest.customNodes) {
      expect(node.repoUrl).toMatch(/^https:\/\/github\.com\//);
      expect(node.classTypes.length).toBeGreaterThan(0);
      expect(node.usedByPresets.length).toBeGreaterThan(0);
    }
  });

  it("does not ask anyone to install comfyui-custom-scripts", () => {
    const manifest = build();

    expect(manifest.customNodes.map((node) => node.name)).not.toContain("ComfyUI-Custom-Scripts");

    for (const preset of manifest.presets) {
      expect(preset.customNodePackages).not.toContain("ComfyUI-Custom-Scripts");
    }
  });

  it("names no custom nodes for presets built entirely from core nodes", () => {
    expect(getCustomNodePackagesForPreset(getWorkflowPreset("txt2img-basic"))).toEqual([]);
    expect(getCustomNodePackagesForPreset(getWorkflowPreset("upscale-basic"))).toEqual([]);
    expect(getCustomNodePackagesForPreset(getWorkflowPreset("sketch2img-linecn-basic"))).toEqual([
      "comfyui_controlnet_aux"
    ]);
  });

  it("keeps every custom node package entry usable as install instructions", () => {
    for (const [classType, entry] of Object.entries(CUSTOM_NODE_PACKAGES)) {
      expect(entry.name, `${classType} has no package name`).toBeTruthy();
      expect(entry.repoUrl).toMatch(/^https:\/\/github\.com\//);
    }
  });

  it("totals what a full install costs", () => {
    const manifest = build();

    expect(manifest.totals.models).toBe(manifest.models.length);
    expect(manifest.totals.licenseGatedModels).toBe(2);
    expect(manifest.totals.knownDownloadBytes).toBe(
      manifest.models.reduce((total, model) => total + (model.sizeBytes ?? 0), 0)
    );
    expect(manifest.totals.knownDownloadBytes).toBeGreaterThan(50 * 1024 ** 3);
  });

  it("is deterministic so a regenerated pack only differs when the registry does", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("records the port OpenLayer actually defaults to", () => {
    expect(build().comfyui.defaultPort).toBe(DEFAULT_COMFYUI_PORT);
    expect(DEFAULT_COMFYUI_PORT).toBe(8190);
  });
});

describe("formatBytes", () => {
  it("reads naturally at the sizes these models actually are", () => {
    expect(formatBytes(66961958)).toBe("64 MB");
    expect(formatBytes(335304388)).toBe("320 MB");
    expect(formatBytes(12309866400)).toBe("11.5 GB");
    expect(formatBytes(0)).toBe("unknown");
  });
});
