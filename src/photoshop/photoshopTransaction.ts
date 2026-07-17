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
  | "restore-channel-targeting"
  | "select-result-layer"
  | "restore-previous-layer";

// The second pass, run only when finalization itself failed. It abandons the
// import regardless of how the operation went: a result layer that cannot be
// finalized safely must not be left behind, and the snapshot channel is retained
// until the selection is actually back.
export type ImportRecoveryAction =
  | "retry-delete-temporary-mask-layer"
  | "retry-delete-temporary-black-layer"
  | "roll-back-result-layer"
  | "retry-restore-selection"
  | "delete-selection-snapshot-channel"
  | "restore-channel-targeting"
  | "restore-previous-layer";

// Describes what survived the first pass, so the retry only touches what is
// still there.
export type ImportRecoveryState = Readonly<{
  temporaryMaskLayerPresent: boolean;
  temporaryBlackLayerPresent: boolean;
  resultLayerPresent: boolean;
  selectionRestored: boolean;
  selectionSnapshotChannelPresent: boolean;
  previousLayerAvailable: boolean;
}>;

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
  actions.push("restore-channel-targeting");
  if (outcome === "success" && state.resultLayerCreated) actions.push("select-result-layer");
  if (outcome === "failure" && state.previousLayerAvailable) actions.push("restore-previous-layer");
  return actions;
}

export function planImportRecovery(state: ImportRecoveryState): ImportRecoveryAction[] {
  const actions: ImportRecoveryAction[] = [];
  if (state.temporaryMaskLayerPresent) actions.push("retry-delete-temporary-mask-layer");
  if (state.temporaryBlackLayerPresent) actions.push("retry-delete-temporary-black-layer");
  if (state.resultLayerPresent) actions.push("roll-back-result-layer");
  if (!state.selectionRestored) actions.push("retry-restore-selection");
  if (state.selectionSnapshotChannelPresent) actions.push("delete-selection-snapshot-channel");
  actions.push("restore-channel-targeting");
  if (state.previousLayerAvailable) actions.push("restore-previous-layer");
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
