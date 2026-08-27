import { describe, expect, it } from "vitest";
import { getWorkflowPreset, listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import { TOOL_CARDS } from "../../src/ui/appConstants";

/**
 * Guards the two things gate testing decided about this feature, both of which
 * are easy to undo by accident later.
 *
 * The findings are in `docs/multi-reference-gate-findings.md`. The short
 * version: 48 live runs found no reference count at which identity degrades,
 * and found that real photographs lose the face while wardrobe, props and
 * setting carry. The first result means the list must not be capped at some
 * small number "to be safe"; the second means nothing user-facing may promise
 * a likeness, because the model cannot deliver one.
 */
describe("multi-reference composition preset", () => {
  const preset = getWorkflowPreset("multi-reference-flux2-klein");

  it("declares a reference chain the builder can grow", () => {
    const chain = preset.referenceChain;

    expect(chain).toBeDefined();
    expect(preset.mode).toBe("multi-reference");

    // The chain nodes must all exist in the shipped graph, or the clone step
    // has nothing to copy and the failure surfaces as a ComfyUI node error.
    const shippedNodeIds = preset.requiredNodes.map((node) => node.id);

    expect(shippedNodeIds).toContain(chain?.loadImage);
    expect(shippedNodeIds).toContain(chain?.scale);
    expect(shippedNodeIds).toContain(chain?.encode);
    expect(shippedNodeIds).toContain(chain?.referenceIntoPositive);
    expect(shippedNodeIds).toContain(chain?.referenceIntoNegative);

    // The generated ids must not be able to collide with a shipped one.
    for (const nodeId of shippedNodeIds) {
      expect(nodeId.startsWith(chain?.generatedNodeIdPrefix ?? "")).toBe(false);
    }
  });

  it("keeps a ceiling that is a sanity bound rather than a quality cliff", () => {
    // Gate testing composed six references with identity intact. A ceiling at
    // or below that would be capping the feature below its measured range.
    expect(preset.referenceChain?.maximumReferences ?? 0).toBeGreaterThan(6);
  });

  it("is offered as a runnable preset for its own mode and no other", () => {
    expect(listRunnableWorkflowPresets("multi-reference").map((entry) => entry.id)).toContain(
      "multi-reference-flux2-klein"
    );
    expect(listRunnableWorkflowPresets("img2img").map((entry) => entry.id)).not.toContain(
      "multi-reference-flux2-klein"
    );
  });

  it("never promises a likeness anywhere an artist can read it", () => {
    const card = TOOL_CARDS.find((entry) => entry.id === "multi-reference");
    const copy = [
      card?.title ?? "",
      card?.subtitle ?? "",
      preset.description,
      preset.capability?.artistLabel ?? "",
      preset.capability?.uiHints.experimentalNote ?? ""
    ].join(" ").toLowerCase();

    // Wording that would set the expectation the model provably cannot meet:
    // that a specific person from a reference arrives recognisably.
    for (const forbidden of ["likeness", "same person", "your face", "keep faces", "preserve faces"]) {
      expect(copy).not.toContain(forbidden);
    }

    // And it has to say what it does carry, so the limit is discoverable before
    // an artist spends a generation finding it.
    expect(preset.capability?.uiHints.experimentalNote ?? "").toMatch(/faces do not/i);
  });

  it("hides the controls the technique fixes rather than offering them", () => {
    const hidden = preset.capability?.uiHints.hiddenControls ?? [];

    // Denoise is fixed at 1 and the canvas comes from reference 1. Offering
    // either control would imply a choice that does not exist.
    expect(hidden).toContain("denoise");
    expect(hidden).toContain("width");
    expect(hidden).toContain("height");
    expect(preset.capability?.controls ?? []).not.toContain("denoise");
  });
});
