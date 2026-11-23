import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createGenerationCancelledError } from "../../src/comfy/generationCancel";
import { fitSize, resolveTargets } from "../../src/comfy/customWorkflow/targets";
import { ComfyHistoryItem, ComfyWorkflow, GeneratedImageResult } from "../../src/comfy/types";
import { explainWorkflowRejection, markExplainedRejection, parseComfyRejectionBody } from "../../src/comfy/workflowRejection";
import { createGenerationController, GenerationPipelineMessages } from "../../src/ui/generationController";
import {
  CUSTOM_WORKFLOW_WARNING,
  CustomRunDeps,
  CustomRunInput,
  describeCustomInputs,
  findLocalRefusal,
  prepareCustomWorkflow,
  runCustomWorkflow
} from "../../src/ui/tools/customWorkflow";
import { createOpenLayerError } from "../../src/utils/errors";

/**
 * v0.50 PR 2: the custom workflow run path, end to end below the panel. The
 * orchestrator runs through the real generation controller against a scripted
 * client, so submit, poll, retrieve, commit and cancel are the code every
 * other tool uses. What needs Photoshop (capture, import, mask polarity on a
 * real selection) is PR 3's check.
 */

const ROOT = resolve(__dirname, "../..");
const readJson = (path: string) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
const bundled = (name: string) => readJson(`src/workflows/api/${name}.json`) as ComfyWorkflow;
// The stock Flux Fill inpaint template, standing in for the Discussion 179 graph.
const ONE_REWARD = readJson("tests/fixtures/customWorkflow/frontend-1.57.6/image_flux.1_fill_dev_OneReward.api.json") as ComfyWorkflow;

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

const image = (filename: string, type: string) => ({ filename, subfolder: "", type });

/** History the OneReward graph produces: SaveImage is bypassed, preview 105 is the result, preview 121 shows the input. */
const ONE_REWARD_HISTORY: ComfyHistoryItem = {
  outputs: {
    "105": { images: [image("ComfyUI_temp_result_00001_.png", "temp")] },
    "121": { images: [image("ComfyUI_temp_input_00001_.png", "temp")] }
  }
};

type Script = {
  history?: ComfyHistoryItem;
  submit?: () => Promise<string>;
  duringPoll?: () => void;
  availability?: (classTypes: string[]) => Record<string, readonly string[]>;
};

function createHarness(script: Script = {}) {
  const controller = createGenerationController({ onRunStarted: vi.fn(), onRunFinished: vi.fn() });
  const calls: string[] = [];
  const submitted: ComfyWorkflow[] = [];
  const client = {
    submitPrompt: vi.fn(async (workflow: object) => {
      calls.push("submit");
      submitted.push(workflow as ComfyWorkflow);
      return script.submit ? script.submit() : "prompt-1";
    }),
    watchProgress: vi.fn(() => null),
    pollUntilComplete: vi.fn(async (_promptId: string, options: { onTick: (message: string) => void; isCancelled: () => boolean }) => {
      script.duringPoll?.();
      if (options.isCancelled()) throw createGenerationCancelledError();
      return script.history ?? ONE_REWARD_HISTORY;
    }),
    retrieveFirstOutputImage: vi.fn(
      async (_promptId: string, _history: ComfyHistoryItem, options: { preferredNodeId?: string }): Promise<GeneratedImageResult> => ({
        blob: new Blob(["png"]),
        filename: `from-${options.preferredNodeId}`,
        mimeType: "image/png"
      })
    ),
    cancelPrompt: vi.fn(async () => "interrupted" as const)
  };
  const commit = vi.fn();
  const deps: CustomRunDeps<GeneratedImageResult> = {
    checkOnline: vi.fn(async () => {
      calls.push("online");
    }),
    getNodeAvailability: vi.fn(async (classTypes: string[]) => {
      calls.push("nodes");
      return script.availability ? script.availability(classTypes) : Object.fromEntries(classTypes.map((c) => [c, [] as string[]]));
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
        toolType: "image-to-image",
        client,
        workflow,
        originatingDocument: null,
        ui: UI,
        messages: MESSAGES,
        retrieve: (promptId, history) => client.retrieveFirstOutputImage(promptId, history, { preferredNodeId: pickOutput(history) }),
        commit
      }),
    progress: vi.fn()
  };
  return { controller, client, deps, calls, submitted, commit };
}

