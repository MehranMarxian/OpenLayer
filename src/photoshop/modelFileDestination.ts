import type { DownloadDestination } from "../comfy/modelDownload";

// Turns a granted UXP folder into a destination the download engine can append
// to.
//
// The subtle part is measuring what is already on disk. Reading the file back
// to learn its length would pull an 18 GiB model into memory -- the exact thing
// the chunked design exists to avoid -- so the size comes from fs.lstat, which
// the spike confirmed this UXP build exposes. Where lstat is unavailable the
// answer is 0, which costs a restarted download but never a corrupt one.

export type UxpFileLike = {
  write: (data: ArrayBuffer, options: Record<string, unknown>) => Promise<void>;
  delete: () => Promise<void>;
};

export type UxpFolderLike = {
  nativePath?: string;
  createFile: (name: string, options?: { overwrite?: boolean }) => Promise<UxpFileLike>;
  getEntry?: (name: string) => Promise<UxpFileLike | null>;
};

export type DestinationDeps = Readonly<{
  folder: UxpFolderLike;
  fileName: string;
  binaryFormat: unknown;
  // Size in bytes, or null when it cannot be determined.
  statSize?: (nativePath: string) => Promise<number | null>;
}>;

export function createFolderDestination(deps: DestinationDeps): DownloadDestination {
  let file: UxpFileLike | null = null;
  // Whether the next write must append rather than replace. This is not a
  // preference: appending on a fresh download would concatenate onto a partial
  // file we just decided to abandon, and replacing on a resumed download would
  // destroy the bytes we just decided to keep.
  let appendNext = false;

  const openFile = async (): Promise<UxpFileLike> => {
    if (file) return file;

    const existing = typeof deps.folder.getEntry === "function"
      ? await deps.folder.getEntry(deps.fileName).catch(() => null)
      : null;

    file = existing ?? await deps.folder.createFile(deps.fileName, { overwrite: true });
    return file;
  };

  return {
    // The engine always asks this before writing, so it is also the honest
    // place to decide whether writing continues a file or starts one.
    existingBytes: async () => {
      const bytes = await measureExistingBytes(deps);
      appendNext = bytes > 0;
      return bytes;
    },

    append: async (chunk) => {
      const target = await openFile();
      await target.write(chunk, { format: deps.binaryFormat, append: appendNext });
      appendNext = true;
    },

    discard: async () => {
      const target = await openFile().catch(() => null);

      if (target) {
        await target.delete();
      }

      file = null;
      appendNext = false;
    }
  };
}

async function measureExistingBytes(deps: DestinationDeps): Promise<number> {
  if (typeof deps.statSize !== "function") return 0;

  const folderPath = deps.folder.nativePath;
  if (!folderPath) return 0;

  try {
    const size = await deps.statSize(joinNativePath(folderPath, deps.fileName));
    return typeof size === "number" && Number.isFinite(size) && size > 0 ? size : 0;
  } catch {
    // No file yet, or a build that cannot stat. Either way, start at zero:
    // a needlessly restarted download is recoverable, a wrongly resumed one
    // silently produces a corrupt model.
    return 0;
  }
}

export function joinNativePath(folderPath: string, fileName: string): string {
  const trimmed = folderPath.replace(/[\\/]+$/, "");
  const separator = trimmed.includes("\\") && !trimmed.includes("/") ? "\\" : "/";

  return `${trimmed}${separator}${fileName}`;
}
