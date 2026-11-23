import { isGenerationCancelledError } from "../../comfy/generationCancel";
import {
  chooseResultNode,
  fitSize,
  ImageSlot,
  resolveTargets,
  ResolvedImageSlot,
  ResultChoice,
  TargetCandidate,
  TargetChoice
} from "../../comfy/customWorkflow/targets";
import {
  CustomWorkflowReport,
  evaluateCustomWorkflow,
  listCustomWorkflowClassTypes
} from "../../comfy/customWorkflowValidation";
import { ComfyHistoryItem, ComfyWorkflow } from "../../comfy/types";
import { WorkflowNodeAvailability } from "../../comfy/workflowCompatibility";
import { createOpenLayerError, getErrorMessage } from "../../utils/errors";

/**
 * Custom Workflow run: everything that does not need the panel or Photoshop.
 *
 * v0.50 PR 2. An artist's own API-format graph (GUI saves arrive in PR 4) is
 * mapped with the target finder ported in PR 1, refused or asked about when it
 * cannot be mapped without guessing, checked against this ComfyUI, filled in
 * and run through the same generation pipeline as every other tool. The panel
 * pieces (capture, the Run button, the Inputs summary, import) are PR 3; they
 * reach this module through `CustomRunDeps`, so the whole decision path is
 * tested here against a scripted client and the real generation controller.
 *
 * The rule the spike set: never silently wrong. The finder asks when several
 * nodes could take the prompt or the layer; this module refuses when a slot
 * that keeps its own image has none, and every place the prompt, the layer
 * and the selection go is spelled out in `inputs` before anything is sent.
 *
 * Every string here reaches the panel through textContent: plain text, no
 * backticks, no markdown, no double hyphens.
 */

/** Shown on the Custom Workflow screen (PR 3). Licence labels are something presets have and custom graphs do not. */
export const CUSTOM_WORKFLOW_WARNING =
  "Custom workflows skip OpenLayer's model checks and licence labels. Check the licence of every model the workflow loads before using its results for client work.";

export type CustomRunSource = Readonly<{
  blob: Blob;
  filename: string;
  /** Present when a selection was captured: white where the workflow may change the picture. */
  selectionMask?: Blob;
}>;

export type CustomRunInput = Readonly<{
  /** An API-format graph, as parseCustomWorkflowText returns it. */
  workflow: ComfyWorkflow;
  /** What the artist picked when the finder asked. */
  choice?: TargetChoice;
  roles?: Record<string, string>;
  prompt: string;
  /** Written into every unlinked seed and noise_seed input; null keeps the workflow's own. */
  seed: number | null;
  /** The captured layer, canvas or selection, if any. */
  source: CustomRunSource | null;
  /**
   * The shape to fit empty latents to (canvas or selection size). Pass it only
   * when no layer goes into the graph, as Geekatplay's prepareWorkflow does.
   */
  fitTo?: Readonly<{ width: number; height: number }>;
}>;

export type CustomRunDeps<TResult> = Readonly<{
  checkOnline(): Promise<void>;
  getNodeAvailability(classTypes: string[]): Promise<WorkflowNodeAvailability>;
  /** Puts the selection into the PNG's alpha (createFluxFillEmbeddedMaskSource in the panel). */
  embedMask(source: Blob, mask: Blob): Promise<{ blob: Blob; filename: string }>;
  uploadImage(blob: Blob, filename: string): Promise<string>;
  /**
   * Submits through generation.runPipeline and fetches the image of the node
   * `pickOutput` names. Resolves null when the run was cancelled. Cancelling is
   * the panel's Cancel button and the controller's job; nothing here sends one.
   */
  run(workflow: ComfyWorkflow, pickOutput: (history: ComfyHistoryItem) => string): Promise<TResult | null>;
  progress(message: string): void;
}>;

