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

export type InstallStep = "resolving-folder" | "downloading" | "verifying";

const STEP_MESSAGES: Record<InstallStep, (modelName: string) => string> = {
  "resolving-folder": () => "Finding ComfyUI's models folder...",
  downloading: (modelName) => `Downloading ${modelName}...`,
  verifying: () => "Download finished. Re-checking what ComfyUI can see..."
};

/**
 * Assisted install was withheld through v0.12 because it was built on
 * ComfyUI-Manager's `install_model`, which only accepts models already in the
 * Manager's own curated catalogue -- 7 of the 16 this registry pins, several at
 * URLs that are not ours. The full reasoning is in the git history of this file.
 *
 * It downloads directly now, honouring the registry's pinned URLs, so the
 * catalogue restriction is gone along with the flag. Everything that was kept
 * during the withholding -- the plan, the refusals and their reasons -- is the
 * part that was always correct, and is unchanged.
 */

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
  requirementKey: string
): InstallOffer {
  return findInstallOffer(plan, requirementKey);
}

/**
 * The offer logic on its own.
 *
 * A row is never offered a Download button that would fail the moment it was
 * pressed, so every licence-gate and wrong-folder refusal is decided here in
 * `plan.installable` rather than discovered mid-download.
 */
export function findInstallOffer(
  plan: AssistedInstallPlan | null,
  requirementKey: string
): InstallOffer {
  if (!plan) {
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
        ? "This entry is a repository folder rather than a single file, so OpenLayer cannot download it here. Use the model page."
        : "OpenLayer downloads this itself and can resume if it is interrupted. Nothing else is installed, and nothing is changed in Photoshop.",
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
 * What the screen says once a download has finished and the setup check has
 * re-run. The claim is deliberately made from the re-checked report rather than
 * from the download reporting success: bytes landing on disk is not the same
 * fact as ComfyUI being able to see a usable model in the folder its loader
 * reads, and only the second one is what the artist needs.
 */
export function describeInstallResult(
  modelName: string,
  stillMissing: boolean
): { message: string; tone: "ready" | "error" } {
  return stillMissing
    ? {
        message: `The download finished, but ComfyUI still cannot see ${modelName}. Refresh ComfyUI, then check again.`,
        tone: "error"
      }
    : { message: `${modelName} is installed and ComfyUI can see it.`, tone: "ready" };
}
