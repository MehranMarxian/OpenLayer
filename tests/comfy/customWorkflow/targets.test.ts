/*
 * The unit cases in the first describe block are ported from Geekatplay
 * Photoshop Bridge, tests/workflow.test.js at commit da5c617
 * (https://github.com/GeekatplayStudio/ComfyUI-Photoshop), by Geekatplay Studio -
 * Vladimir Chopine (https://www.geekatplay.com). MIT License, Copyright (c) 2026
 * Geekatplay Studio - Vladimir Chopine; the full notice is in
 * tests/fixtures/customWorkflow/geekatplay/LICENSE and src/comfy/customWorkflow/targets.ts.
 *
 * Changed in the port: the "OpenLayer" title marker replaces Geekatplay's node
 * classes and "Photoshop" titles, an image slot is chosen like the prompt
 * (asked when several fit), and resolveTargets returns what to choose instead
 * of throwing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findTargets,
  fitSize,
  FoundTargets,
  imageRoles,
  naturalCompare,
  resolveTargets,
  resultImages
} from "../../../src/comfy/customWorkflow/targets";
import { WORKFLOW_PRESETS } from "../../../src/comfy/presetRegistry";
import { ComfyWorkflow, WorkflowInjectionTargetList } from "../../../src/comfy/types";

const MARKED: ComfyWorkflow = {
  "1": { class_type: "LoadImage", _meta: { title: "OpenLayer source" }, inputs: { image: "old.png" } },
  "2": { class_type: "PrimitiveStringMultiline", _meta: { title: "OpenLayer prompt" }, inputs: { value: "default prompt" } },
  "3": { class_type: "CLIPTextEncode", inputs: { text: ["2", 0], clip: ["9", 1] } },
  "4": { class_type: "KSampler", inputs: { seed: 5, steps: 20, model: ["9", 0], positive: ["3", 0], latent_image: ["5", 0] } },
  "5": { class_type: "VAEEncode", inputs: { pixels: ["1", 0], vae: ["9", 2] } },
  "8": { class_type: "SaveImage", inputs: { images: ["4", 0], filename_prefix: "result" } }
};

// A plain workflow with no markers: checkpoint, two encoders, ControlNet passing both through.
const PLAIN: ComfyWorkflow = {
  "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "a.safetensors" } },
  "2": { class_type: "CLIPTextEncode", _meta: { title: "Positive" }, inputs: { text: "a fox", clip: ["1", 1] } },
  "3": { class_type: "CLIPTextEncode", _meta: { title: "Negative" }, inputs: { text: "blurry", clip: ["1", 1] } },
  "4": { class_type: "LoadImage", inputs: { image: "a.png" } },
  "5": { class_type: "ControlNetApplyAdvanced", inputs: { positive: ["2", 0], negative: ["3", 0], image: ["4", 0] } },
  "6": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "7": { class_type: "KSampler", inputs: { seed: 1, model: ["1", 0], positive: ["5", 0], negative: ["5", 1], latent_image: ["6", 0] } }
};

const ids = (list: Array<{ id: string }>) => list.map((t) => t.id);
const clone = (workflow: ComfyWorkflow) => JSON.parse(JSON.stringify(workflow)) as ComfyWorkflow;

describe("target finder, ported unit cases", () => {
  it("nodes titled OpenLayer are the automatic targets", () => {
    const targets = resolveTargets(MARKED);
    if (!targets.ok) throw new Error(`expected targets, got a ${targets.choose} choice`);
    expect(targets.image).toStrictEqual([{ id: "1", key: "image", label: "OpenLayer source (#1)", role: "pixels", source: "layer" }]);
    expect(targets.prompt).toStrictEqual([{ id: "2", key: "value", label: "OpenLayer prompt (#2)" }]);
  });

  it("without markers: the only Load Image and the text feeding the sampler's positive input", () => {
    const targets = resolveTargets(PLAIN);
    if (!targets.ok) throw new Error("expected targets");
    expect(ids(targets.image)).toStrictEqual(["4"]);
    expect(ids(targets.prompt)).toStrictEqual(["2"]); // the negative encoder behind the ControlNet is not picked
    expect(ids(targets.found.prompt.candidates)).toStrictEqual(["2", "3"]);
  });

  it("a prompt primitive feeding the encoder, guiders and titles are understood", () => {
    const primitive: ComfyWorkflow = {
      "1": { class_type: "PrimitiveStringMultiline", inputs: { value: "a fox" } },
      "2": { class_type: "CLIPTextEncode", inputs: { text: ["1", 0] } },
      "3": { class_type: "FluxGuidance", inputs: { conditioning: ["2", 0], guidance: 3.5 } },
      "4": { class_type: "BasicGuider", inputs: { conditioning: ["3", 0] } }
    };
    const targets = resolveTargets(primitive);
    expect(targets.ok && targets.prompt).toStrictEqual([{ id: "1", key: "value", label: "PrimitiveStringMultiline (#1)" }]);

    const titled = clone(PLAIN);
    titled["8"] = { class_type: "LoadImage", _meta: { title: "OpenLayer layer" }, inputs: { image: "b.png" } };
    titled["11"] = { class_type: "VAEEncode", inputs: { pixels: ["8", 0] } };
    const found = findTargets(titled);
    expect(ids(found.image)).toStrictEqual(["8", "4"]); // the marked node comes first
    expect(found.imageAuto?.id).toBe("8"); // and takes the layer without asking
  });

  it("every Load Image something reads is a slot in role order; with two unmarked slots the artist chooses", () => {
    const two = clone(PLAIN);
    two["8"] = { class_type: "LoadImage", inputs: { image: "b.png" } };
    two["9"] = { class_type: "TextEncodeQwenImageEditPlus", inputs: { "images.image_2": ["8", 0], "images.image_1": ["4", 0], prompt: "x" } };
    two["10"] = { class_type: "LoadImage", inputs: { image: "unused.png" } };
    const found = findTargets(two);
    expect(found.image.map((s) => [s.id, s.role])).toStrictEqual([["4", "image"], ["8", "image_2"]]);
    expect(found.imageAuto).toBeNull();

    const asked = resolveTargets(two);
    expect(asked.ok).toBe(false);
    expect(!asked.ok && asked.choose).toBe("image");
    expect(!asked.ok && ids(asked.candidates)).toStrictEqual(["4", "8"]);

    const chosen = resolveTargets(two, { image: "8" });
    expect(chosen.ok && chosen.image.map((s) => [s.id, s.source])).toStrictEqual([["4", "keep"], ["8", "layer"]]);

    const roles = imageRoles({
      nodes: [
        { id: 4, type: "LoadImage", outputs: [{ links: [1, 2] }] },
        { id: 8, type: "LoadImage", outputs: [{ links: [3] }] },
        { id: 20, type: "sub", inputs: [{ name: "image" }, { name: "image_1", label: "reference_image2" }] },
        { id: 21, type: "sub", inputs: [{ name: "image", label: "reference_image1" }] }
      ],
      links: [
        [1, 4, 0, 20, 0, "IMAGE"],
        [2, 4, 0, 21, 0, "IMAGE"],
        [3, 8, 0, 20, 1, "IMAGE"]
      ]
    });
    expect(roles).toStrictEqual({ "4": "reference_image1", "8": "reference_image2" }); // a labelled input names the role

    const compared = imageRoles({
      nodes: [
        { id: 1, type: "LoadImage", outputs: [{ links: [1, 2] }] },
        { id: 2, type: "ImageCompare", inputs: [{ name: "image_a" }] },
        { id: 3, type: "VAEEncode", inputs: [{ name: "pixels" }] }
      ],
      links: [
        [1, 1, 0, 2, 0, "IMAGE"],
        [2, 1, 0, 3, 0, "IMAGE"]
      ]
    });
    expect(compared).toStrictEqual({ "1": "pixels" }); // a before/after preview does not name the role
    expect(findTargets(two, roles).image.map((s) => s.role)).toStrictEqual(["reference_image1", "reference_image2"]);
  });

  it("a workflow with several prompt nodes asks the artist, and the saved choice is used", () => {
    const two = clone(PLAIN);
    two["9"] = { class_type: "CLIPTextEncode", inputs: { text: "second" } };
    two["7"].inputs.positive = ["10", 0];
    two["10"] = { class_type: "ConditioningCombine", inputs: { conditioning_1: ["5", 0], conditioning_2: ["9", 0] } };
    expect(findTargets(two).prompt.auto).toBeNull();
    const asked = resolveTargets(two);
    expect(!asked.ok && asked.choose).toBe("prompt");
    const chosen = resolveTargets(two, { prompt: "9" });
    expect(chosen.ok && ids(chosen.prompt)).toStrictEqual(["9"]);
  });

  it("a workflow without an image input generates from the prompt", () => {
    const generate = clone(PLAIN);
    delete generate["4"];
    delete generate["5"].inputs.image;
    const targets = resolveTargets(generate);
    expect(targets.ok && targets.image).toStrictEqual([]);
  });

  it("generation size follows the target shape and keeps the workflow's pixel count", () => {
    expect(fitSize({ width: 3000, height: 2000 }, 1024 * 1024)).toStrictEqual({ width: 1248, height: 832 });
    expect(fitSize({ width: 100, height: 100 }, 1024 * 1024)).toStrictEqual({ width: 1024, height: 1024 });
    expect(fitSize({ width: 1000, height: 2000 }, 1024 * 1024)).toStrictEqual({ width: 720, height: 1456 });
  });

  it("resultImages prefers saved images, then previews, and skips what cannot be placed", () => {
    const img = (filename: string, type: string) => ({ filename, subfolder: "", type });
    const outputs: Record<string, { images: ReturnType<typeof img>[] }> = {
      "10": { images: [img("saved_00001_.png", "output")] },
      "11": { images: [img("preview_00001_.png", "temp")] }
    };
    expect(resultImages({ outputs }).map((i) => i.filename)).toStrictEqual(["saved_00001_.png"]);
    delete outputs["10"];
    expect(resultImages({ outputs }).map((i) => i.filename)).toStrictEqual(["preview_00001_.png"]);
    expect(resultImages({ outputs: { "12": { images: [img("clip.mp4", "output")] } } })).toStrictEqual([]);
  });
});

describe("target finder, OpenLayer additions", () => {
  it("text nodes that feed no sampler mean the artist chooses; no text nodes means no prompt input", () => {
    const select: ComfyWorkflow = {
      "1": { class_type: "LoadImage", inputs: { image: "a.png" } },
      "2": { class_type: "CLIPTextEncode", inputs: { text: "cat", clip: ["3", 0] } },
      "4": { class_type: "SAM3Detect", inputs: { image: ["1", 0], conditioning: ["2", 0] } }
    };
    expect(findTargets(select).prompt.auto).toBeNull();
    const upscale: ComfyWorkflow = {
      "1": { class_type: "LoadImage", inputs: { image: "a.png" } },
      "2": { class_type: "ImageUpscaleWithModel", inputs: { image: ["1", 0] } }
    };
    expect(findTargets(upscale).prompt.auto).toStrictEqual([]);
  });

  it("two marked image nodes are as ambiguous as two unmarked ones", () => {
    const two = clone(PLAIN);
    two["4"]._meta = { title: "OpenLayer A" };
    two["8"] = { class_type: "LoadImage", _meta: { title: "OpenLayer B" }, inputs: { image: "b.png" } };
    two["9"] = { class_type: "VAEEncode", inputs: { pixels: ["8", 0] } };
    expect(findTargets(two).imageAuto).toBeNull();
  });

  it("roles sort naturally without Intl", () => {
    expect(["image10", "image2", "image1", "Image3"].sort(naturalCompare)).toStrictEqual(["image1", "image2", "Image3", "image10"]);
  });
});

// ---------------------------------------------------------------------------
// Test 4 of the v0.50 spike.
// ---------------------------------------------------------------------------

/**
 * Outcome of the finder on one bundled API graph, for one target, compared
 * with the registry's hand-made injection for that preset. The rules were
 * written down before the run:
 *
 * - correct: the automatic target is the registry's node and input.
 * - asked: several candidates fit, the artist chooses, and the registry's
 *   target is among them.
 * - asked-not-offered: the artist is asked but cannot pick the right node.
 * - silently-wrong: the automatic target is another node, or there is none
 *   while the registry has one (the prompt or layer would go nowhere), or
 *   there is one while the registry has none.
 * - not-applicable: neither the registry nor the finder has a target.
 */