export type CustomRunOutcome<TResult> =
  | Readonly<{ kind: "choose"; choose: "prompt"; candidates: readonly TargetCandidate[] }>
  | Readonly<{ kind: "choose"; choose: "image"; candidates: readonly ImageSlot[] }>
  | Readonly<{ kind: "refused"; message: string; report?: CustomWorkflowReport }>
  | Readonly<{ kind: "failed"; message: string; error: unknown }>
  | Readonly<{ kind: "cancelled" }>
  | Readonly<{
      kind: "done";
      result: TResult;
      /** Where the prompt, the layer and the selection went. */
      inputs: readonly string[];
      /** Which output was imported, and what was left out. */
      output: readonly string[];
      submitted: ComfyWorkflow;
      uploadedImageName: string | null;
      seedsWritten: number;
    }>;

type ResolvedTargetSet = Readonly<{ image: readonly ResolvedImageSlot[]; prompt: readonly TargetCandidate[] }>;

function isLink(value: unknown): value is [string, number] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "string";
}

function nodeLabel(workflow: ComfyWorkflow, id: string): string {
  const node = workflow[id];
  return `${node?._meta?.title ?? node?.class_type ?? "Node"} (#${id})`;
}

/** True when something reads the loader's second output, which core LoadImage fills with 1 minus the PNG's alpha. */
export function readsLoaderMask(workflow: ComfyWorkflow, loaderId: string): boolean {
  return Object.values(workflow).some((node) =>
    Object.values(node.inputs).some((value) => isLink(value) && value[0] === loaderId && value[1] === 1)
  );
}

/**
 * Whether the selection travels as the image's alpha. Only core LoadImage is
 * known to turn alpha into a MASK on output 1; the finder also matches other
 * LoadImage-named classes, whose outputs this does not assume anything about.
 */
export function sendsSelectionAsMask(workflow: ComfyWorkflow, slot: Pick<ImageSlot, "id">): boolean {
  return workflow[slot.id]?.class_type === "LoadImage" && readsLoaderMask(workflow, slot.id);
}

function labels(workflow: ComfyWorkflow, targets: readonly { id: string }[]): string {
  return targets.map((target) => nodeLabel(workflow, target.id)).join(", ");
}

/** What stops the run before anything is sent; null when nothing does. */
export function findLocalRefusal(workflow: ComfyWorkflow, targets: ResolvedTargetSet, source: CustomRunSource | null): string | null {
  const layerSlot = targets.image.find((slot) => slot.source === "layer");
  if (layerSlot && !source) {
    return `Capture a layer, the canvas or a selection first. This workflow sends it to ${nodeLabel(workflow, layerSlot.id)}.`;
  }
  for (const slot of targets.image.filter((entry) => entry.source === "keep")) {
    const image = workflow[slot.id]?.inputs[slot.key];
    if (typeof image !== "string" || !image.trim()) {
      return `${nodeLabel(workflow, slot.id)} has no image of its own. Choose it for the layer instead, or give it an image in ComfyUI and export the workflow again.`;
    }
  }
  return null;
}

/**
 * The Inputs summary: where the prompt, the layer and the selection go. PR 3
 * shows these lines before Run; a finished run returns them again.
 */
