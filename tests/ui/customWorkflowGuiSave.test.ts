import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ObjectInfo, UiWorkflow } from "../../src/comfy/customWorkflow/convert";
import {
  CustomWorkflowLoadDeps,
  CustomWorkflowLoadResult,
  loadCustomWorkflowText,
  precheckUiWorkflow
} from "../../src/comfy/customWorkflow/load";
import { ComfyHistoryItem, ComfyWorkflow, GeneratedImageResult } from "../../src/comfy/types";
import { createGenerationController, GenerationPipelineMessages } from "../../src/ui/generationController";
import { CustomRunDeps, describeCustomRunOutcome, runCustomWorkflow } from "../../src/ui/tools/customWorkflow";

/**
 * v0.50 PR 4: a normal File > Save (editor save) pasted on the Workflow
 * screen. It is converted with this ComfyUI's /object_info entries
 * (src/comfy/customWorkflow/load.ts) and then runs through the same
 * runCustomWorkflow and real generation controller as an API export, against
 * a scripted client. Fixtures and their provenance:
 * tests/fixtures/customWorkflow/README.md.
 */

const ROOT = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");
const readJson = (path: string) => JSON.parse(read(path));
const FIXTURES = "tests/fixtures/customWorkflow";
const DEFS = readJson(`${FIXTURES}/object-info-raw.json`) as ObjectInfo;
const ONE_REWARD = `${FIXTURES}/frontend-1.57.6/image_flux.1_fill_dev_OneReward`;
const Z_IMAGE_SOURCE = "src/workflows/source/txt2img-z-image-turbo.workflow.json";

/** A 1.57.6 API export with the two `_meta` keys the converter does not write removed (frontendExport.test.ts, finding 1). */
function withoutPackMeta(workflow: ComfyWorkflow): ComfyWorkflow {
  return Object.fromEntries(
    Object.entries(workflow).map(([id, node]) => {
      const meta: Record<string, unknown> = { ...node._meta };
      delete meta.cnr_id;
      delete meta.ver;
      return [id, { ...node, _meta: meta }];
    })
  );
}

/** A scripted ComfyUI for the loader: records every request, answers from the recorded definitions. */
function createLoadDeps(defs: ObjectInfo = DEFS, options: { onlineFails?: boolean } = {}) {
  const calls: string[] = [];
  const asked: string[][] = [];
  const deps: CustomWorkflowLoadDeps = {
    checkOnline: vi.fn(async () => {
      calls.push("online");
      if (options.onlineFails) throw new Error("Could not reach ComfyUI.");
    }),
    getRawNodeDefinitions: vi.fn(async (classTypes: readonly string[]) => {
      calls.push("defs");
      asked.push([...classTypes]);
      return Object.fromEntries(classTypes.filter((c) => defs[c]).map((c) => [c, defs[c]]));
    })
  };
  return { deps, calls, asked };
}

async function loadOk(text: string, defs?: ObjectInfo) {
  const result = await loadCustomWorkflowText(text, createLoadDeps(defs).deps, () => 0);
  if (!result.ok) throw new Error(`expected the workflow to load: ${result.reason} ${result.hint ?? ""}`);
  return result.loaded;
}

const MESSAGES: GenerationPipelineMessages = {
  submitStatus: "Submitting...",
  submitPreview: "Submitting...",
  generateStatus: "Running...",
  generatePreview: "Running...",
  retrieveStatus: "Retrieving...",
  retrievePreview: "Retrieving...",
  livePreview: "Live preview..."
};
const UI = { status: () => undefined, progressPreview: () => undefined, stepProgress: () => undefined, diagnostics: () => undefined, cancelled: () => undefined };

/** The run harness from customWorkflowRun.test.ts, trimmed: the real controller, a scripted client. */
function createRunHarness(history: ComfyHistoryItem) {
  const controller = createGenerationController({ onRunStarted: vi.fn(), onRunFinished: vi.fn() });
  const calls: string[] = [];
  const submitted: ComfyWorkflow[] = [];
  const client = {
    submitPrompt: vi.fn(async (workflow: object) => {
      calls.push("submit");
      submitted.push(workflow as ComfyWorkflow);
      return "prompt-1";
    }),
    watchProgress: vi.fn(() => null),
    pollUntilComplete: vi.fn(async () => history),
    retrieveFirstOutputImage: vi.fn(
      async (_promptId: string, _history: ComfyHistoryItem, options: { preferredNodeId?: string }): Promise<GeneratedImageResult> => ({
        blob: new Blob(["png"]),
        filename: `from-${options.preferredNodeId}`,
        mimeType: "image/png"
      })
    ),
    cancelPrompt: vi.fn(async () => "interrupted" as const)
  };
  const deps: CustomRunDeps<GeneratedImageResult> = {
    checkOnline: vi.fn(async () => {
      calls.push("online");
    }),
    getNodeAvailability: vi.fn(async (classTypes: string[]) => {
      calls.push("nodes");
      return Object.fromEntries(classTypes.map((c) => [c, [] as string[]]));
    }),
    embedMask: vi.fn(async () => {
      calls.push("embed");
      return { blob: new Blob(["embedded"]), filename: "openlayer-custom-masked.png" };
    }),
    uploadImage: vi.fn(async (_blob: Blob, filename: string) => {
      calls.push("upload");
      return `uploaded-${filename}`;
    }),
    run: (workflow, pickOutput) =>
      controller.runPipeline({
        toolType: "custom-workflow",
        client,
        workflow,
        originatingDocument: null,
        ui: UI,
        messages: MESSAGES,
        retrieve: (promptId, history) => client.retrieveFirstOutputImage(promptId, history, { preferredNodeId: pickOutput(history) }),
        commit: vi.fn()
      }),
    progress: vi.fn()
  };
  return { deps, calls, submitted };
}

