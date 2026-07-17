import { selectStaleTemporaryFileNames } from "./temporaryFileCleanup";

export function createLayerName(prefix: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());

  return `${prefix}_${year}${month}${day}_${hour}${minute}`;
}

export async function saveBlobToTemporaryFile(blob: Blob, fileName: string): Promise<UxpFile> {
  const uxp = require("uxp") as UxpModule;
  const tempFolder = await uxp.storage.localFileSystem.getTemporaryFolder();
  const file = await tempFolder.createFile(fileName, { overwrite: true });
  const arrayBuffer = await blob.arrayBuffer();

  await file.write(arrayBuffer, {
    format: uxp.storage.formats.binary
  });

  return file;
}

// Import files exist only to hand Photoshop a session token for placeEvent; once
// the place command has read them, whether the import went on to succeed or
// fail, nothing else needs them. Best-effort: a file OpenLayer can no longer
// delete is not worth failing an otherwise-successful import over.
export async function deleteTemporaryFileBestEffort(file: UxpFile | null | undefined): Promise<void> {
  if (!file) return;

  try {
    await file.delete();
  } catch {
    // Left for the next session-start sweep to pick up.
  }
}

export type TemporaryFileSweepResult = Readonly<{
  removed: readonly string[];
  failed: readonly string[];
}>;

// Run once per panel session. Debug copies deliberately outlive the generation
// that created them, so an artist can still open them after the fact; this is
// what keeps them from accumulating indefinitely instead.
export async function sweepStaleTemporaryFiles(): Promise<TemporaryFileSweepResult> {
  try {
    const uxp = require("uxp") as UxpModule;
    const tempFolder = await uxp.storage.localFileSystem.getTemporaryFolder();
    const entries = await tempFolder.getEntries();
    const staleNames = new Set(selectStaleTemporaryFileNames(entries));
    const removed: string[] = [];
    const failed: string[] = [];

    for (const entry of entries) {
      if (!staleNames.has(entry.name)) continue;

      try {
        await entry.delete();
        removed.push(entry.name);
      } catch {
        failed.push(entry.name);
      }
    }

    return { removed, failed };
  } catch {
    return { removed: [], failed: [] };
  }
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