export function describeCustomInputs(
  workflow: ComfyWorkflow,
  targets: ResolvedTargetSet,
  context: Readonly<{ prompt: string; source: CustomRunSource | null }>
): string[] {
  const lines: string[] = [];

  if (targets.prompt.length) {
    lines.push(`Prompt goes to: ${labels(workflow, targets.prompt)}.`);
    if (!context.prompt.trim()) lines.push("The prompt box is empty, so the workflow's own prompt is used.");
  } else {
    lines.push("This workflow has no prompt input, so the prompt box is not used.");
  }

  const layerSlot = targets.image.find((slot) => slot.source === "layer");
  if (layerSlot) {
    const slotLabel = nodeLabel(workflow, layerSlot.id);
    lines.push(`Image goes to: ${slotLabel}.`);
    // Only what OpenLayer does is stated. Whether the graph masks some other
    // way (a second loader's own mask file, say) is the graph's business.
    const readsMask = readsLoaderMask(workflow, layerSlot.id);
    if (readsMask && workflow[layerSlot.id]?.class_type !== "LoadImage") {
      lines.push(`${slotLabel} is not a core Load Image node, so it gets the picture only, never the selection as a mask.`);
    } else if (context.source?.selectionMask) {
      lines.push(
        readsMask
          ? "The selection goes in as that image's mask."
          : "The selection is not sent as a mask, because this workflow does not read one from that image."
      );
    } else if (readsMask) {
      lines.push("This workflow reads a mask from that image. Capture a selection to say where it should change.");
    }
  } else if (!targets.image.length) {
    lines.push(context.source ? "This workflow takes no image, so the captured one is not sent." : "This workflow takes no image.");
  }

  for (const slot of targets.image.filter((entry) => entry.source === "keep")) {
    const image = workflow[slot.id]?.inputs[slot.key];
    lines.push(`${nodeLabel(workflow, slot.id)} keeps its own image${typeof image === "string" && image ? `, ${image}` : ""}.`);
  }

  return lines;
}

export type PreparedCustomWorkflow = Readonly<{
  workflow: ComfyWorkflow;
  /** How many seed or noise_seed inputs took the panel's seed. */
  seedsWritten: number;
  /** The size empty latents were fitted to, when they were. */
  size: Readonly<{ width: number; height: number }> | null;
}>;

/**
 * A copy of the workflow with the prompt, the uploaded layer, the seed and the
 * fitted size written in. Links are never overwritten: a seed fed by another
 * node stays fed by it.
 */
export function prepareCustomWorkflow(
  workflow: ComfyWorkflow,
  targets: ResolvedTargetSet,
  options: Readonly<{
    prompt: string;
    layerImageName: string | null;
    seed: number | null;
    fitTo?: Readonly<{ width: number; height: number }>;
  }>
): PreparedCustomWorkflow {
  const prepared = JSON.parse(JSON.stringify(workflow)) as ComfyWorkflow;

  if (options.prompt.trim()) {
    for (const target of targets.prompt) prepared[target.id].inputs[target.key] = options.prompt;
  }

  const layerSlot = targets.image.find((slot) => slot.source === "layer");
  if (layerSlot && options.layerImageName) prepared[layerSlot.id].inputs[layerSlot.key] = options.layerImageName;

  let seedsWritten = 0;
  if (options.seed !== null) {
    for (const node of Object.values(prepared)) {
      for (const key of ["seed", "noise_seed"]) {
        if (typeof node.inputs[key] === "number") {
          node.inputs[key] = options.seed;
          seedsWritten++;
        }
      }
    }
  }

  let size: { width: number; height: number } | null = null;
  if (options.fitTo) {
    for (const node of Object.values(prepared)) {
      const { width, height } = node.inputs;
      if (!/^Empty.*Latent/.test(node.class_type) || typeof width !== "number" || typeof height !== "number") continue;
      size = fitSize(options.fitTo, width * height);
      node.inputs.width = size.width;
      node.inputs.height = size.height;
    }
  }

  return { workflow: prepared, seedsWritten, size };
}

/** Which output was imported, in words; empty when there was one picture from one node. */
export function describeResultChoice(workflow: ComfyWorkflow, choice: ResultChoice): string[] {
  const lines: string[] = [];
  const picked = nodeLabel(workflow, choice.nodeId);
  if (choice.tier === "preview") lines.push(`This workflow saves no picture, so the preview from ${picked} is used.`);
  if (choice.others.length) {
    const left = labels(workflow, choice.others.map((id) => ({ id })));
    lines.push(`Pictures came from ${choice.others.length + 1} nodes. ${picked} is used; ${left} ${choice.others.length === 1 ? "is" : "are"} left out.`);
  }
  if (choice.imageCount > 1) lines.push(`${picked} returned ${choice.imageCount} pictures. The first is used.`);
  return lines;
}

