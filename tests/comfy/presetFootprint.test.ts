import { describe, expect, it } from "vitest";
import { getPrimaryDeviceVramTotalBytes } from "../../src/comfy/hardwareAdvisor";
import {
  PresetVramOutlook,
  VramExpectation,
  createPresetFootprints,
  rankPresetsByVramOutlook
} from "../../src/comfy/presetFootprint";
import { listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import { WorkflowPresetDefinition } from "../../src/comfy/types";

const PLUGIN_VERSION = "9.9.9";
const FIXED_TIMESTAMP = "2026-07-31T00:00:00.000Z";
const CHECKPOINT_DEPENDENT_PRESET_IDS = [
  "txt2img-basic",
  "img2img-basic",
  "inpaint-basic"
];

describe("preset footprint", () => {
  it("keeps checkpoint-selected preset sizes and outlooks unknown", () => {
    const outlooks = rankPresetsByVramOutlook({
      pluginVersion: PLUGIN_VERSION,
      vramTotalBytes: Number.MAX_SAFE_INTEGER,
      generatedAt: FIXED_TIMESTAMP
    });

    for (const presetId of CHECKPOINT_DEPENDENT_PRESET_IDS) {
      const outlook = getOutlook(outlooks, presetId);

      expect(outlook.confidence).toBe("checkpoint-dependent");
      expect(outlook.expectation).toBe("unknown");
      expect(outlook.formattedTotal.toLowerCase()).toContain("checkpoint");
      expect(outlook.formattedTotal.toLowerCase()).not.toContain("unknown");
      expect(outlook.formattedTotal).not.toMatch(/\d/);
    }
  });

  it("marks the Florence-2 repo-folder size as partial", () => {
    const footprint = getFootprint("prompt-from-layer-florence2");

    expect(footprint.confidence).toBe("partial");
    expect(footprint.unknownSizeCount).toBeGreaterThan(0);
    expect(footprint.formattedTotal).toMatch(/^At least /);
    expect(footprint.formattedTotal.toLowerCase()).not.toContain("unknown");
  });

  it("describes both comfortable residency and recoverable offloading", () => {
    const preset = getRunnablePreset("upscale-basic");
    const footprint = createPresetFootprints({
      pluginVersion: PLUGIN_VERSION,
      presets: [preset],
      generatedAt: FIXED_TIMESTAMP
    })[0];
    expect(footprint.largestModelBytes).toBeGreaterThan(1);

    const comfortable = rankPresetsByVramOutlook({
      pluginVersion: PLUGIN_VERSION,
      presets: [preset],
      vramTotalBytes: footprint.largestModelBytes * 2,
      generatedAt: FIXED_TIMESTAMP
    })[0];
    const offloads = rankPresetsByVramOutlook({
      pluginVersion: PLUGIN_VERSION,
      presets: [preset],
      vramTotalBytes: footprint.largestModelBytes - 1,
      generatedAt: FIXED_TIMESTAMP
    })[0];

    expect(comfortable.expectation).toBe("comfortable");
    expect(offloads.expectation).toBe("offloads");
    expect(offloads.expectationNote.toLowerCase()).toContain("slower");
    expect(offloads.expectationNote.toLowerCase()).toContain("not broken");
    expect(offloads.expectationNote).not.toMatch(/\b(?:cannot|can not|unable|too large|not supported)\b/i);
  });

  it("makes no speed claim when ComfyUI has not reported VRAM", () => {
    const outlooks = rankPresetsByVramOutlook({
      pluginVersion: PLUGIN_VERSION,
      vramTotalBytes: null,
      generatedAt: FIXED_TIMESTAMP
    });

    expect(outlooks.every((outlook) => outlook.expectation === "unknown")).toBe(true);
    expect(outlooks.every((outlook) => !/speed|slow|fast/i.test(outlook.expectationNote))).toBe(true);
  });

  it("never reports a largest known model bigger than the known total", () => {
    const footprints = createPresetFootprints({
      pluginVersion: PLUGIN_VERSION,
      generatedAt: FIXED_TIMESTAMP
    });

    for (const footprint of footprints) {
      expect(footprint.largestModelBytes).toBeLessThanOrEqual(footprint.totalBytes);
    }
  });

  it("ranks expectation groups and every within-group tiebreak deterministically", () => {
    const outlooks = rankPresetsByVramOutlook({
      pluginVersion: PLUGIN_VERSION,
      vramTotalBytes: 16 * 1024 ** 3,
      generatedAt: FIXED_TIMESTAMP
    });
    const expected = [...outlooks].sort(compareOutlooksBySpecification);

    expect([...new Set(outlooks.map((outlook) => outlook.expectation))]).toEqual([
      "comfortable",
      "tight",
      "offloads",
      "unknown"
    ]);
    expect(outlooks.map((outlook) => outlook.presetId)).toEqual(
      expected.map((outlook) => outlook.presetId)
    );

    const tiedGroups = groupExactTies(outlooks).filter((group) => group.length > 1);
    expect(tiedGroups.length).toBeGreaterThan(0);

    for (const group of tiedGroups) {
      expect(group.map((outlook) => outlook.presetId)).toEqual(
        group.map((outlook) => outlook.presetId).sort((left, right) => left.localeCompare(right))
      );
    }
  });

  it("reads VRAM from the selected CUDA device and preserves the torch fallback", () => {
    expect(
      getPrimaryDeviceVramTotalBytes({
        devices: [
          { name: "CPU", type: "cpu", vramTotalBytes: 111 },
          { name: "CUDA GPU", type: "cuda:0", vramTotalBytes: 222 },
          { name: "Other GPU", type: "directml", vramTotalBytes: 333 }
        ]
      })
    ).toBe(222);

    expect(
      getPrimaryDeviceVramTotalBytes({
        devices: [{ name: "CUDA GPU", type: "cuda:0", torchVramTotalBytes: 444 }]
      })
    ).toBe(444);

    expect(
      getPrimaryDeviceVramTotalBytes({
        devices: [{ name: "CPU", type: "cpu" }]
      })
    ).toBeNull();
  });

  it("keeps every outlook string plain", () => {
    const outlooks = [
      ...rankPresetsByVramOutlook({
        pluginVersion: PLUGIN_VERSION,
        vramTotalBytes: 16 * 1024 ** 3,
        generatedAt: FIXED_TIMESTAMP
      }),
      ...rankPresetsByVramOutlook({
        pluginVersion: PLUGIN_VERSION,
        vramTotalBytes: null,
        generatedAt: FIXED_TIMESTAMP
      })
    ];

    for (const value of collectStrings(outlooks)) {
      expect(value).not.toMatch(/[`—…]/u);
      expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

function getRunnablePreset(id: string): WorkflowPresetDefinition {
  const preset = listRunnableWorkflowPresets().find((candidate) => candidate.id === id);

  if (!preset) {
    throw new Error(`Expected runnable preset ${id}.`);
  }

  return preset;
}

function getFootprint(presetId: string) {
  const footprint = createPresetFootprints({
    pluginVersion: PLUGIN_VERSION,
    generatedAt: FIXED_TIMESTAMP
  }).find((candidate) => candidate.presetId === presetId);

  if (!footprint) {
    throw new Error(`Expected preset footprint ${presetId}.`);
  }

  return footprint;
}

function getOutlook(outlooks: readonly PresetVramOutlook[], presetId: string) {
  const outlook = outlooks.find((candidate) => candidate.presetId === presetId);

  if (!outlook) {
    throw new Error(`Expected preset outlook ${presetId}.`);
  }

  return outlook;
}

function compareOutlooksBySpecification(
  left: PresetVramOutlook,
  right: PresetVramOutlook
): number {
  const expectationRank: Record<VramExpectation, number> = {
    comfortable: 0,
    tight: 1,
    offloads: 2,
    unknown: 3
  };

  return (
    expectationRank[left.expectation] - expectationRank[right.expectation] ||
    left.largestModelBytes - right.largestModelBytes ||
    left.totalBytes - right.totalBytes ||
    left.presetId.localeCompare(right.presetId)
  );
}

function groupExactTies(outlooks: readonly PresetVramOutlook[]): PresetVramOutlook[][] {
  const groups = new Map<string, PresetVramOutlook[]>();

  for (const outlook of outlooks) {
    const key = `${outlook.expectation}:${outlook.largestModelBytes}:${outlook.totalBytes}`;
    const group = groups.get(key) ?? [];
    group.push(outlook);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}
