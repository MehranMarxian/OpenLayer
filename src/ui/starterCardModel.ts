import type { AssistedInstallItem, AssistedInstallPlan } from "../comfy/assistedInstall";
import { formatBytes } from "../comfy/setupManifest";
import { STARTER_LICENCE, STARTER_NAME, type StarterStatus } from "../comfy/starterKit";
import { describeDownloadSource, type SetupRowField } from "./setupInstallModel";

/**
 * The "Start here" card at the top of Setup: what it says and which buttons it
 * shows. Pure, so every state can be tested without Photoshop; App.ts only
 * draws it and runs the downloads.
 *
 * The card exists to get a new artist from "ComfyUI is running" to a first
 * layer with one decision. It is hidden once the starter is installed, so the
 * screen is unchanged for everyone already set up.
 */

export type StarterCardPhase =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "downloading"; index: number; total: number; modelName: string };

export type StarterCardButton = { label: string; action: "request" | "confirm" | "cancel" | "stop" };

export type StarterCardView = {
  hidden: boolean;
  title: string;
  meta: string;
  summary: string;
  /** Drawn in the same box a Setup row uses to confirm a single download. */
  confirm: { headline: string; files: SetupRowField[][]; note: string } | null;
  buttons: StarterCardButton[];
};

/**
 * The files the Download starter button fetches, in the order it fetches them:
 * smallest first. A wrong folder or a network problem then shows up after the
 * 336 MB VAE rather than after the 8.0 GB encoder.
 *
 * Only files the Setup plan already allows are included, so every licence and
 * wrong-folder refusal the rows apply applies here too.
 */
export function getStarterDownloadItems(
  status: StarterStatus,
  plan: AssistedInstallPlan | null
): AssistedInstallItem[] {
  if (!plan) return [];

  const keys = new Set(status.toDownload.map((file) => file.key));

  return plan.installable
    .filter((item) => keys.has(item.key))
    .sort((left, right) => (left.sizeBytes ?? 0) - (right.sizeBytes ?? 0) || left.key.localeCompare(right.key));
}

export function createStarterCardView(
  status: StarterStatus,
  items: readonly AssistedInstallItem[],
  phase: StarterCardPhase,
  options: { busyElsewhere?: boolean } = {}
): StarterCardView {
  const base = {
    hidden: false,
    title: "Start here",
    meta: `${STARTER_NAME}, ${STARTER_LICENCE}`,
    summary: withoutHeading(status.summary),
    confirm: null as StarterCardView["confirm"],
    buttons: [] as StarterCardButton[]
  };

  if (phase.kind === "downloading") {
    return {
      ...base,
      summary: `Downloading file ${phase.index} of ${phase.total}: ${phase.modelName}. Progress is shown below.`,
      buttons: [{ label: "Stop", action: "stop" }]
    };
  }

  if (status.state === "ready") {
    return { ...base, hidden: true };
  }

  // Not checked, a file to move, or a file OpenLayer cannot fetch: the summary
  // already says what to do, and a button would only fail.
  if (status.state !== "needs-download" || items.length === 0) {
    return base;
  }

  const bytes = items.reduce((total, item) => total + (item.sizeBytes ?? 0), 0);

  if (phase.kind === "confirming") {
    return {
      ...base,
      confirm: {
        headline:
          items.length === 1
            ? `Download this file (${formatBytes(bytes)})?`
            : `Download these ${items.length} files (${formatBytes(bytes)}) one after another?`,
        files: items.map((item) => [
          { label: "File", value: item.modelName },
          { label: "Size", value: item.formattedSize },
          { label: "Into", value: `models/${item.targetFolder}/` },
          { label: "From", value: describeDownloadSource(item.downloadUrl) }
        ]),
        note:
          "If OpenLayer asks for a folder, choose ComfyUI's models folder once, and each file goes into the right folder inside it. Stopping is safe: pressing Download starter again resumes."
      },
      buttons: [
        { label: "Download", action: "confirm" },
        { label: "Cancel", action: "cancel" }
      ]
    };
  }

  return {
    ...base,
    // Another download already holds the single download slot.
    buttons: options.busyElsewhere ? [] : [{ label: `Download starter (${formatBytes(bytes)})`, action: "request" }]
  };
}

// The card's heading already says "Start here", which the starter's summary
// opens with too (it is written to stand alone elsewhere).
function withoutHeading(summary: string): string {
  const rest = summary.replace(/^Start here: /, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
