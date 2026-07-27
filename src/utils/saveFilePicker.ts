// SPIKE (v0.9 Layer Tools, task 0) — delete or promote this file, do not leave it.
//
// Every file OpenLayer has ever written went to the temporary folder via
// saveBlobToTemporaryFile. Layer Tools has to write where the artist chooses,
// and nothing in this repository has opened a save dialog, so the behavior of
// uxp.storage.localFileSystem.getFileForSaving in Photoshop UXP is unverified.
//
// This module answers that question and nothing else. It deliberately writes a
// generated image rather than a captured layer: the capture paths are already
// proven by generation, so mixing them in would mean a failure could not be
// attributed. Isolate the unknown.
//
// The outcome is a discriminated result rather than a thrown error, because
// "the artist pressed Cancel" and "this UXP build has no such API" are both
// expected answers here and must be told apart from a genuine failure.

import { encodeRgbaPng } from "./png";

export type SaveFilePickerOutcome =
  | { kind: "saved"; fileName: string; byteLength: number }
  | { kind: "cancelled" }
  | { kind: "unsupported" }
  | { kind: "failed"; stage: SaveFilePickerStage; message: string };

export type SaveFilePickerStage = "picker" | "write";

const SPIKE_IMAGE_EDGE = 64;

export async function runSaveFilePickerSpike(suggestedName: string): Promise<SaveFilePickerOutcome> {
  let uxp: UxpModule;

  // Browser preview builds have no require("uxp") at all, the same reason
  // openExternalUrl guards its shell lookup. Treating that as "unsupported"
  // keeps the browser from reporting a misleading crash, and it is also the
  // honest answer for any host without the module.
  try {
    uxp = require("uxp") as UxpModule;
  } catch {
    return { kind: "unsupported" };
  }

  const getFileForSaving = uxp.storage?.localFileSystem?.getFileForSaving;

  // An older or differently-provisioned UXP build may simply not have it. That
  // is a real answer, not a crash, and it decides whether Layer Tools can offer
  // "save as" at all.
  if (typeof getFileForSaving !== "function") {
    return { kind: "unsupported" };
  }

  let file: UxpFile | null;

  try {
    // Called outside executeAsModal on purpose. This opens OS-level UI, and
    // Photoshop's modal scope is for document mutation; if this turns out to
    // need a modal, the thrown error is exactly what the spike should surface
    // rather than something to guess at in advance.
    file = await getFileForSaving(suggestedName, { types: ["png"] });
  } catch (caughtError) {
    return { kind: "failed", stage: "picker", message: describeError(caughtError) };
  }

  // UXP resolves to null when the dialog is dismissed. Verifying that it does
  // not throw instead matters: Layer Tools must not report a cancelled save as
  // a failed one.
  if (!file) {
    return { kind: "cancelled" };
  }

  const bytes = createSpikeImageBytes();

  try {
    await file.write(toArrayBuffer(bytes), { format: uxp.storage.formats.binary });
  } catch (caughtError) {
    return { kind: "failed", stage: "write", message: describeError(caughtError) };
  }

  return { kind: "saved", fileName: file.name, byteLength: bytes.byteLength };
}

// A flat magenta square with an opaque black border. Chosen so that a file that
// opens at all is obviously the file this spike wrote, and so that a truncated
// write is visible as a partial image rather than passing for a valid one.
export function createSpikeImageBytes(): Uint8Array {
  const edge = SPIKE_IMAGE_EDGE;
  const rgba = new Uint8Array(edge * edge * 4);

  for (let y = 0; y < edge; y += 1) {
    for (let x = 0; x < edge; x += 1) {
      const offset = (y * edge + x) * 4;
      const isBorder = x === 0 || y === 0 || x === edge - 1 || y === edge - 1;

      rgba[offset] = isBorder ? 0 : 255;
      rgba[offset + 1] = 0;
      rgba[offset + 2] = isBorder ? 0 : 255;
      rgba[offset + 3] = 255;
    }
  }

  return encodeRgbaPng({ width: edge, height: edge, rgba });
}

export function describeSaveFilePickerOutcome(outcome: SaveFilePickerOutcome): string {
  switch (outcome.kind) {
    case "saved":
      return `Save picker spike: wrote ${outcome.byteLength} bytes to "${outcome.fileName}". Open it — it should be a 64x64 magenta square with a black border.`;
    case "cancelled":
      return "Save picker spike: dialog opened and was cancelled, and UXP reported the cancellation instead of throwing. That is the expected result for Cancel.";
    case "unsupported":
      return "Save picker spike: this UXP build does not expose getFileForSaving at all. Layer Tools cannot offer a chosen save location on this host.";
    case "failed":
      return outcome.stage === "picker"
        ? `Save picker spike: opening the dialog failed. ${outcome.message}`
        : `Save picker spike: the dialog returned a file but writing to it failed. ${outcome.message}`;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);

  return copy;
}

function describeError(caughtError: unknown): string {
  if (caughtError instanceof Error && caughtError.message) {
    return caughtError.message;
  }

  return String(caughtError);
}
