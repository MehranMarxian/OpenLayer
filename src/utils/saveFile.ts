// Writing to a location the artist chooses, as opposed to the temporary folder
// everything else in OpenLayer writes to (saveBlobToTemporaryFile).
//
// Promoted from the v0.9 task 0 spike, which verified in real Photoshop that
// uxp.storage.localFileSystem.getFileForSaving exists, opens a genuine OS save
// dialog, and returns a writable file -- and that it does NOT need to run
// inside executeAsModal. Modal scope stays reserved for document mutation.

export type SaveFileOutcome =
  | { kind: "saved"; fileName: string; byteLength: number }
  | { kind: "cancelled" }
  | { kind: "unsupported" }
  | { kind: "failed"; stage: SaveFileStage; message: string };

export type SaveFileStage = "picker" | "write";

// Cancel and unsupported are answers, not faults, and must be distinguishable
// from a real failure: reporting a cancelled save as an error trains artists to
// ignore the error line. So the outcome is returned rather than thrown.
export async function saveBlobToChosenFile(
  blob: Blob,
  suggestedName: string
): Promise<SaveFileOutcome> {
  let uxp: UxpModule;

  // Browser preview builds have no require("uxp"), the same case openExternalUrl
  // guards. Treating it as unsupported keeps the browser from reporting a crash.
  try {
    uxp = require("uxp") as UxpModule;
  } catch {
    return { kind: "unsupported" };
  }

  const localFileSystem = uxp.storage?.localFileSystem;

  if (typeof localFileSystem?.getFileForSaving !== "function") {
    return { kind: "unsupported" };
  }

  let file: UxpFile | null;

  try {
    file = await openSaveDialog(localFileSystem, suggestedName);
  } catch (caughtError) {
    return { kind: "failed", stage: "picker", message: describeError(caughtError) };
  }

  if (!file) {
    return { kind: "cancelled" };
  }

  let byteLength: number;

  try {
    const arrayBuffer = await blob.arrayBuffer();
    await file.write(arrayBuffer, { format: uxp.storage.formats.binary });
    byteLength = arrayBuffer.byteLength;
  } catch (caughtError) {
    return { kind: "failed", stage: "write", message: describeError(caughtError) };
  }

  return { kind: "saved", fileName: file.name, byteLength };
}

export type SaveDialogHost = {
  getFileForSaving?: (
    suggestedName: string,
    options?: { types?: readonly string[] }
  ) => Promise<UxpFile | null>;
};

// Split out so the receiver can be regression-tested without Photoshop. The
// spike's first run in Photoshop failed here: the method was pulled off
// localFileSystem to be typeof-checked and then called detached, so `this` was
// undefined inside UXP and it threw before any dialog appeared. TypeScript
// cannot see that; only calling it can.
export async function openSaveDialog(
  host: SaveDialogHost,
  suggestedName: string
): Promise<UxpFile | null> {
  return host.getFileForSaving!(suggestedName, { types: ["png"] });
}

export function describeSaveFileOutcome(outcome: SaveFileOutcome, subject: string): string {
  switch (outcome.kind) {
    case "saved":
      return `Saved ${subject} to ${outcome.fileName}.`;
    case "cancelled":
      return `Save cancelled. ${capitalize(subject)} was not written.`;
    case "unsupported":
      return `This Photoshop build cannot open a save dialog, so ${subject} cannot be saved to a chosen location. Sending to ComfyUI still works.`;
    case "failed":
      return outcome.stage === "picker"
        ? `Could not open the save dialog. ${outcome.message}`
        : `Could not write ${subject}. ${outcome.message}`;
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function describeError(caughtError: unknown): string {
  if (caughtError instanceof Error && caughtError.message) {
    return caughtError.message;
  }

  return String(caughtError);
}
