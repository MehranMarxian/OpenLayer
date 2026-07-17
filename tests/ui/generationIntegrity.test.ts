import { describe, expect, it } from "vitest";
import { canPublishGenerationUpdate, shouldFinalizeActiveRun, validateGenerationCommit } from "../../src/ui/generationIntegrity";

describe("generation run integrity", () => {
  const current = { runId: 12, isCancelled: false };

  it("allows only the current non-cancelled run to commit", () => {
    expect(validateGenerationCommit(current, current)).toEqual({ ok: true });
  });

  it("blocks a cancelled run even if ComfyUI later returns an image", () => {
    expect(validateGenerationCommit({ ...current, isCancelled: true }, current)).toEqual({
      ok: false,
      reason: "cancelled"
    });
  });

  it("blocks an older run after a newer run becomes active", () => {
    expect(validateGenerationCommit(current, { runId: 13, isCancelled: false })).toEqual({
      ok: false,
      reason: "stale"
    });
  });

  it("blocks commits after active ownership has been cleared", () => {
    expect(validateGenerationCommit(current, null)).toEqual({
      ok: false,
      reason: "missing-active-run"
    });
  });

  it("prevents stale callbacks and finalizers from mutating a newer run", () => {
    const newer = { runId: 13, isCancelled: false };
    expect(canPublishGenerationUpdate(current, newer)).toBe(false);
    expect(shouldFinalizeActiveRun(current, newer)).toBe(false);
    expect(shouldFinalizeActiveRun(newer, newer)).toBe(true);
  });
});
