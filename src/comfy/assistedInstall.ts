import { formatBytes } from "./setupManifest";
import type {
  SetupModelRequirement,
  SetupNodeRequirement,
  SetupRequirementsReport
} from "./setupRequirements";

export const OPENLAYER_UI_ID_PREFIX = "openlayer:";

export type AssistedInstallExclusionReasonId =
  | "already-installed"
  | "wrong-folder"
  | "licence-gated"
  | "no-download-url"
  | "not-checked"
  | "custom-node";

export type AssistedInstallExclusionReason = {
  id: AssistedInstallExclusionReasonId;
  message: string;
};

export type AssistedInstallItem = SetupModelRequirement & {
  downloadUrl: string;
};

export type AssistedInstallExclusion =
  | {
      kind: "model";
      requirement: SetupModelRequirement;
      reason: AssistedInstallExclusionReason;
    }
  | {
      kind: "custom-node";
      requirement: SetupNodeRequirement;
      reason: AssistedInstallExclusionReason;
    };

export type AssistedInstallPlan = {
  installable: AssistedInstallItem[];
  excluded: AssistedInstallExclusion[];
  totalBytes: number;
  formattedTotal: string;
};

export type ManagerInstallModelRequest = {
  save_path: string;
  base: string;
  filename: string;
  url: string;
  ui_id: string;
};

export type ManagerQueueStatus = {
  total_count: number;
  done_count: number;
  in_progress_count: number;
  is_processing: boolean;
};

export type QueuePreconditionVerdict =
  | { allowed: true }
  | {
      allowed: false;
      reason: "already-processing" | "foreign-items-queued";
      message: string;
    };

export type ManagerQueueStatusPayload = {
  status: string;
  target?: string | null;
  [key: string]: unknown;
};

export type InstallProgressSummary = {
  pending: number;
  inProgress: number;
  done: number;
  foreign: number;
  currentUiId: string | null;
};

const ALREADY_INSTALLED_REASON: AssistedInstallExclusionReason = {
  id: "already-installed",
  message: "This requirement is already installed."
};

const WRONG_FOLDER_REASON: AssistedInstallExclusionReason = {
  id: "wrong-folder",
  message:
    "This model is already on disk in a different folder. OpenLayer will not download a second copy; move the existing file to the required folder instead."
};

const LICENCE_GATED_REASON: AssistedInstallExclusionReason = {
  id: "licence-gated",
  message:
    "OpenLayer cannot download this model because its licence must be accepted in an authenticated browser session. An unauthenticated download can save an HTML error page instead of a working model."
};

const NO_DOWNLOAD_URL_REASON: AssistedInstallExclusionReason = {
  id: "no-download-url",
  message: "OpenLayer cannot install this model because no direct download URL is available."
};

const NOT_CHECKED_REASON: AssistedInstallExclusionReason = {
  id: "not-checked",
  message:
    "OpenLayer has not checked this requirement against ComfyUI, so it will not offer an install that may be unnecessary."
};

const CUSTOM_NODE_REASON: AssistedInstallExclusionReason = {
  id: "custom-node",
  message:
    "OpenLayer cannot install custom nodes in this version. Use Copy Link and install the package through ComfyUI-Manager."
};

/**
 * Produces the subset that OpenLayer can safely offer through Manager without
 * changing the report's broader "remaining download" figure. These totals are
 * intentionally allowed to disagree: the setup report includes missing models
 * that assisted install must refuse.
 */
export function planAssistedInstall(report: SetupRequirementsReport): AssistedInstallPlan {
  const installable: AssistedInstallItem[] = [];
  const excluded: AssistedInstallExclusion[] = [];

  for (const model of report.models) {
    const reason = getModelExclusionReason(model);

    if (reason) {
      excluded.push({ kind: "model", requirement: model, reason });
    } else if (hasDownloadUrl(model)) {
      installable.push(model);
    }
  }

  // Custom-node installation is deliberately excluded. The git URL route
  // requires the non-default allow_git_url_install flag, while the queue route
  // needs registry id/channel/mode fields OpenLayer does not carry. Node rows
  // therefore retain their existing Copy Link path instead of being guessed at.
  for (const customNode of report.customNodes) {
    excluded.push({
      kind: "custom-node",
      requirement: customNode,
      reason: getNodeExclusionReason(customNode)
    });
  }

  installable.sort(
    (left, right) =>
      (right.sizeBytes ?? 0) - (left.sizeBytes ?? 0) || left.key.localeCompare(right.key)
  );

  const totalBytes = installable.reduce((total, item) => total + (item.sizeBytes ?? 0), 0);

  return {
    installable,
    excluded,
    totalBytes,
    formattedTotal: formatBytes(totalBytes)
  };
}

