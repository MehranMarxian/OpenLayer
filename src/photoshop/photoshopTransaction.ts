export type ImportTransactionState = Readonly<{
  resultLayerCreated: boolean;
  temporaryMaskLayerCreated: boolean;
  temporaryBlackLayerCreated: boolean;
  selectionSnapshotChannelCreated: boolean;
  previousLayerAvailable: boolean;
}>;

export type ImportFinalizationAction =
  | "delete-temporary-mask-layer"
  | "delete-temporary-black-layer"
  | "delete-result-layer"
  | "restore-selection"
  | "delete-selection-snapshot-channel"
  | "select-result-layer"
  | "restore-previous-layer";

export type CleanupTask = Readonly<{
  label: string;
  run: () => Promise<void>;
}>;

export type MaskSandwichLayers = Readonly<{
  maskLayerId: number;
  blackLayerId: number;
}>;

// The exact-mask import reads its selection from the RGB composite, which is only
// a faithful copy of the saved mask while the opaque mask layer sits directly on
// top of the full-canvas black backing at the very top of the document. Any other
// order means a visible artwork layer is contributing to the composite.
export function isMaskSandwichTopmost(
  topLevelLayerIds: readonly (number | undefined)[],
  sandwich: MaskSandwichLayers
) {
  return topLevelLayerIds[0] === sandwich.maskLayerId && topLevelLayerIds[1] === sandwich.blackLayerId;
}

export type CleanupFailure = Readonly<{ label: string; message: string }>;

export function planImportFinalization(
  state: ImportTransactionState,
  outcome: "success" | "failure"
): ImportFinalizationAction[] {
  const actions: ImportFinalizationAction[] = [];
  if (state.temporaryMaskLayerCreated) actions.push("delete-temporary-mask-layer");
  if (state.temporaryBlackLayerCreated) actions.push("delete-temporary-black-layer");
  if (outcome === "failure" && state.resultLayerCreated) actions.push("delete-result-layer");
  actions.push("restore-selection");
  if (state.selectionSnapshotChannelCreated) actions.push("delete-selection-snapshot-channel");
  if (outcome === "success" && state.resultLayerCreated) actions.push("select-result-layer");
  if (outcome === "failure" && state.previousLayerAvailable) actions.push("restore-previous-layer");
  return actions;
}

export async function runCleanupTasks(tasks: readonly CleanupTask[]): Promise<CleanupFailure[]> {
  const failures: CleanupFailure[] = [];
  for (const task of tasks) {
    try {
      await task.run();
    } catch (caughtError) {
      failures.push({
        label: task.label,
        message: caughtError instanceof Error ? caughtError.message : String(caughtError)
      });
    }
  }
  return failures;
}

export function formatCleanupFailures(failures: readonly CleanupFailure[]) {
  return failures.map(({ label, message }) => `${label}: ${message}`).join("; ");
}
