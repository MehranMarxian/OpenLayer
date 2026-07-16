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
