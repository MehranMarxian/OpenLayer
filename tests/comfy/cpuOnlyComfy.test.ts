import { describe, expect, it } from "vitest";
import {
  CPU_ONLY_NOTE,
  createHardwareRecommendationReport,
  formatHardwareReport,
  getPrimaryDeviceVramTotalBytes,
  isCpuOnlyComfy
} from "../../src/comfy/hardwareAdvisor";
import { listWorkflowPresets } from "../../src/comfy/presetRegistry";
import type { ComfyModelInventory, ComfySystemStats } from "../../src/comfy/types";
import {
  COMFY_ONLINE_CPU_ONLY_STATUS,
  COMFY_ONLINE_STATUS,
  getComfyCheckDiagnostics,
  getComfyOnlineStatus,
  NO_CHECKPOINTS_NOTE
} from "../../src/ui/comfyCheckStatus";

const GB = 1024 ** 3;

/**
 * What ComfyUI started with --cpu reports, as readComfySystemStats parses it:
 * one device named and typed "cpu", whose "vram_total" is the machine's system
 * RAM (ComfyUI's get_total_memory returns psutil's total for a CPU device).
 */
function cpuOnlyStats(ramGb = 32): ComfySystemStats {
  return {
    system: { os: "nt", ramTotalBytes: ramGb * GB, ramFreeBytes: 20 * GB },
    devices: [{ name: "cpu", type: "cpu", vramTotalBytes: ramGb * GB, vramFreeBytes: 20 * GB }]
  } as ComfySystemStats;
}

function gpuStats(type = "cuda", vramGb = 12): ComfySystemStats {
  return {
    system: { os: "nt", ramTotalBytes: 32 * GB, ramFreeBytes: 20 * GB },
    devices: [{ name: "NVIDIA GeForce RTX 4070 Ti", type, vramTotalBytes: vramGb * GB, vramFreeBytes: 10 * GB }]
  } as ComfySystemStats;
}

const emptyInventory = {
  checkpoints: [],
  diffusionModels: [],
  clipModels: [],
  vaeModels: [],
  controlNetModels: [],
  modelPatches: [],
  upscaleModels: [],
  loras: [],
  visionLanguageModels: [],
  backgroundRemovalModels: [],
  inpaintModels: [],
  loraModels: [],
  missingSources: []
} as unknown as ComfyModelInventory;

describe("isCpuOnlyComfy", () => {
  it("is true when every device ComfyUI reports is the processor", () => {
    expect(isCpuOnlyComfy(cpuOnlyStats())).toBe(true);
  });

  it("is false for CUDA, Apple MPS and other GPU backends", () => {
    for (const type of ["cuda", "mps", "xpu", "privateuseone"]) {
      expect(isCpuOnlyComfy(gpuStats(type)), type).toBe(false);
    }
  });

  it("is false when ComfyUI reports no devices at all, which says nothing either way", () => {
    expect(isCpuOnlyComfy({ ...cpuOnlyStats(), devices: [] })).toBe(false);
  });
});

describe("CPU-only VRAM", () => {
  it("does not read system RAM as VRAM", () => {
    // Before beta gate G3, a 32 GB CPU-only machine came back as 32 GB of VRAM:
    // a workstation card, and the size every VRAM limit was scaled from.
    expect(getPrimaryDeviceVramTotalBytes(cpuOnlyStats(32))).toBeNull();
  });

  it("still reads a real card's VRAM", () => {
    expect(getPrimaryDeviceVramTotalBytes(gpuStats("cuda", 12))).toBe(12 * GB);
  });

  it("reports no GPU instead of a workstation tier", () => {
    const report = createHardwareRecommendationReport(cpuOnlyStats(64), emptyInventory, listWorkflowPresets());

    expect(report.tier).toBe("unknown");
    expect(report.tierLabel).toBe("No GPU");
    expect(report.vramTotalLabel).toBe("none");
    expect(formatHardwareReport(report)).toContain(CPU_ONLY_NOTE);
    expect(formatHardwareReport(report)).not.toMatch(/Workstation/);
  });
});

describe("Check ComfyUI on a CPU-only ComfyUI", () => {
  it("says CPU only on the status line, inside the bar's 48 characters", () => {
    expect(getComfyOnlineStatus(5, true)).toBe(COMFY_ONLINE_CPU_ONLY_STATUS);
    expect(COMFY_ONLINE_CPU_ONLY_STATUS.length).toBeLessThanOrEqual(48);
    expect(getComfyOnlineStatus(5, false)).toBe(COMFY_ONLINE_STATUS);
  });

  it("puts the reason on the diagnostics line, before the no-checkpoints note", () => {
    expect(getComfyCheckDiagnostics(0, true)).toBe(`${CPU_ONLY_NOTE} ${NO_CHECKPOINTS_NOTE}`);
    expect(getComfyCheckDiagnostics(5, true)).toBe(CPU_ONLY_NOTE);
    expect(getComfyCheckDiagnostics(5, false)).toBeNull();
  });

  it("keeps the note plain text, as the panel renders it with textContent", () => {
    expect(CPU_ONLY_NOTE).not.toMatch(/`|--|\*\*|Photoshop plugin/);
  });
});