const selection = { blob: new Blob(["crop"]), filename: "openlayer-selection.png", selectionMask: new Blob(["mask"]) };
const layer = { blob: new Blob(["layer"]), filename: "openlayer-layer.png" };
const input = (overrides: Partial<CustomRunInput> & Pick<CustomRunInput, "workflow">): CustomRunInput => ({
  prompt: "a red scarf",
  seed: 1234,
  source: layer,
  ...overrides
});

describe("custom workflow run: end to end below the panel", () => {
  it("runs the Flux Fill stand-in: selection as mask, prompt into the subgraph encoder, the result preview imported", async () => {
    const { deps, calls, submitted, commit, client } = createHarness();
    const outcome = await runCustomWorkflow(deps, input({ workflow: ONE_REWARD, source: selection }));

    expect(outcome.kind).toBe("done");
    if (outcome.kind !== "done") return;
    expect(calls).toStrictEqual(["online", "nodes", "embed", "upload", "submit"]);
    expect(deps.uploadImage).toHaveBeenCalledWith(expect.any(Blob), "openlayer-custom-masked.png");

    const sent = submitted[0];
    expect(sent["108:23"].inputs.text).toBe("a red scarf");
    expect(sent["17"].inputs.image).toBe("uploaded-openlayer-custom-masked.png");
    expect(sent["108:3"].inputs.seed).toBe(1234);
    expect(outcome.seedsWritten).toBe(1);
    expect(ONE_REWARD["17"].inputs.image).toBe("image_flux.1_fill_dev_OneReward_input_image.png"); // the original is untouched

    expect(outcome.result.filename).toBe("from-105"); // the result preview, not the preview of the input (121)
    expect(commit).toHaveBeenCalledTimes(1);
    expect(outcome.inputs).toStrictEqual([
      "Prompt goes to: CLIP Text Encode (Positive Prompt) (#108:23).",
      "Image goes to: Load Image (#17).",
      "The selection goes in as that image's mask."
    ]);
    expect(outcome.output).toStrictEqual(["This workflow saves no picture, so the preview from Preview Image (#105) is used."]);
    expect(client.cancelPrompt).not.toHaveBeenCalled();
  });

  it("asks which Load Image takes the layer when there are two, before touching the network", async () => {
    const { deps, calls } = createHarness();
    const outcome = await runCustomWorkflow(deps, input({ workflow: bundled("inpaint-basic") }));

    expect(outcome.kind).toBe("choose");
    expect(outcome.kind === "choose" && outcome.choose).toBe("image");
    expect(outcome.kind === "choose" && outcome.candidates.map((c) => c.id)).toStrictEqual(["12", "10"]);
    expect(calls).toStrictEqual([]);

    const chosen = createHarness();
    const run = await runCustomWorkflow(chosen.deps, input({ workflow: bundled("inpaint-basic"), choice: { image: "10" } }));
    expect(run.kind).toBe("done");
    expect(chosen.submitted[0]["10"].inputs.image).toBe("uploaded-openlayer-layer.png");
    expect(chosen.submitted[0]["12"].inputs.image).toBe("openlayer-inpaint-mask.png");
  });

  it("asks which node takes the prompt when text nodes feed no sampler", async () => {
    const { deps, calls } = createHarness();
    const outcome = await runCustomWorkflow(deps, input({ workflow: bundled("select-sam31") }));
    expect(outcome.kind === "choose" && outcome.choose).toBe("prompt");
    expect(calls).toStrictEqual([]);
  });

  it("refuses without a captured source, before the network", async () => {
    const { deps, calls } = createHarness();
    const outcome = await runCustomWorkflow(deps, input({ workflow: ONE_REWARD, source: null }));
    expect(outcome).toStrictEqual({
      kind: "refused",
      message: "Capture a layer, the canvas or a selection first. This workflow sends it to Load Image (#17)."
    });
    expect(calls).toStrictEqual([]);
  });

  it("refuses when this ComfyUI lacks a node, before uploading", async () => {
    const { deps, calls } = createHarness({
      availability: (classTypes) => Object.fromEntries(classTypes.filter((c) => c !== "DifferentialDiffusion").map((c) => [c, []]))
    });
    const outcome = await runCustomWorkflow(deps, input({ workflow: ONE_REWARD, source: selection }));
    expect(outcome.kind).toBe("refused");
    expect(outcome.kind === "refused" && outcome.report?.missingNodeClasses).toStrictEqual(["DifferentialDiffusion"]);
    expect(calls).toStrictEqual(["online", "nodes"]);
  });

  it("passes ComfyUI's explained rejection through as a failure, and commits nothing", async () => {
    // Custom runs skip the preset model checks, so a missing model first shows
    // up here, as /prompt's validation error. This is the text submitPrompt
    // throws for a real ComfyUI 0.37 rejection.
    const fixture = readJson("tests/fixtures/comfy-rejections/checkpoint-not-in-list.json");
    const body = JSON.stringify(fixture.body);
    const explanation = explainWorkflowRejection(parseComfyRejectionBody(body));
    if (!explanation) throw new Error("the fixture should be explainable");
    const { deps, commit } = createHarness({
      submit: async () => {
        throw markExplainedRejection(createOpenLayerError("COMFY_REJECTED_WORKFLOW", explanation.message, body));
      }
    });
    const outcome = await runCustomWorkflow(deps, input({ workflow: bundled("img2img-basic") }));
    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.message).toBe(explanation.message);
    expect(outcome.kind === "failed" && outcome.message).toContain("not-on-disk.safetensors");
    expect(commit).not.toHaveBeenCalled();
  });

  it("a cancel from the panel ends the run as cancelled, commits nothing, and sends no interrupt itself", async () => {
    const harness = createHarness({ duringPoll: () => void harness.controller.cancelActive() });
    const outcome = await runCustomWorkflow(harness.deps, input({ workflow: ONE_REWARD, source: selection }));
    expect(outcome).toStrictEqual({ kind: "cancelled" });
    expect(harness.commit).not.toHaveBeenCalled();
    expect(harness.client.cancelPrompt).not.toHaveBeenCalled();
  });

  it("fails rather than importing the input when the only picture is a preview of it", async () => {
    const { deps, commit } = createHarness({ history: { outputs: { "121": ONE_REWARD_HISTORY.outputs?.["121"] ?? {} } } });
    const outcome = await runCustomWorkflow(deps, input({ workflow: ONE_REWARD, source: selection }));
    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.message).toMatch(/no new picture/);
    expect(commit).not.toHaveBeenCalled();
  });

  it("says so when the workflow has no seed and no prompt", async () => {
    const history: ComfyHistoryItem = { outputs: { "9": { images: [image("OpenLayer_Upscale_00001_.png", "output")] } } };
    const { deps } = createHarness({ history });
    const outcome = await runCustomWorkflow(deps, input({ workflow: bundled("upscale-basic") }));
    expect(outcome.kind === "done" && outcome.inputs).toStrictEqual([
      "This workflow has no prompt input, so the prompt box is not used.",
      "Image goes to: Load Source Image (#10).",
      "This workflow has no seed input, so running it again unchanged may return the same picture."
    ]);
    expect(outcome.kind === "done" && outcome.output).toStrictEqual([]);
  });

  it("names the other outputs and the extra pictures of a batch", async () => {
    const history: ComfyHistoryItem = {
      outputs: {
        "9": { images: [image("a_00001_.png", "output"), image("a_00002_.png", "output")] },
        "20": { images: [image("b_00001_.png", "output")] }
      }
    };
    const workflow = { ...bundled("txt2img-basic"), "20": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "b" } } };
    const { deps } = createHarness({ history });
    const outcome = await runCustomWorkflow(deps, input({ workflow, source: null }));
    expect(outcome.kind === "done" && outcome.result.filename).toBe("from-9");
    expect(outcome.kind === "done" && outcome.output).toStrictEqual([
      "Pictures came from 2 nodes. Save Image (#9) is used; SaveImage (#20) is left out.",
      "Save Image (#9) returned 2 pictures. The first is used."
    ]);
  });
});

