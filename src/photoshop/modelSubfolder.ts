// Which folder a model actually lands in, once OpenLayer has a writable folder.
//
// A granted folder is remembered as ONE folder, and before this every download
// wrote into it, whatever the model. Granting `upscale_models` for 4x-UltraSharp
// and later downloading a VAE put the VAE in `upscale_models` with only a
// warning, and the re-check then called it "wrong folder". The FLUX.2 Klein
// starter fetches three files into three different folders in one go, so it
// would have hit this every time.
//
// So the granted folder is treated as a starting point, not the destination:
// the folder itself when it is the right one, the right folder inside it when
// it is ComfyUI's `models` folder, and a fresh question when it is plainly a
// different model folder. Anything else is still used, with the old warning,
// because an extra_model_paths.yaml layout can make an unexpected name correct
// and OpenLayer cannot read that file.

import type { WorkflowModelFolder } from "../comfy/types";

export type ModelFolderEntryLike = {
  name?: string;
  nativePath?: string;
  isFolder?: boolean;
  getEntry?: (name: string) => Promise<unknown>;
  createFolder?: (name: string) => Promise<unknown>;
};

export type SubfolderResolution =
  | { kind: "use"; folder: unknown; note: string | null }
  | { kind: "wrong-folder"; note: string };

/** The folders ComfyUI keeps under `models/` that OpenLayer downloads into. */
export const KNOWN_MODEL_FOLDERS: readonly WorkflowModelFolder[] = [
  "checkpoints",
  "diffusion_models",
  "text_encoders",
  "vae",
  "controlnet",
  "upscale_models",
  "LLM",
  "model_patches",
  "clip_vision",
  "ipadapter",
  "background_removal"
];

export async function resolveModelSubfolder(
  folder: unknown,
  targetFolder: WorkflowModelFolder
): Promise<SubfolderResolution> {
  const entry = folder as ModelFolderEntryLike;
  const name = folderName(entry);
  const target = targetFolder.toLowerCase();

  if (name === target) {
    return { kind: "use", folder, note: null };
  }

  const child = await findChildFolder(entry, targetFolder);

  if (child) {
    return { kind: "use", folder: child, note: null };
  }

  // ComfyUI's own models folder without this subfolder yet (an older install,
  // or a folder nothing has used). ComfyUI creates these itself at startup, so
  // creating one here is what it would have done.
  if (name === "models" && typeof entry.createFolder === "function") {
    try {
      return { kind: "use", folder: await entry.createFolder(targetFolder), note: null };
    } catch {
      // Fall through to the warning: writing into `models/` itself is still
      // better reported than refused.
    }
  }

  if (KNOWN_MODEL_FOLDERS.some((known) => known.toLowerCase() === name)) {
    return {
      kind: "wrong-folder",
      note: `The folder OpenLayer was given is ComfyUI's ${name} folder, but this model belongs in ${targetFolder}. Choose ComfyUI's models folder, and OpenLayer will use the right folder inside it for every download.`
    };
  }

  return {
    kind: "use",
    folder,
    note: name
      ? `This folder does not end in "${targetFolder}". ComfyUI looks for this model there, so it may not be found unless your extra_model_paths.yaml says otherwise.`
      : null
  };
}

function folderName(entry: ModelFolderEntryLike | null): string {
  const raw = entry?.name ?? lastSegment(entry?.nativePath ?? "");
  return raw.trim().toLowerCase();
}

function lastSegment(path: string): string {
  const parts = path.replace(/\\/g, "/").replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] ?? "";
}

async function findChildFolder(entry: ModelFolderEntryLike | null, name: string): Promise<unknown | null> {
  if (!entry || typeof entry.getEntry !== "function") return null;

  try {
    const child = (await entry.getEntry(name)) as ModelFolderEntryLike | null;
    // UXP's getEntry throws for a missing name, but a file of that name must
    // not be mistaken for the folder either.
    return child && child.isFolder !== false ? child : null;
  } catch {
    return null;
  }
}
