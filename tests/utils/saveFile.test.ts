import { describe, expect, it } from "vitest";

import {
  describeSaveFileOutcome,
  openSaveDialog,
  type SaveFileOutcome
} from "../../src/utils/saveFile";

// Regression for the failure this module's spike hit in real Photoshop: the
// method was pulled off localFileSystem to be typeof-checked, then called bare,
// so `this` was undefined inside UXP and it threw before any dialog appeared.
// TypeScript cannot see a detached method; only calling it can.
describe("save dialog invocation", () => {
  it("calls getFileForSaving on its host so the receiver survives", async () => {
    const observed = { called: false, receiverWasHost: false };
    const host = {
      async getFileForSaving(this: unknown) {
        observed.called = true;
        observed.receiverWasHost = this === host;

        return null;
      }
    };

    await openSaveDialog(host, "example.png");

    expect(observed).toEqual({ called: true, receiverWasHost: true });
  });

  it("passes the suggested name and a png type filter", async () => {
    const calls: unknown[][] = [];
    const host = {
      async getFileForSaving(...args: unknown[]) {
        calls.push(args);

        return null;
      }
    };

    await openSaveDialog(host, "OpenLayer_Layer.png");

    expect(calls).toEqual([["OpenLayer_Layer.png", { types: ["png"] }]]);
  });
});

describe("save outcome reporting", () => {
  it("describes every outcome distinctly", () => {
    const outcomes: SaveFileOutcome[] = [
      { kind: "saved", fileName: "a.png", byteLength: 10 },
      { kind: "cancelled" },
      { kind: "unsupported" },
      { kind: "failed", stage: "picker", message: "boom" },
      { kind: "failed", stage: "write", message: "boom" }
    ];

    const described = outcomes.map((outcome) => describeSaveFileOutcome(outcome, "the mask"));

    expect(new Set(described).size).toBe(outcomes.length);
  });

  it("names the file that was written", () => {
    expect(describeSaveFileOutcome({ kind: "saved", fileName: "mask.png", byteLength: 4 }, "the mask"))
      .toBe("Saved the mask to mask.png.");
  });

  // "the mask was not written" reads as a bug report; "The mask was not
  // written" reads as a statement of fact, which is what a cancel is.
  it("starts the cancelled sentence with a capital", () => {
    expect(describeSaveFileOutcome({ kind: "cancelled" }, "the mask"))
      .toBe("Save cancelled. The mask was not written.");
  });

  it("distinguishes a failed dialog from a failed write", () => {
    const picker = describeSaveFileOutcome({ kind: "failed", stage: "picker", message: "no" }, "the mask");
    const write = describeSaveFileOutcome({ kind: "failed", stage: "write", message: "no" }, "the mask");

    expect(picker).toContain("Could not open the save dialog");
    expect(write).toContain("Could not write the mask");
  });
});