export function createInstallModelRequest(item: AssistedInstallItem): ManagerInstallModelRequest {
  return {
    save_path: item.targetFolder,
    base: item.label,
    filename: item.modelName,
    url: item.downloadUrl,
    ui_id: `${OPENLAYER_UI_ID_PREFIX}${item.key}`
  };
}

export function evaluateQueuePrecondition(status: ManagerQueueStatus): QueuePreconditionVerdict {
  if (status.is_processing) {
    return {
      allowed: false,
      reason: "already-processing",
      message:
        "OpenLayer will not add installs while ComfyUI-Manager is downloading something. Wait for the current download to finish, then try again."
    };
  }

  if (status.total_count > status.done_count) {
    return {
      allowed: false,
      reason: "foreign-items-queued",
      message:
        "OpenLayer will not start the ComfyUI-Manager queue because it already contains items that OpenLayer did not put there. Finish those items in ComfyUI-Manager, then try again."
    };
  }

  return { allowed: true };
}

export function summarizeInstallProgress(
  openLayerUiIds: Iterable<string>,
  payloads: readonly ManagerQueueStatusPayload[]
): InstallProgressSummary {
  const states = new Map<string, "pending" | "in-progress" | "done">();
  const foreignTargets = new Set<string>();
  const runningOrder: string[] = [];

  for (const uiId of openLayerUiIds) {
    states.set(uiId, "pending");
  }

  for (const payload of payloads) {
    const target = typeof payload.target === "string" ? payload.target : null;

    if (!target) {
      continue;
    }

    if (!states.has(target)) {
      foreignTargets.add(target);
      continue;
    }

    if (payload.status === "pending") {
      states.set(target, "pending");
    } else if (payload.status === "in_progress") {
      states.set(target, "in-progress");
      runningOrder.push(target);
    } else if (payload.status === "done") {
      states.set(target, "done");
    }
  }

  let pending = 0;
  let inProgress = 0;
  let done = 0;

  for (const state of states.values()) {
    if (state === "pending") {
      pending += 1;
    } else if (state === "in-progress") {
      inProgress += 1;
    } else {
      done += 1;
    }
  }

  const currentUiId = [...runningOrder]
    .reverse()
    .find((uiId) => states.get(uiId) === "in-progress") ?? null;

  return {
    pending,
    inProgress,
    done,
    foreign: foreignTargets.size,
    currentUiId
  };
}

function getModelExclusionReason(
  model: SetupModelRequirement
): AssistedInstallExclusionReason | null {
  if (model.status === "installed") {
    return ALREADY_INSTALLED_REASON;
  }

  // A wrong-folder file is already on disk. Downloading it again would create
  // a duplicate; the required operation is a move, which OpenLayer cannot do.
  if (model.status === "wrong-folder") {
    return WRONG_FOLDER_REASON;
  }

  // This check must precede every remaining model exclusion. A gated URL can
  // quietly save an authentication HTML page under the model filename, making
  // it indistinguishable from a corrupt model until ComfyUI tries to load it.
  if (model.licenseGated) {
    return LICENCE_GATED_REASON;
  }

  if (!model.downloadUrl) {
    return NO_DOWNLOAD_URL_REASON;
  }

  if (model.status === "not-checked") {
    return NOT_CHECKED_REASON;
  }

  return null;
}

function hasDownloadUrl(model: SetupModelRequirement): model is AssistedInstallItem {
  return typeof model.downloadUrl === "string" && model.downloadUrl.length > 0;
}

function getNodeExclusionReason(node: SetupNodeRequirement): AssistedInstallExclusionReason {
  if (node.status === "installed") {
    return ALREADY_INSTALLED_REASON;
  }

  if (node.status === "wrong-folder") {
    return WRONG_FOLDER_REASON;
  }

  if (node.status === "not-checked") {
    return NOT_CHECKED_REASON;
  }

  return CUSTOM_NODE_REASON;
}

// There is intentionally no queue reset or server reboot operation in this
// layer. Reset could discard another client's queue, and reboot would restart
// the user's server without their control; their absence is a safety property.
