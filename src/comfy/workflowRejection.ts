import { CUSTOM_NODE_PACKAGES } from "./setupManifest";
import { MODEL_FOLDER_BY_OBJECT_INFO_NODE } from "./modelFolders";

/**
 * Turns ComfyUI's rejection of a workflow into sentences an artist can act on.
 *
 * When `POST /prompt` fails validation, ComfyUI answers HTTP 400 with JSON
 * like `{"error": {"type": "prompt_outputs_failed_validation"}, "node_errors":
 * {"1": {"class_type": "CheckpointLoaderSimple", "errors": [{"type":
 * "value_not_in_list", "extra_info": {"input_name": "ckpt_name",
 * "received_value": "x.safetensors"}}]}}}`. Until this module, the artist read
 * "ComfyUI rejected the workflow with HTTP 400." with the JSON in diagnostics
 * (codebase review finding 8), and the most common cause by far, a model in
 * the wrong folder, was the hardest to see in it.
 *
 * Shapes are taken from real ComfyUI 0.37.0 responses, recorded in
 * `tests/fixtures/comfy-rejections/`. Pure and synchronous: the caller may add
 * a wrong-folder finding afterwards (see `ComfyClient.submitPrompt`), which
 * needs the model inventory and therefore a server.
 *
 * Every sentence here reaches the panel through textContent: plain text, no
 * backticks, no markdown.
 */

export type ComfyRejectionBody = {
  error?: { type?: string; message?: string; details?: string; extra_info?: Record<string, unknown> };
  node_errors?: Record<string, ComfyNodeErrorEntry>;
};

type ComfyNodeErrorEntry = {
  class_type?: string;
  errors?: Array<{ type?: string; message?: string; details?: string; extra_info?: Record<string, unknown> }>;
};

/** A model name ComfyUI could not find, with the loader that wanted it. */
export type MissingModelFinding = {
  loaderNode: string;
  inputName: string;
  modelName: string;
};

export type WorkflowRejectionExplanation = {
  /** The sentences for the status bar, most useful first. */
  message: string;
  /** Model files ComfyUI did not list, for a follow-up wrong-folder check. */
  missingModels: MissingModelFinding[];
};

// At most this many problems are spelled out; the rest are counted. A long
// list in a status bar is read as "everything is broken".
const MAX_SENTENCES = 2;

const LORA_LOADERS = new Set(["LoraLoader", "LoraLoaderModelOnly"]);

// Errors whose message came from explainWorkflowRejection. A WeakSet rather
// than a new error code: the error is still a rejected workflow to everything
// that checks its code, and only the copy shown to the artist differs.
const explainedErrors = new WeakSet<object>();

export function markExplainedRejection<T extends object>(error: T): T {
  explainedErrors.add(error);
  return error;
}

/** True only for a rejection whose message already says what went wrong. */
export function isExplainedRejection(error: unknown): boolean {
  return typeof error === "object" && error !== null && explainedErrors.has(error);
}

export function parseComfyRejectionBody(text: string): ComfyRejectionBody | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as ComfyRejectionBody) : null;
  } catch {
    return null;
  }
}

export function explainWorkflowRejection(body: ComfyRejectionBody | null): WorkflowRejectionExplanation | null {
  if (!body) return null;

  const sentences: string[] = [];
  const missingModels: MissingModelFinding[] = [];
  const errorType = body.error?.type;

  if (errorType === "missing_node_type") {
    const classType = String(body.error?.extra_info?.class_type ?? "");
    sentences.push(explainMissingNode(classType || "a node in this workflow"));
  } else if (errorType === "prompt_no_outputs") {
    sentences.push(
      "The workflow has no output node, so ComfyUI has nothing to make. Add a Save Image or Preview Image node."
    );
  }

  for (const [nodeId, entry] of Object.entries(body.node_errors ?? {})) {
    const classType = entry.class_type ?? "a node";

    for (const error of entry.errors ?? []) {
      const inputName = String(error.extra_info?.input_name ?? error.details ?? "");
      const received = error.extra_info?.received_value;

      if (error.type === "value_not_in_list" && typeof received === "string") {
        const sentence = explainMissingFile(classType, received);

        if (sentence) {
          sentences.push(sentence);
          missingModels.push({ loaderNode: classType, inputName, modelName: received });
          continue;
        }

        sentences.push(`${classType} does not offer "${received}" for ${inputName}.`);
        continue;
      }

      if (error.type === "required_input_missing") {
        sentences.push(
          `The workflow leaves ${inputName} unset on ${classType} (node ${nodeId}). If this is your own workflow, connect it in ComfyUI and export it again.`
        );
        continue;
      }

      if (error.type === "value_smaller_than_min" || error.type === "value_bigger_than_max") {
        sentences.push(`${classType} cannot use ${inputName} = ${String(received)}: ${stripTrailingPeriod(error.message)}.`);
        continue;
      }

      const detail = error.details ? ` (${error.details})` : "";
      sentences.push(`${classType} (node ${nodeId}): ${stripTrailingPeriod(error.message ?? "rejected")}${detail}.`);
    }
  }

  if (sentences.length === 0) {
    const fallback = body.error?.message;
    if (!fallback) return null;
    sentences.push(`ComfyUI rejected the workflow: ${stripTrailingPeriod(fallback)}.`);
  }

  const unique = [...new Set(sentences)];
  const shown = unique.slice(0, MAX_SENTENCES);
  const more = unique.length - shown.length;

  return {
    message: more > 0 ? `${shown.join(" ")} ${more} more problem${more === 1 ? "" : "s"} in diagnostics.` : shown.join(" "),
    missingModels
  };
}

function explainMissingNode(classType: string) {
  const pack = CUSTOM_NODE_PACKAGES[classType];

  return pack
    ? `ComfyUI does not have the ${classType} node. It comes from the ${pack.name} custom node pack: install it with ComfyUI-Manager, then restart ComfyUI.`
    : `ComfyUI does not have the ${classType} node. Its custom node pack is not installed: find it in ComfyUI-Manager, install it, then restart ComfyUI.`;
}

function explainMissingFile(classType: string, fileName: string): string | null {
  if (LORA_LOADERS.has(classType)) {
    return `The LoRA ${fileName} is not in ComfyUI's models/loras/ folder.`;
  }

  const folder = (MODEL_FOLDER_BY_OBJECT_INFO_NODE as Record<string, string>)[classType];

  if (folder) {
    return `The model ${fileName} is not in ComfyUI's models/${folder}/ folder, which is where ${classType} looks.`;
  }

  // A file-like value in an unmapped loader: still clearly a missing file.
  if (/\.(safetensors|ckpt|pt|pth|bin|gguf|onnx)$/i.test(fileName)) {
    return `ComfyUI cannot find the file ${fileName} that ${classType} needs.`;
  }

  return null;
}

function stripTrailingPeriod(text: string | undefined) {
  return (text ?? "").trim().replace(/\.+$/, "");
}
