import type { AssistedInstallItem, AssistedInstallPlan } from "../comfy/assistedInstall";

export type SetupRowField = { label: string; value: string };

export type InstallOffer =
  | { kind: "offered"; item: AssistedInstallItem }
  | { kind: "hidden" };

export type InstallConfirmationView = {
  headline: string;
  fields: SetupRowField[];
  note: string;
  confirmLabel: string;
  cancelLabel: string;
};

export type InstallPhase =
  | { kind: "idle" }
  | { kind: "confirming"; requirementKey: string }
  | { kind: "working"; requirementKey: string; step: InstallStep };

export type InstallStep = "checking-queue" | "queueing" | "downloading" | "verifying";

const STEP_MESSAGES: Record<InstallStep, (modelName: string) => string> = {
  "checking-queue": () => "Checking that ComfyUI-Manager is free...",
  queueing: (modelName) => `Handing ${modelName} to ComfyUI-Manager...`,
  downloading: (modelName) => `Downloading ${modelName}. This does not stop if you leave the screen.`,
  verifying: () => "Download finished. Re-checking what ComfyUI can see..."
};

/**
 * Assisted install is withheld from this release.
 *
 * ComfyUI-Manager's `/manager/queue/install_model` is not the "download this
 * URL for me" endpoint this feature was built against. Before it does anything
 * it calls `check_whitelist_for_model`, which requires an exact match on
 * `save_path` + `base` + `filename` against the Manager's own curated
 * `model-list.json`. OpenLayer sends its own values -- the real ComfyUI folder
 * name and an artist-facing label -- so every request is rejected with HTTP 400
 * and nothing installs at all.
 *
 * Mapping the fields across is not a fix, which is why this is a flag and not a
 * patch. Only 7 of the 16 models the registry pins are in that catalogue, and
 * for several of the 7 the catalogue's URL is not ours: the Manager fetches
 * `ae.safetensors` from `black-forest-labs/FLUX.1-schnell`, where this project
 * deliberately uses the `Comfy-Org/z_image_turbo` mirror because the Black
 * Forest Labs repos answer 401 without a token. Delegating that download saves
 * an authentication page under the model's filename -- exactly the failure the
 * licence-gate refusal exists to prevent, reintroduced by the mechanism meant
 * to be the safe path.
 *
 * Everything below and in `assistedInstall.ts` is kept: the plan, the refusals
 * and their reasons are all correct and are what a working version is built on.
 * What is missing is a transport that honours the registry's pinned URLs.
 */
export const ASSISTED_INSTALL_ENABLED = false;

/**
 * Whether a requirement row may show an Install button.
 *
 * Three things have to be true, and none is a property of the row itself:
 * assisted install has to be enabled in this build at all, the plan has to
 * consider the requirement installable (which is where every licence and
 * wrong-folder refusal lives), and ComfyUI-Manager has to be present to do the
 * downloading. A row is never offered an Install button that would fail the
 * moment it was pressed.
 */
export function getInstallOffer(
  plan: AssistedInstallPlan | null,
  managerVersion: string | null,
  requirementKey: string
): InstallOffer {
  if (!ASSISTED_INSTALL_ENABLED) {
    return { kind: "hidden" };
  }

  return findInstallOffer(plan, managerVersion, requirementKey);
}

/**
 * The offer logic on its own, without the release flag.
 *
 * Kept separate and exported so the plan-and-Manager rules stay under test
 * while `ASSISTED_INSTALL_ENABLED` is false. Turning the feature back on must
 * not mean rediscovering what these rules were.
 */
export function findInstallOffer(
  plan: AssistedInstallPlan | null,
  managerVersion: string | null,
  requirementKey: string
): InstallOffer {
  if (!plan || !managerVersion) {
    return { kind: "hidden" };
  }

  const item = plan.installable.find((candidate) => candidate.key === requirementKey);

  return item ? { kind: "offered", item } : { kind: "hidden" };
}

/**
 * The text of the confirmation. Everything a person needs in order to agree to
 * a download is here and nowhere else: what the file is, how big it is, where
 * it will be written, and which host it comes from. The host matters more than
 * it looks -- it is the only part of a download URL that says who is being
 * trusted, and it is the part a long Hugging Face path hides.
 */
export function createInstallConfirmationView(item: AssistedInstallItem): InstallConfirmationView {
  return {
    headline: `Download ${item.modelName}?`,
    fields: [
      { label: "Size", value: item.formattedSize },
      { label: "Into", value: `models/${item.targetFolder}/` },
      { label: "From", value: describeDownloadSource(item.downloadUrl) }
    ],
    note:
      item.layout === "repo-folder"
        ? "ComfyUI-Manager downloads this in the background. This entry is a repository folder rather than a single file, so check the result before relying on it."
        : "ComfyUI-Manager downloads this in the background. Nothing else is installed, and nothing is changed in Photoshop.",
    confirmLabel: "Download",
    cancelLabel: "Cancel"
  };
}

/**
 * The host of a download URL, for display.
 *
 * Written with a regex rather than `URL`, because this string is shown to
 * somebody deciding whether to trust a download and must never throw on a
 * malformed value -- showing the raw string is a worse answer than a hostname
 * but a much better one than a blank confirmation dialog.
 */
export function describeDownloadSource(url: string): string {
  const match = /^https?:\/\/([^/?#]+)/i.exec(url.trim());

  return match ? match[1] : url.trim();
}

export function createInstallStatusLine(step: InstallStep, modelName: string): string {
  return STEP_MESSAGES[step](modelName);
}

/**
 * What the screen says once an install has finished and the setup check has
 * re-run. The claim is deliberately made from the re-checked report rather than
 * from the installer reporting success: ComfyUI-Manager reports that it
 * finished its queue item, which is not the same as ComfyUI being able to see a
 * usable model in the folder its loader reads.
 */
export function describeInstallResult(
  modelName: string,
  stillMissing: boolean
): { message: string; tone: "ready" | "error" } {
  return stillMissing
    ? {
        message: `ComfyUI-Manager finished, but ComfyUI still cannot see ${modelName}. Refresh ComfyUI, then check again.`,
        tone: "error"
      }
    : { message: `${modelName} is installed and ComfyUI can see it.`, tone: "ready" };
}