const NO_NEW_PICTURE =
  "This workflow returned no new picture to import. It needs a Save Image or Preview Image node that shows a result, not the input.";

/**
 * Runs a custom workflow from the artist's choices to a retrieved picture.
 *
 * Order matters and is tested: the finder and every local refusal come first
 * (no network), then the ComfyUI and node check, then the upload, then the
 * run. Import is not here: like every other tool, the panel imports a finished
 * result with its Import button or the auto-import setting (PR 3).
 */
export async function runCustomWorkflow<TResult>(
  deps: CustomRunDeps<TResult>,
  input: CustomRunInput
): Promise<CustomRunOutcome<TResult>> {
  const resolved = resolveTargets(input.workflow, input.choice ?? {}, input.roles);
  if (!resolved.ok) {
    return resolved.choose === "prompt"
      ? { kind: "choose", choose: "prompt", candidates: resolved.candidates }
      : { kind: "choose", choose: "image", candidates: resolved.candidates };
  }

  const refusal = findLocalRefusal(input.workflow, resolved, input.source);
  if (refusal) return { kind: "refused", message: refusal };

  const inputs = describeCustomInputs(input.workflow, resolved, { prompt: input.prompt, source: input.source });

  try {
    deps.progress("Checking ComfyUI...");
    await deps.checkOnline();
    const classTypes = listCustomWorkflowClassTypes(input.workflow);
    const availability = await deps.getNodeAvailability(classTypes);
    // Same guard as the Check button: an empty answer for a graph with nodes
    // is a server that stopped answering, not one that has none of them.
    if (classTypes.length > 0 && Object.keys(availability).length === 0) await deps.checkOnline();
    const report = evaluateCustomWorkflow(input.workflow, availability);
    if (!report.canRun) return { kind: "refused", message: report.summaryLine, report };

    let uploadedImageName: string | null = null;
    const layerSlot = resolved.image.find((slot) => slot.source === "layer");
    if (layerSlot && input.source) {
      deps.progress("Uploading the image to ComfyUI...");
      const mask = input.source.selectionMask;
      const upload =
        mask && sendsSelectionAsMask(input.workflow, layerSlot)
          ? await deps.embedMask(input.source.blob, mask)
          : { blob: input.source.blob, filename: input.source.filename };
      uploadedImageName = await deps.uploadImage(upload.blob, upload.filename);
    }

    const prepared = prepareCustomWorkflow(input.workflow, resolved, {
      prompt: input.prompt,
      layerImageName: uploadedImageName,
      seed: input.seed,
      fitTo: input.fitTo
    });
    if (input.seed !== null && prepared.seedsWritten === 0) {
      inputs.push("This workflow has no seed input, so running it again unchanged may return the same picture.");
    }
    if (prepared.seedsWritten > 1) {
      inputs.push(`The seed goes into all ${prepared.seedsWritten} seed inputs, so samplers that had different seeds now share one.`);
    }
    if (prepared.size) inputs.push(`Size: ${prepared.size.width} x ${prepared.size.height}.`);

    const picked: { choice: ResultChoice | null } = { choice: null };
    const result = await deps.run(prepared.workflow, (history) => {
      picked.choice = chooseResultNode(prepared.workflow, history);
      if (!picked.choice) throw createOpenLayerError("COMFY_NO_IMAGE", NO_NEW_PICTURE);
      return picked.choice.nodeId;
    });
    if (result === null) return { kind: "cancelled" };

    return {
      kind: "done",
      result,
      inputs,
      output: picked.choice ? describeResultChoice(prepared.workflow, picked.choice) : [],
      submitted: prepared.workflow,
      uploadedImageName,
      seedsWritten: prepared.seedsWritten
    };
  } catch (error) {
    if (isGenerationCancelledError(error)) return { kind: "cancelled" };
    return { kind: "failed", message: getErrorMessage(error), error };
  }
}