type Outcome = "correct" | "asked" | "asked-not-offered" | "silently-wrong" | "not-applicable";

const key = (t: { id: string; key: string }) => `${t.id}.${t.key}`;

function registryKeys(target: WorkflowInjectionTargetList | undefined): string[] {
  if (!target) return [];
  const list = Array.isArray(target) ? target : [target];
  return list.map((t) => `${t.nodeId}.${t.inputName}`).sort();
}

function promptOutcome(found: FoundTargets, registry: string[]): Outcome {
  const auto = found.prompt.auto;
  if (auto === null) {
    const offered = new Set(found.prompt.candidates.map(key));
    return registry.length && registry.every((k) => offered.has(k)) ? "asked" : "asked-not-offered";
  }
  if (!registry.length) return auto.length ? "silently-wrong" : "not-applicable";
  return JSON.stringify(auto.map(key).sort()) === JSON.stringify(registry) ? "correct" : "silently-wrong";
}

function imageOutcome(found: FoundTargets, registry: string[]): Outcome {
  if (found.imageAuto === null && found.image.length > 1) {
    const offered = new Set(found.image.map(key));
    return registry.length && registry.every((k) => offered.has(k)) ? "asked" : "asked-not-offered";
  }
  if (!registry.length) return found.imageAuto ? "silently-wrong" : "not-applicable";
  return found.imageAuto && JSON.stringify([key(found.imageAuto)]) === JSON.stringify(registry) ? "correct" : "silently-wrong";
}

