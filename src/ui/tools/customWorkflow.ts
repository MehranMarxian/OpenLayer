import { isGenerationCancelledError } from "../../comfy/generationCancel";
import {
  chooseResultNode,
  fitSize,
  FoundTargets,
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

/**
 * True when every prompt target's own text is empty. OpenLayer's preset
 * graphs ship that way (the panel always writes the prompt), so a pasted copy
 * with an empty prompt box would send an empty prompt.
 */
function ownPromptIsEmpty(workflow: ComfyWorkflow, targets: ResolvedTargetSet): boolean {
  return targets.prompt.length > 0 && targets.prompt.every((target) => {
    const own = workflow[target.id]?.inputs[target.key];
    return typeof own !== "string" || !own.trim();
  });
}

/** What stops the run before anything is sent; null when nothing does. */
export function findLocalRefusal(
  workflow: ComfyWorkflow,
  targets: ResolvedTargetSet,
  source: CustomRunSource | null,
  prompt = ""
): string | null {
  if (!prompt.trim() && ownPromptIsEmpty(workflow, targets)) {
    return "Type a prompt first. This workflow's own prompt is empty.";
  }
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
    if (!context.prompt.trim()) {
      lines.push(
        ownPromptIsEmpty(workflow, targets)
          ? "The prompt box is empty, and so is the workflow's own prompt. Type a prompt."
          : "The prompt box is empty, so the workflow's own prompt is used."
      );
    }
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
  } else if (context.source) {
    // The artist picked "keep the workflow's own images" (TargetChoice.keepImages).
    lines.push("The workflow keeps its own images, so the captured one is not sent.");
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

// ---------------------------------------------------------------------------
// The screen (PR 3). Pure, so App.ts only copies these into elements.
// ---------------------------------------------------------------------------

/** The image picker's value for "send no layer" (TargetChoice.keepImages). Not a node id ComfyUI can produce. */
export const KEEP_IMAGES_OPTION = "keep-workflow-images";

/**
 * The first option of both pickers: automatic, or "choose" when nothing is.
 * Not "": the panel's readSelectValue falls back to an option's label when its
 * value is empty, which would read "Automatic: ..." as a pick.
 */
export const AUTO_TARGET_OPTION = "openlayer-automatic";

export type PickerOption = Readonly<{ value: string; label: string }>;
/** Options for one of the two static selects; the first option (AUTO_TARGET_OPTION) means automatic, or "choose" when nothing is. */
export type TargetPicker = Readonly<{ options: readonly PickerOption[] }>;
export type TargetPickers = Readonly<{ prompt: TargetPicker | null; image: TargetPicker | null }>;

/**
 * The two pickers for a workflow. The prompt picker is shown only when there
 * is a choice to make (several candidates, or none automatic). The image
 * picker is shown whenever the graph has a slot, because "Keep the workflow's
 * own images" is always a choice (Mehran's call for v0.50).
 */
export function buildTargetPickers(found: FoundTargets): TargetPickers {
  const promptCandidates = found.prompt.candidates;
  const auto = found.prompt.auto;
  const prompt: TargetPicker | null =
    !promptCandidates.length || (auto !== null && promptCandidates.length <= 1)
      ? null
      : {
          options: [
            { value: AUTO_TARGET_OPTION, label: auto === null ? "Choose a node..." : `Automatic: ${auto.map((c) => c.label).join(", ")}` },
            ...promptCandidates.map((c) => ({ value: c.id, label: c.label }))
          ]
        };

  const image: TargetPicker | null = found.image.length
    ? {
        options: [
          { value: AUTO_TARGET_OPTION, label: found.imageAuto ? `Automatic: ${found.imageAuto.label}` : "Choose a Load Image..." },
          ...found.image.map((slot) => ({ value: slot.id, label: `${slot.label}, used as ${slot.role}` })),
          { value: KEEP_IMAGES_OPTION, label: "Keep the workflow's own images" }
        ]
      }
    : null;

  return { prompt, image };
}

/**
 * Same options, same labels, same order: the pickers on screen still describe
 * this workflow. Labels count because two graphs can share node ids and still
 * be different graphs; a pick must not survive under a changed title.
 */
export function pickerSignature(pickers: TargetPickers): string {
  const entries = (picker: TargetPicker | null) => (picker ? picker.options.map((option) => [option.value, option.label]) : null);
  return JSON.stringify([entries(pickers.prompt), entries(pickers.image)]);
}

/** True when the select holds a real pick, not the automatic first option. */
export function isTargetPick(value: string): boolean {
  return Boolean(value) && value !== AUTO_TARGET_OPTION;
}

/** The two select values as the finder's choice. AUTO_TARGET_OPTION (or nothing) is "automatic". */
export function readTargetChoice(promptValue: string, imageValue: string): TargetChoice {
  return {
    prompt: isTargetPick(promptValue) ? promptValue : undefined,
    image: isTargetPick(imageValue) && imageValue !== KEEP_IMAGES_OPTION ? imageValue : undefined,
    keepImages: imageValue === KEEP_IMAGES_OPTION
  };
}

export type CustomRunView = Readonly<{
  status: string;
  tone: "idle" | "ready" | "error";
  /** The Inputs summary after the run; empty keeps what is on screen. */
  inputs: readonly string[];
  /** Diagnostics line: what was imported and what was left out. */
  diagnostics: string;
  /** Error box text; empty hides it. */
  error: string;
  /** Which picker needs the artist before the next Run. */
  needs: "prompt" | "image" | null;
}>;

/** What the screen shows for each outcome. */
export function describeCustomRunOutcome<TResult>(outcome: CustomRunOutcome<TResult>): CustomRunView {
  switch (outcome.kind) {
    case "choose":
      return {
        status: outcome.choose === "prompt" ? "Choose where the prompt goes." : "Choose where the image goes.",
        tone: "error",
        inputs: [],
        diagnostics:
          outcome.choose === "prompt"
            ? `Several nodes could take the prompt (${outcome.candidates.map((c) => c.label).join(", ")}). Pick one under Inputs, then click Run Workflow again.`
            : `Several Load Image nodes could take the image (${outcome.candidates.map((c) => c.label).join(", ")}). Pick one under Inputs, or keep the workflow's own images, then click Run Workflow again.`,
        error: "",
        needs: outcome.choose
      };
    case "refused":
      return { status: "Workflow not run.", tone: "error", inputs: [], diagnostics: "Nothing was queued in ComfyUI.", error: outcome.message, needs: null };
    case "failed":
      return { status: "Workflow failed.", tone: "error", inputs: [], diagnostics: "", error: outcome.message, needs: null };
    case "cancelled":
      return { status: "Generation cancelled.", tone: "idle", inputs: [], diagnostics: "", error: "", needs: null };
    case "done":
      return {
        status: "Workflow result ready.",
        tone: "ready",
        inputs: outcome.inputs,
        diagnostics: outcome.output.length ? outcome.output.join(" ") : "Click Import to Layers to place the result.",
        error: "",
        needs: null
      };
  }
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

  const refusal = findLocalRefusal(input.workflow, resolved, input.source, input.prompt);
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
