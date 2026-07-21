import { describe, expect, it } from "vitest";
import {
  evaluateInpaintReadiness,
  formatInpaintReadinessDiagnostic,
  getInpaintReadinessStatusLabel,
  InpaintReadinessInput
} from "../../src/ui/inpaintReadiness";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import { createPhotoshopDocumentIdentity } from "../../src/photoshop/documentContext";
import type { SelectedRegionSourceImage } from "../../src/photoshop/photoshopAdapter";
import type { NormalizedSelectionBounds } from "../../src/photoshop/selectionUtils";
import type { WorkflowCompatibilityContext } from "../../src/comfy/workflowCompatibility";

const origin = createPhotoshopDocumentIdentity(101, "Concept.psd");
const basicPreset = getWorkflowPreset("inpaint-basic");
const fluxPreset = getWorkflowPreset("inpaint-flux-fill-basic");

function bounds(left: number, top: number, right: number, bottom: number): NormalizedSelectionBounds {
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

// The captured context is padded and snapped to a multiple of 8, and the source
// PNG is captured at exactly those bounds.
const contextBounds = bounds(100, 100, 356, 292);
const selectionBounds = bounds(160, 150, 300, 250);

function createSource(overrides: Partial<SelectedRegionSourceImage> = {}): SelectedRegionSourceImage {
  return {
    blob: new Blob(["source-pixels"], { type: "image/png" }),
    filename: "OpenLayer_Inpaint_Source.png",
    mimeType: "image/png",
    width: contextBounds.width,
    height: contextBounds.height,
    sourceName: "Visible canvas from Concept.psd",
    captureFormat: "png",
    originatingDocument: origin,
    selection: {
      bounds: selectionBounds,
      contextBounds,
      documentName: "Concept.psd",
      originatingDocument: origin,
      maskAvailable: true,
      maskMessage: "Selection mask captured as PNG/lossless source."
    },
    mask: {
      blob: new Blob(["mask-pixels"], { type: "image/png" }),
      filename: "OpenLayer_Inpaint_Mask.png",
      mimeType: "image/png",
      bounds: contextBounds,
      width: contextBounds.width,
      height: contextBounds.height,
      captureFormat: "png",
      originatingDocument: origin
    },
    maskAvailable: true,
    maskMessage: "Selection mask captured as PNG/lossless source.",
    sourceMode: "visible-canvas",
    sourceWarning: "",
    ...overrides
  };
}

// Derived from the preset itself so the fixture cannot drift from the graph the
// workflow actually requires.
function createAvailableNodes(preset: typeof basicPreset) {
  const availableNodes: Record<string, string[]> = {};

  for (const node of preset.requiredNodes) {
    availableNodes[node.classType] = [
      ...(availableNodes[node.classType] ?? []),
      ...node.requiredInputs
    ];
  }

  return availableNodes;
}

// inpaint-basic is stable, so a ready evaluation carries no warnings.
// Everything the graph needs is present here; individual tests remove one thing.
const readyContext: WorkflowCompatibilityContext = {
  selectedModelName: "epicrealism_naturalSinRC1VAE-inpainting.safetensors",
  selectedModelFamily: "sd1",
  availableNodes: createAvailableNodes(basicPreset)
};

const installedCheckpoints = ["epicrealism_naturalSinRC1VAE-inpainting.safetensors"];

function evaluateBasic(overrides: Partial<InpaintReadinessInput> = {}) {
  return evaluateInpaintReadiness({
    mode: "generate",
    source: createSource(),
    preset: basicPreset,
    presetId: "inpaint-basic",
    checkpointName: "epicrealism_naturalSinRC1VAE-inpainting.safetensors",
    prompt: "a cat holding a mouse",
    compatibilityContext: readyContext,
    installedModelNames: installedCheckpoints,
    ...overrides
  });
}

function evaluateImport(overrides: Partial<InpaintReadinessInput> = {}) {
  return evaluateInpaintReadiness({
    mode: "import",
    source: createSource(),
    resultDimensions: { width: contextBounds.width, height: contextBounds.height },
    ...overrides
  });
}

describe("Inpaint readiness contract", () => {
  it("is ready when the capture, mask, context, checkpoint, and graph all line up", () => {
    const readiness = evaluateBasic();

    expect(readiness.ok).toBe(true);
  });

  it("carries no warnings for the stable workflow when everything lines up", () => {
    const readiness = evaluateBasic();

    expect(readiness.ok).toBe(true);
    expect(readiness.warnings).toEqual([]);
  });

  it("blocks an unresolved workflow preset", () => {
    const readiness = evaluateBasic({ preset: null, presetId: "inpaint-nonexistent" });

    expect(readiness).toMatchObject({ ok: false, reason: "workflow-unresolved" });
  });

  it("blocks before upload when no selection has been captured", () => {
    const readiness = evaluateBasic({ source: null });

    expect(readiness).toMatchObject({ ok: false, reason: "source-missing" });
  });

  it("blocks an empty captured source blob", () => {
    const readiness = evaluateBasic({ source: createSource({ blob: new Blob() }) });

    expect(readiness).toMatchObject({ ok: false, reason: "source-missing" });
  });

  it("blocks a source with no originating document identity", () => {
    const readiness = evaluateBasic({
      source: createSource({ originatingDocument: null as never })
    });

    expect(readiness).toMatchObject({ ok: false, reason: "origin-document-missing" });
  });

  it("blocks an empty prompt", () => {
    const readiness = evaluateBasic({ prompt: "   " });

    expect(readiness).toMatchObject({ ok: false, reason: "prompt-missing" });
  });

  it("blocks a prompt that was never entered", () => {
    const readiness = evaluateBasic({ prompt: undefined });

    expect(readiness).toMatchObject({ ok: false, reason: "prompt-missing" });
  });

  it("blocks a missing mask", () => {
    const readiness = evaluateBasic({ source: createSource({ mask: undefined }) });

    expect(readiness).toMatchObject({ ok: false, reason: "mask-missing" });
  });

  it("blocks an empty mask blob", () => {
    const source = createSource();
    const readiness = evaluateBasic({
      source: createSource({ mask: { ...source.mask!, blob: new Blob() } })
    });

    expect(readiness).toMatchObject({ ok: false, reason: "mask-missing" });
  });

  it("blocks a mask that does not match its source", () => {
    const source = createSource();
    const readiness = evaluateBasic({
      source: createSource({ mask: { ...source.mask!, width: 128 } })
    });

    expect(readiness).toMatchObject({ ok: false, reason: "mask-dimension-mismatch" });
    expect((readiness as { technicalMessage: string }).technicalMessage).toContain("128");
  });

  it("blocks an empty selection context", () => {
    const source = createSource();
    const readiness = evaluateBasic({
      source: createSource({
        selection: { ...source.selection, contextBounds: bounds(100, 100, 100, 100) }
      })
    });

    expect(readiness).toMatchObject({ ok: false, reason: "context-bounds-invalid" });
  });

  it("blocks a context whose width is not a multiple of 8, which ComfyUI would round down", () => {
    const source = createSource();
    const unaligned = bounds(100, 100, 355, 292);
    const readiness = evaluateBasic({
      source: createSource({
        width: unaligned.width,
        height: unaligned.height,
        selection: { ...source.selection, contextBounds: unaligned },
        mask: { ...source.mask!, width: unaligned.width, height: unaligned.height }
      })
    });

    expect(readiness).toMatchObject({ ok: false, reason: "context-bounds-unaligned" });
    expect((readiness as { technicalMessage: string }).technicalMessage).toMatch(/multiple of 8/);
  });

  it("blocks a source image that does not match its captured context", () => {
    const readiness = evaluateBasic({
      source: createSource({ width: 128, mask: createSource().mask, height: contextBounds.height })
    });

    expect(readiness).toMatchObject({ ok: false, reason: "mask-dimension-mismatch" });
  });

  it("blocks when source and mask agree but neither matches the context bounds", () => {
    const source = createSource();
    const readiness = evaluateBasic({
      source: createSource({
        width: 128,
        height: 96,
        mask: { ...source.mask!, width: 128, height: 96 }
      })
    });

    expect(readiness).toMatchObject({ ok: false, reason: "source-context-mismatch" });
  });

  it("blocks a selection that escapes its own context", () => {
    const source = createSource();
    const readiness = evaluateBasic({
      source: createSource({
        selection: { ...source.selection, bounds: bounds(10, 10, 60, 60) }
      })
    });

    expect(readiness).toMatchObject({ ok: false, reason: "selection-outside-context" });
  });

  it("blocks when no checkpoint is selected", () => {
    const readiness = evaluateBasic({ checkpointName: "  " });

    expect(readiness).toMatchObject({ ok: false, reason: "checkpoint-missing" });
  });

  it("blocks when a required ComfyUI node is missing", () => {
    const readiness = evaluateBasic({
      compatibilityContext: {
        ...readyContext,
        availableNodes: { LoadImage: ["image"] }
      }
    });

    expect(readiness).toMatchObject({ ok: false, reason: "workflow-not-runnable" });
    expect(readiness.ok === false && readiness.message).toBeTruthy();
  });

  it("blocks a checkpoint the ComfyUI server does not have installed", () => {
    const readiness = evaluateBasic({
      compatibilityContext: { ...readyContext, selectedModelName: "not-installed.safetensors" },
      installedModelNames: ["something-else.safetensors"],
      checkpointName: "not-installed.safetensors"
    });

    expect(readiness).toMatchObject({ ok: false, reason: "checkpoint-not-installed" });
    expect((readiness as { technicalMessage: string }).technicalMessage).toContain("something-else.safetensors");
  });

  it("does not guess about installed models when the server list is unavailable", () => {
    expect(evaluateBasic({ installedModelNames: undefined }).ok).toBe(true);
    expect(evaluateBasic({ installedModelNames: [] }).ok).toBe(true);
  });

  it("blocks Flux Fill when the mask cannot be embedded into the source PNG", () => {
    const readiness = evaluateInpaintReadiness({
      mode: "generate",
      source: createSource(),
      preset: fluxPreset,
      presetId: "inpaint-flux-fill-basic",
      checkpointName: "flux1-fill-dev.safetensors",
      prompt: "a cat holding a mouse",
      maskBridgeAvailable: false
    });

    expect(readiness).toMatchObject({ ok: false, reason: "flux-fill-mask-bridge-unavailable" });
  });

  it("does not apply the Flux Fill mask bridge rule to other Inpaint workflows", () => {
    const readiness = evaluateBasic({ maskBridgeAvailable: false });

    expect(readiness.ok).toBe(true);
  });

  it("blocks an import whose result does not match the saved source context", () => {
    const readiness = evaluateImport({
      resultDimensions: { width: 128, height: 96 }
    });

    expect(readiness).toMatchObject({ ok: false, reason: "result-dimension-mismatch" });
  });

  it("blocks an import whose result dimensions could not be read", () => {
    const readiness = evaluateImport({ resultDimensions: null });

    expect(readiness).toMatchObject({ ok: false, reason: "result-dimension-mismatch" });
  });

  it("allows an import whose result matches the saved source context", () => {
    const readiness = evaluateImport({
      resultDimensions: { width: contextBounds.width, height: contextBounds.height }
    });

    expect(readiness.ok).toBe(true);
  });

  it("does not ask an import for a workflow, checkpoint, or prompt it never uses", () => {
    // Importing replays saved pixels, so a missing checkpoint or an unrunnable
    // graph must not block it: only the capture geometry and the result matter.
    const readiness = evaluateImport({
      preset: null,
      presetId: "",
      checkpointName: "",
      prompt: ""
    });

    expect(readiness.ok).toBe(true);
  });

  it("still blocks an import whose saved capture is inconsistent", () => {
    const source = createSource();
    const readiness = evaluateImport({
      source: createSource({ mask: { ...source.mask!, width: 128 } })
    });

    expect(readiness).toMatchObject({ ok: false, reason: "mask-dimension-mismatch" });
  });

  it("names the one thing to fix in the status line for every reason", () => {
    expect(getInpaintReadinessStatusLabel("source-missing")).toBe("Selection required.");
    expect(getInpaintReadinessStatusLabel("prompt-missing")).toBe("Prompt required.");
    expect(getInpaintReadinessStatusLabel("mask-missing")).toBe("Mask required.");
    expect(getInpaintReadinessStatusLabel("checkpoint-not-installed")).toBe("Checkpoint required.");
    expect(getInpaintReadinessStatusLabel("result-dimension-mismatch")).toBe("Regenerate required.");
  });

  it("reports the blocking reason and technical detail in one diagnostic line", () => {
    const readiness = evaluateImport({ resultDimensions: { width: 128, height: 96 } });

    const diagnostic = formatInpaintReadinessDiagnostic(readiness);
    expect(diagnostic).toContain("result-dimension-mismatch");
    expect(diagnostic).toContain("128 x 96");
  });
});