const SRC = resolve(__dirname, "../../../src");
const rows = WORKFLOW_PRESETS.map((preset) => {
  const api = JSON.parse(readFileSync(resolve(SRC, preset.workflowFile), "utf8")) as ComfyWorkflow;
  const found = findTargets(api);
  const sourceImage = registryKeys(preset.injections.sourceImage);
  return {
    id: preset.id,
    api,
    found,
    prompt: promptOutcome(found, registryKeys(preset.injections.positivePrompt)),
    image: imageOutcome(found, sourceImage),
    /** What the v0.50 plan's PR 2 rule (slot 0 gets the layer) would do when the finder asks. */
    slotZeroIsSource: found.image.length > 1 ? key(found.image[0]) === sourceImage[0] : undefined
  };
});

const count = (outcomes: Outcome[]) =>
  outcomes.reduce<Record<string, number>>((totals, outcome) => ({ ...totals, [outcome]: (totals[outcome] ?? 0) + 1 }), {});

describe("finder against the registry: prompt node and source image of every bundled API graph", () => {
  it("covers every preset", () => {
    expect(rows).toHaveLength(39);
  });

  it("no bundled graph carries the OpenLayer title marker, so this measures the structural ladder alone", () => {
    const marked = rows.flatMap((row) => Object.entries(row.api).filter(([, node]) => /openlayer/i.test(node._meta?.title ?? "")));
    expect(marked).toStrictEqual([]);
  });

  it("prompt: 29 correct, 2 asked, 8 without a prompt, none silently wrong", () => {
    expect(count(rows.map((row) => row.prompt))).toStrictEqual({ correct: 29, asked: 2, "not-applicable": 8 });
    const asked = rows.filter((row) => row.prompt === "asked");
    expect(asked.map((row) => row.id)).toStrictEqual(["enhance-prompt-superprompt", "select-sam31"]);
    // Each has one text node and no sampler. Geekatplay's rule as written
    // returned an empty list here and dropped the prompt: 2 silently wrong.
    expect(asked.map((row) => row.found.prompt.candidates.map(key))).toStrictEqual([["20.string"], ["12.text"]]);
  });

  it("source image: 28 correct, 3 asked, 8 without an image, none silently wrong", () => {
    expect(count(rows.map((row) => row.image))).toStrictEqual({ correct: 28, asked: 3, "not-applicable": 8 });
    expect(rows.filter((row) => row.image === "asked").map((row) => row.id)).toStrictEqual([
      "inpaint-basic",
      "inpaint-lama",
      "inpaint-lama-klein"
    ]);
  });

  it("filling slot 0 instead of asking (the plan's PR 2 rule) would put the layer into inpaint-basic's mask loader", () => {
    const wrong = rows.filter((row) => row.slotZeroIsSource === false).map((row) => row.id);
    expect(wrong).toStrictEqual(["inpaint-basic"]);
  });
});
