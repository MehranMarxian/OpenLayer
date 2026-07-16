import { describe, expect, it, vi } from "vitest";
import { formatCleanupFailures, planImportFinalization, runCleanupTasks } from "../../src/photoshop/photoshopTransaction";

const completeState = {
  resultLayerCreated: true,
  temporaryMaskLayerCreated: true,
  temporaryBlackLayerCreated: true,
  selectionSnapshotChannelCreated: true,
  previousLayerAvailable: true
};

describe("Photoshop import transaction finalization", () => {
  it("restores selection and leaves the imported result active after success", () => {
    expect(planImportFinalization(completeState, "success")).toEqual([
      "delete-temporary-mask-layer",
      "delete-temporary-black-layer",
      "restore-selection",
      "delete-selection-snapshot-channel",
      "select-result-layer"
    ]);
  });

  it("removes the result and restores selection and previous layer after failure", () => {
    expect(planImportFinalization(completeState, "failure")).toEqual([
      "delete-temporary-mask-layer",
      "delete-temporary-black-layer",
      "delete-result-layer",
      "restore-selection",
      "delete-selection-snapshot-channel",
      "restore-previous-layer"
    ]);
  });

  it("restores a no-selection state without requiring a snapshot channel", () => {
    expect(planImportFinalization({ ...completeState, selectionSnapshotChannelCreated: false }, "success"))
      .toContain("restore-selection");
    expect(planImportFinalization({ ...completeState, selectionSnapshotChannelCreated: false }, "success"))
      .not.toContain("delete-selection-snapshot-channel");
  });

  it("restores the previous layer after failure even when no selection existed", () => {
    expect(planImportFinalization({ ...completeState, selectionSnapshotChannelCreated: false }, "failure")).toEqual([
      "delete-temporary-mask-layer",
      "delete-temporary-black-layer",
      "delete-result-layer",
      "restore-selection",
      "restore-previous-layer"
    ]);
  });

  it("attempts every cleanup task and aggregates multiple failures", async () => {
    const attempted: string[] = [];
    const failures = await runCleanupTasks([
      { label: "mask", run: vi.fn(async () => { attempted.push("mask"); throw new Error("mask failed"); }) },
      { label: "result", run: vi.fn(async () => { attempted.push("result"); throw new Error("result failed"); }) },
      { label: "selection", run: vi.fn(async () => { attempted.push("selection"); }) }
    ]);

    expect(attempted).toEqual(["mask", "result", "selection"]);
    expect(formatCleanupFailures(failures)).toBe("mask: mask failed; result: result failed");
  });
});
