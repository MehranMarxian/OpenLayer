import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getPresetTextOutputNodeId,
  getWorkflowPreset,
  listRunnableWorkflowPresets,
  validateWorkflowForPreset
} from "../../src/comfy/presetRegistry";
import { ComfyWorkflow, WorkflowPresetDefinition } from "../../src/comfy/types";

const SRC_ROOT = resolve(__dirname, "../../src");

function loadApiWorkflow(preset: WorkflowPresetDefinition): ComfyWorkflow {
  return JSON.parse(readFileSync(resolve(SRC_ROOT, preset.workflowFile), "utf8")) as ComfyWorkflow;
}

/**
 * Every ComfyUI node class used by a runnable preset that does NOT ship with
 * core ComfyUI, and the repository that provides it. Freezing this list is the
 * point of the test: a preset that quietly reintroduces a custom-node
 * dependency is a setup burden pushed onto every user, and it should not be
 * possible to add one without editing this line.
 */
const EXPECTED_CUSTOM_NODE_CLASSES: Record<string, string> = {
  LineArtPreprocessor: "comfyui_controlnet_aux",
  Florence2ModelLoader: "ComfyUI-Florence2",
  Florence2Run: "ComfyUI-Florence2"
};

describe("shipped API workflow files", () => {
  const runnablePresets = listRunnableWorkflowPresets();

  it("ships a workflow file for every runnable preset", () => {
    expect(runnablePresets.length).toBeGreaterThan(0);

    for (const preset of runnablePresets) {
      expect(() => loadApiWorkflow(preset), `${preset.id} workflow file is missing`).not.toThrow();
    }
  });

  it("keeps every runnable preset's node mapping in sync with its workflow JSON", () => {
    for (const preset of runnablePresets) {
      const workflow = loadApiWorkflow(preset);

      expect(
        () => validateWorkflowForPreset(workflow, preset),
        `${preset.id} registry mapping drifted from its workflow JSON`
      ).not.toThrow();
    }
  });

  it("requires no custom nodes beyond the frozen inventory", () => {
    const seen = new Set<string>();

    for (const preset of runnablePresets) {
      for (const node of preset.requiredNodes) {
        if (node.classType in EXPECTED_CUSTOM_NODE_CLASSES) {
          seen.add(node.classType);
        }

        // pysssss-style nodes namespace themselves with a pipe. None should
        // remain: Prompt from Layer now publishes its caption through core
        // ComfyUI's PreviewAny instead of ShowText|pysssss.
        expect(node.classType, `${preset.id} requires a namespaced custom node`).not.toContain("|");
      }
    }

    expect([...seen].sort()).toEqual(Object.keys(EXPECTED_CUSTOM_NODE_CLASSES).sort());
  });
});

describe("getPresetTextOutputNodeId", () => {
  it("finds the PreviewAny node that publishes the Florence caption", () => {
    const preset = getWorkflowPreset("prompt-from-layer-florence2");

    expect(getPresetTextOutputNodeId(preset)).toBe("41");
  });

  it("returns undefined for presets that produce images rather than text", () => {
    expect(getPresetTextOutputNodeId(getWorkflowPreset("txt2img-basic"))).toBeUndefined();
    expect(getPresetTextOutputNodeId(getWorkflowPreset("upscale-basic"))).toBeUndefined();
  });
});