describe("custom workflow run: the pure pieces", () => {
  it("writes the seed only into unlinked seed inputs and counts them", () => {
    const workflow: ComfyWorkflow = {
      "1": { class_type: "KSampler", inputs: { seed: 5, positive: ["2", 0] } },
      "2": { class_type: "CLIPTextEncode", inputs: { text: "x" } },
      "3": { class_type: "RandomNoise", inputs: { noise_seed: 9 } },
      "4": { class_type: "KSamplerAdvanced", inputs: { noise_seed: ["5", 0] } },
      "5": { class_type: "PrimitiveInt", inputs: { value: 1 } }
    };
    const resolved = resolveTargets(workflow);
    if (!resolved.ok) throw new Error("expected targets");
    const prepared = prepareCustomWorkflow(workflow, resolved, { prompt: "", layerImageName: null, seed: 77 });
    expect(prepared.seedsWritten).toBe(2);
    expect(prepared.workflow["1"].inputs.seed).toBe(77);
    expect(prepared.workflow["3"].inputs.noise_seed).toBe(77);
    expect(prepared.workflow["4"].inputs.noise_seed).toStrictEqual(["5", 0]);
    expect(prepared.workflow["2"].inputs.text).toBe("x"); // an empty prompt box keeps the workflow's text

    const kept = prepareCustomWorkflow(workflow, resolved, { prompt: "y", layerImageName: null, seed: null });
    expect(kept.seedsWritten).toBe(0);
    expect(kept.workflow["1"].inputs.seed).toBe(5);
    expect(kept.workflow["2"].inputs.text).toBe("y");
  });

  it("fits an empty latent to the canvas shape at the workflow's pixel count", () => {
    const workflow = bundled("txt2img-basic");
    const resolved = resolveTargets(workflow);
    if (!resolved.ok) throw new Error("expected targets");
    const prepared = prepareCustomWorkflow(workflow, resolved, { prompt: "a fox", layerImageName: null, seed: null, fitTo: { width: 1000, height: 2000 } });
    expect(prepared.size).toStrictEqual(fitSize({ width: 1000, height: 2000 }, 1024 * 1024));
    expect([prepared.workflow["5"].inputs.width, prepared.workflow["5"].inputs.height]).toStrictEqual([720, 1456]);
  });

  it("describes a mask the workflow ignores, and a mask it wants but did not get", () => {
    const img2img = bundled("img2img-basic");
    const resolvedImg2img = resolveTargets(img2img);
    if (!resolvedImg2img.ok) throw new Error("expected targets");
    expect(describeCustomInputs(img2img, resolvedImg2img, { prompt: "x", source: selection })).toContain(
      "This workflow does not read a mask from that image, so the whole captured area can change."
    );

    const resolvedFill = resolveTargets(ONE_REWARD);
    if (!resolvedFill.ok) throw new Error("expected targets");
    expect(describeCustomInputs(ONE_REWARD, resolvedFill, { prompt: "", source: layer })).toStrictEqual([
      "Prompt goes to: CLIP Text Encode (Positive Prompt) (#108:23).",
      "The prompt box is empty, so the workflow's own prompt is used.",
      "Image goes to: Load Image (#17).",
      "This workflow reads a mask from that image. Capture a selection to say where it should change."
    ]);

    const txt2img = bundled("txt2img-basic");
    const resolvedTxt = resolveTargets(txt2img);
    if (!resolvedTxt.ok) throw new Error("expected targets");
    expect(describeCustomInputs(txt2img, resolvedTxt, { prompt: "x", source: layer })).toContain(
      "This workflow takes no image, so the captured one is not sent."
    );
  });

  it("names the slot that keeps its own image, and refuses one that has none", () => {
    const workflow = bundled("inpaint-basic");
    const resolved = resolveTargets(workflow, { image: "10" });
    if (!resolved.ok) throw new Error("expected targets");
    expect(describeCustomInputs(workflow, resolved, { prompt: "x", source: layer })).toContain(
      "Load Inpaint Mask (#12) keeps its own image, openlayer-inpaint-mask.png."
    );
    expect(findLocalRefusal(workflow, resolved, layer)).toBeNull();

    const empty = JSON.parse(JSON.stringify(workflow)) as ComfyWorkflow;
    empty["12"].inputs.image = "";
    const resolvedEmpty = resolveTargets(empty, { image: "10" });
    if (!resolvedEmpty.ok) throw new Error("expected targets");
    expect(findLocalRefusal(empty, resolvedEmpty, layer)).toBe(
      "Load Inpaint Mask (#12) has no image of its own. Choose it for the layer instead, or give it an image in ComfyUI and export the workflow again."
    );
  });

  it("every sentence is plain text for textContent", () => {
    const sentences = [
      CUSTOM_WORKFLOW_WARNING,
      ...describeCustomInputs(ONE_REWARD, resolveTargets(ONE_REWARD) as never, { prompt: "", source: selection })
    ];
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/`|--|\*\*|Photoshop (layer|panel|plugin)/i);
    }
  });
});
