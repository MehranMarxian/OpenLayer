// Getting a writable handle on ComfyUI's models folder.
//
// The feasibility spike (PR #80) found the two halves disagree: UXP resolved the
// folder path with no dialog at all, but creating a file inside it failed. So
// neither route can be assumed, and this tries the quiet one first and falls
// back to asking the artist.
//
// A granted folder is remembered with a UXP persistent token, so the picker
// appears once rather than once per download. Adobe is explicit that a token can
// stop working -- the folder moves, permissions change -- so an unusable token
// is treated as "ask again", never as an error.

export type FolderAccessRoute = "direct" | "granted" | "picker-needed";

export type FolderAccessResult =
  | { kind: "ready"; route: FolderAccessRoute; folder: unknown; note: string }
  | { kind: "needs-grant"; note: string }
  | { kind: "failed"; note: string };

export type FolderAccessDeps = Readonly<{
  // Resolve a path with no dialog. Undefined on builds without the API.
  getEntryWithUrl?: (url: string) => Promise<unknown>;
  // Show the native folder picker. Resolves null when the artist cancels.
  pickFolder?: () => Promise<unknown | null>;
  createPersistentToken?: (entry: unknown) => Promise<string>;
  getEntryForPersistentToken?: (token: string) => Promise<unknown>;
  readStoredToken: () => string | null;
  writeStoredToken: (token: string | null) => void;
  // Proves a handle is actually writable. The spike's whole finding was that
  // resolving a folder says nothing about being able to write in it.
  canWrite: (folder: unknown) => Promise<boolean>;
}>;

export async function acquireModelsFolder(
  targetPath: string,
  deps: FolderAccessDeps,
  options?: { allowPicker?: boolean }
): Promise<FolderAccessResult> {
  const allowPicker = options?.allowPicker ?? false;

  // 1. A folder the artist already granted. Preferred over the direct route
  // because it is known to have worked once, and costs no dialog.
  const storedToken = deps.readStoredToken();

  if (storedToken && typeof deps.getEntryForPersistentToken === "function") {
    try {
      const folder = await deps.getEntryForPersistentToken(storedToken);

      if (folder && await deps.canWrite(folder)) {
        return { kind: "ready", route: "granted", folder, note: "Using the ComfyUI models folder you granted earlier." };
      }

      // Resolved but unusable: the folder moved, or permissions changed.
      deps.writeStoredToken(null);
    } catch {
      deps.writeStoredToken(null);
    }
  }

  // 2. The quiet route. Free when it works, and the spike proved it resolves.
  let directFailure = "";

  if (typeof deps.getEntryWithUrl === "function" && targetPath) {
    try {
      const folder = await deps.getEntryWithUrl(`file:${targetPath.replace(/\\/g, "/")}`);

      if (folder && await deps.canWrite(folder)) {
        return { kind: "ready", route: "direct", folder, note: "Writing straight to ComfyUI's models folder; no permission needed." };
      }

      directFailure = folder
        ? "the folder resolved but could not be written to"
        : "the folder path did not resolve";
    } catch (caughtError) {
      // Recorded, not swallowed. Falling back silently once hid a plain
      // programming error -- an unbound UXP method -- behind what looked like a
      // permissions problem, and cost a debugging round trip.
      directFailure = messageOf(caughtError);
    }
  }

  if (!allowPicker) {
    return {
      kind: "needs-grant",
      note: withReason(
        "OpenLayer needs permission to write into ComfyUI's models folder. Choose it once and it will be remembered.",
        directFailure
      )
    };
  }

  // 3. Ask. Only ever reached deliberately, never as a surprise mid-download.
  if (typeof deps.pickFolder !== "function") {
    return { kind: "failed", note: "This Photoshop build cannot show a folder picker, so the models folder cannot be granted." };
  }

  let picked: unknown | null;

  try {
    picked = await deps.pickFolder();
  } catch (caughtError) {
    return {
      kind: "failed",
      note: withReason(`The folder picker failed. ${messageOf(caughtError)}`, directFailure)
    };
  }

  if (!picked) {
    return { kind: "needs-grant", note: "No folder was chosen, so nothing was downloaded." };
  }

  if (!await deps.canWrite(picked)) {
    return { kind: "failed", note: "That folder cannot be written to. Choose the ComfyUI models folder, or one you own." };
  }

  if (typeof deps.createPersistentToken === "function") {
    try {
      deps.writeStoredToken(await deps.createPersistentToken(picked));
    } catch {
      // Remembering is an optimisation. A download that works but asks again
      // next time is far better than refusing to proceed.
    }
  }

  return { kind: "ready", route: "granted", folder: picked, note: "Folder granted. OpenLayer will remember it for future downloads." };
}

function messageOf(caughtError: unknown) {
  return caughtError instanceof Error ? caughtError.message : String(caughtError);
}

// Both halves matter when this goes wrong: what the artist should do, and what
// actually failed underneath.
function withReason(note: string, reason: string) {
  return reason ? `${note} (Direct access failed: ${reason})` : note;
}

// A chosen folder is only the right one if the model can actually land where
// ComfyUI looks for it. Warning is right rather than refusing: the artist may
// have a valid extra_model_paths.yaml layout we cannot see from here.
export function describeFolderMismatch(chosenPath: string | null, expectedSubfolder: string): string | null {
  if (!chosenPath) return null;

  const normalized = chosenPath.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");

  if (normalized.endsWith(`/${expectedSubfolder.toLowerCase()}`)) return null;

  return `This folder does not end in "${expectedSubfolder}". ComfyUI looks for this model there, so it may not be found unless your extra_model_paths.yaml says otherwise.`;
}