const image = (filename: string, type: string) => ({ filename, subfolder: "", type });
const selection = { blob: new Blob(["crop"]), filename: "openlayer-selection.png", selectionMask: new Blob(["mask"]) };

/** Plain text for textContent (CLAUDE.md): no backticks, no double hyphens, no markdown. */
function expectPlainText(line: string) {
  expect(line).not.toMatch(/`|--|\*\*|\[.*\]\(/);
}

describe("loading pasted text", () => {
  it("uses an API export as it is, with no request", async () => {
    const text = read(`${ONE_REWARD}.api.json`);
    const { deps, calls } = createLoadDeps();
    const result = await loadCustomWorkflowText(text, deps);
    expect(result).toStrictEqual({ ok: true, loaded: { workflow: JSON.parse(text), format: "api", roles: {}, notes: [] } });
    expect(calls).toStrictEqual([]);
  });

  it("converts an editor save with GET lookups for its node classes only, and says it did", async () => {
    const { deps, calls, asked } = createLoadDeps();
    const result = await loadCustomWorkflowText(read(`${ONE_REWARD}.workflow.json`), deps, () => 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.loaded.format).toBe("ui");
    expect(result.loaded.workflow).toStrictEqual(withoutPackMeta(readJson(`${ONE_REWARD}.api.json`)));
    // The role is the input it feeds on the subgraph node, not the generic "image".
    expect(result.loaded.roles).toStrictEqual({ "17": "input_image" });
    expect(result.loaded.notes).toStrictEqual(["Read from a saved ComfyUI workflow and converted for this ComfyUI."]);
    expect(calls).toStrictEqual(["online", "defs"]);
    // Notes and the subgraph's own id are never looked up.
    expect(asked[0]).not.toContain("MarkdownNote");
    expect(asked[0].some((c) => /^[0-9a-f]{8}-/.test(c))).toBe(false);
  });

  it("a server that stops answering is not a list of missing nodes", async () => {
    const dead = createLoadDeps({}, { onlineFails: false });
    // Definitions come back empty; the second online check is what fails.
    let onlineCalls = 0;
    const deps: CustomWorkflowLoadDeps = {
      ...dead.deps,
      checkOnline: async () => {
        onlineCalls++;
        if (onlineCalls > 1) throw new Error("Could not reach ComfyUI.");
      }
    };
    await expect(loadCustomWorkflowText(read(`${ONE_REWARD}.workflow.json`), deps)).rejects.toThrow("Could not reach ComfyUI.");
  });
});

describe("a converted editor save runs end to end", () => {
  it("the 1.57.6 OneReward save: selection as mask, prompt into the subgraph encoder, the result preview", async () => {
    const loaded = await loadOk(read(`${ONE_REWARD}.workflow.json`));
    const { deps, calls, submitted } = createRunHarness({
      outputs: {
        "105": { images: [image("ComfyUI_temp_result_00001_.png", "temp")] },
        "121": { images: [image("ComfyUI_temp_input_00001_.png", "temp")] }
      }
    });
    const outcome = await runCustomWorkflow(deps, {
      workflow: loaded.workflow,
      roles: loaded.roles,
      prompt: "a red scarf",
      seed: 1234,
      source: selection
    });

    expect(outcome.kind).toBe("done");
    if (outcome.kind !== "done") return;
    expect(calls).toStrictEqual(["online", "nodes", "embed", "upload", "submit"]);
    expect(submitted[0]["108:23"].inputs.text).toBe("a red scarf");
    expect(submitted[0]["17"].inputs.image).toBe("uploaded-openlayer-custom-masked.png");
    expect(submitted[0]["108:3"].inputs.seed).toBe(1234);
    expect(outcome.result.filename).toBe("from-105");
    expect(outcome.inputs).toContain("The selection goes in as that image's mask.");
  });

  it("the bundled z-image source save (a subgraph with promoted inputs): prompt in, saved image out", async () => {
    const loaded = await loadOk(read(Z_IMAGE_SOURCE));
    expect(Object.keys(loaded.workflow).sort()).toStrictEqual(["76:62", "76:63", "76:65", "76:66", "76:67", "76:68", "76:69", "76:70", "76:71", "9"]);

    const { deps, calls, submitted } = createRunHarness({ outputs: { "9": { images: [image("z-image_00001_.png", "output")] } } });
    const outcome = await runCustomWorkflow(deps, { workflow: loaded.workflow, roles: loaded.roles, prompt: "a lighthouse at dusk", seed: 77, source: null });

    expect(outcome.kind).toBe("done");
    if (outcome.kind !== "done") return;
    expect(calls).toStrictEqual(["online", "nodes", "submit"]);
    expect(submitted[0]["76:67"].inputs.text).toBe("a lighthouse at dusk");
    expect(submitted[0]["76:71"].inputs.text).toBe(""); // the negative prompt is not the target
    expect(submitted[0]["76:69"].inputs.seed).toBe(77);
    expect(outcome.result.filename).toBe("from-9");
    expect(outcome.inputs[0]).toBe("Prompt goes to: CLIP Text Encode (Positive Prompt) (#76:67).");
    // The source save names the base model, not Turbo (see the PR): what it
    // says is what is sent.
    expect(submitted[0]["76:66"].inputs.unet_name).toBe("z_image_bf16.safetensors");
  });
});

describe("refusals", () => {
  const zImage = () => readJson(Z_IMAGE_SOURCE) as UiWorkflow;

  it("names every class this ComfyUI lacks, with the node pack the save records", async () => {
    const ui = zImage();
    const inner = ui.definitions?.subgraphs?.[0].nodes ?? [];
    const sampling = inner.find((node) => node.type === "ModelSamplingAuraFlow");
    const decode = inner.find((node) => node.type === "VAEDecode");
    if (!sampling || !decode) throw new Error("fixture changed");
    sampling.type = "ShiftSamplerPlus";
    sampling.properties = { ...sampling.properties, cnr_id: "comfyui-example-pack" };
    decode.type = "TiledDecodeX";
    decode.properties = { aux_id: "someone/tiled-decode" };

    const { deps, calls } = createLoadDeps();
    const result = await loadCustomWorkflowText(JSON.stringify(ui), deps);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("That workflow needs nodes this ComfyUI does not have.");
    expect(result.hint).toBe(
      "Not installed: ShiftSamplerPlus (from comfyui-example-pack), TiledDecodeX (from someone/tiled-decode). Install the node packs that provide them (ComfyUI Manager can find missing nodes), restart ComfyUI, then check again."
    );
    expect(result.missing).toStrictEqual([
      { classType: "ShiftSamplerPlus", pack: "comfyui-example-pack" },
      { classType: "TiledDecodeX", pack: "someone/tiled-decode" }
    ]);
    expect(calls).toStrictEqual(["online", "defs"]); // GET only; nothing submitted
    expectPlainText(result.reason);
    expectPlainText(result.hint ?? "");
  });

  it("a missing node nothing depends on is left out and named on the Inputs lines", async () => {
    const ui = zImage();
    ui.nodes.push({ id: 500, type: "Image Comparer (rgthree)", mode: 0, inputs: [], outputs: [], properties: { cnr_id: "rgthree-comfy" } });
    const loaded = await loadOk(JSON.stringify(ui));
    expect(loaded.notes).toContain(
      "Left out: Image Comparer (rgthree) (from rgthree-comfy). This ComfyUI does not have it, and the workflow was converted without it."
    );
    expect(Object.values(loaded.workflow).map((node) => node.class_type)).not.toContain("Image Comparer (rgthree)");
  });

  it("refuses legacy group nodes before any request", async () => {
    const ui = zImage();
    ui.extra = { ...ui.extra, groupNodes: { "My group": { nodes: [] } } };
    const { deps, calls } = createLoadDeps();
    const result = await loadCustomWorkflowText(JSON.stringify(ui), deps);
    expect(result).toStrictEqual({
      ok: false,
      reason: "OpenLayer cannot read that saved workflow.",
      hint: "This workflow uses legacy group nodes, which OpenLayer cannot read from a saved workflow. In ComfyUI, convert them to subgraphs and save again, or paste a File > Export (API) file instead."
    });
    expect(calls).toStrictEqual([]);
  });

  it("refuses an active Load3D or webcam node before any request, but not a bypassed one", async () => {
    for (const type of ["Load3D", "WebcamCapture"]) {
      const ui = zImage();
      ui.nodes.push({ id: 501, type, mode: 0, inputs: [], outputs: [] });
      const { deps, calls } = createLoadDeps();
      const result: CustomWorkflowLoadResult = await loadCustomWorkflowText(JSON.stringify(ui), deps);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.hint).toBe(
        `${type} cannot be read from a saved workflow, because ComfyUI's editor adds settings to it that the file does not hold. Paste a File > Export (API) file instead.`
      );
      expect(calls).toStrictEqual([]);
    }

    const bypassed = zImage();
    bypassed.nodes.push({ id: 502, type: "Load3D", mode: 4, inputs: [], outputs: [] });
    expect(precheckUiWorkflow(bypassed)).toBeNull();
  });

  it("a refusal reaches the screen as plain text and queues nothing", () => {
    const view = describeCustomRunOutcome({ kind: "refused", message: "Not installed: TiledDecodeX (from someone/tiled-decode)." });
    expect(view.diagnostics).toBe("Nothing was queued in ComfyUI.");
    expectPlainText(view.error);
  });
});
