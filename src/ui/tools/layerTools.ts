/**
 * Layer Tools: export the active layer, the current selection, or the
 * selection mask, either to a file the artist picks or straight into ComfyUI's
 * input folder.
 *
 * This is the first tool written to the per-tool module shape the project has
 * been moving toward, so its structure is deliberate and worth copying:
 * everything here takes its collaborators as parameters. No Photoshop, no
 * fetch, no DOM. That is what lets the interesting decisions -- which capture
 * runs, what the artist is told, what happens when they cancel -- be tested
 * without a host, which is exactly the class of logic that has historically
 * rotted inside renderApp where no test could reach it.
 *
 * The panel supplies the real adapter calls; the tests supply fakes.
 */

import type { SaveFileOutcome } from "../../utils/saveFile";

export type LayerExportKind = "layer" | "selection" | "mask";
export type LayerExportDestination = "file" | "comfyui";

// Both exportActiveLayerAsPNG/exportSelectionAsPNG (ExportedSourceImage) and
// exportSelectionMask (SelectionMaskExport) satisfy this shape. Depending on
// the shape rather than either concrete type keeps this module off the
// adapter's import graph.
export type CapturedExport = {
  blob: Blob;
  filename: string;
};

export type LayerExportDescriptor = Readonly<{
  kind: LayerExportKind;
  /** Button and heading text. */
  label: string;
  /** Names the thing in status messages: "Saved the active layer to ...". */
  subject: string;
}>;

// The inventory is a table rather than three copies of the same handler, so
// adding a fourth export is a row here plus a capture function.
export const LAYER_EXPORT_DESCRIPTORS: readonly LayerExportDescriptor[] = [
  { kind: "layer", label: "Active layer", subject: "the active layer" },
  { kind: "selection", label: "Selection", subject: "the selection" },
  { kind: "mask", label: "Selection mask", subject: "the selection mask" }
];

export type LayerExportStatus = "ok" | "cancelled" | "error";

export type LayerExportResult = Readonly<{
  status: LayerExportStatus;
  message: string;
}>;

export type LayerToolsDependencies = {
  capture: (kind: LayerExportKind) => Promise<CapturedExport>;
  saveToFile: (blob: Blob, suggestedName: string) => Promise<SaveFileOutcome>;
  uploadToComfyUI: (blob: Blob, fileName: string) => Promise<string>;
  describeSaveOutcome: (outcome: SaveFileOutcome, subject: string) => string;
  describeError: (caughtError: unknown) => string;
};

export async function runLayerExport(
  dependencies: LayerToolsDependencies,
  kind: LayerExportKind,
  destination: LayerExportDestination
): Promise<LayerExportResult> {
  const descriptor = findLayerExportDescriptor(kind);

  let captured: CapturedExport;

  // Capture failures are reported as-is. The adapter already writes messages
  // aimed at the artist ("Make a selection before exporting a selection"), so
  // wrapping them in another sentence would bury the actionable part.
  try {
    captured = await dependencies.capture(kind);
  } catch (caughtError) {
    return { status: "error", message: dependencies.describeError(caughtError) };
  }

  if (destination === "comfyui") {
    try {
      const uploadedName = await dependencies.uploadToComfyUI(captured.blob, captured.filename);

      return {
        status: "ok",
        message: `Sent ${descriptor.subject} to ComfyUI as ${uploadedName}. It can now be referenced by a workflow.`
      };
    } catch (caughtError) {
      return { status: "error", message: dependencies.describeError(caughtError) };
    }
  }

  let outcome: SaveFileOutcome;

  try {
    outcome = await dependencies.saveToFile(captured.blob, captured.filename);
  } catch (caughtError) {
    return { status: "error", message: dependencies.describeError(caughtError) };
  }

  return {
    // Cancelling is the artist changing their mind, not a fault, and must not
    // paint the status line red -- otherwise the red state stops meaning
    // anything.
    status: toLayerExportStatus(outcome),
    message: dependencies.describeSaveOutcome(outcome, descriptor.subject)
  };
}

export function findLayerExportDescriptor(kind: LayerExportKind): LayerExportDescriptor {
  const descriptor = LAYER_EXPORT_DESCRIPTORS.find((entry) => entry.kind === kind);

  if (!descriptor) {
    throw new Error(`Unknown layer export kind: ${kind}`);
  }

  return descriptor;
}

function toLayerExportStatus(outcome: SaveFileOutcome): LayerExportStatus {
  if (outcome.kind === "saved") {
    return "ok";
  }

  if (outcome.kind === "cancelled") {
    return "cancelled";
  }

  return "error";
}
