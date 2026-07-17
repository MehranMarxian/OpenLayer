export type GenerationRunState = Readonly<{
  runId: number;
  isCancelled: boolean;
}>;

export type GenerationCommitValidation =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "cancelled" | "stale" | "missing-active-run" }>;

export function validateGenerationCommit(
  run: GenerationRunState,
  activeRun: GenerationRunState | null
): GenerationCommitValidation {
  if (run.isCancelled) return { ok: false, reason: "cancelled" };
  if (!activeRun) return { ok: false, reason: "missing-active-run" };
  if (activeRun.runId !== run.runId) return { ok: false, reason: "stale" };
  return { ok: true };
}

export function canPublishGenerationUpdate(run: GenerationRunState, activeRun: GenerationRunState | null) {
  return validateGenerationCommit(run, activeRun).ok;
}

export function shouldFinalizeActiveRun(run: GenerationRunState, activeRun: GenerationRunState | null) {
  return activeRun?.runId === run.runId;
}
