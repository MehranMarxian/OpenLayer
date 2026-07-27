import { describe, expect, it } from "vitest";

import { decodeRgbaPng } from "../../src/utils/png";
import {
  createSpikeImageBytes,
  describeSaveFilePickerOutcome,
  openSaveDialog,
  type SaveFilePickerOutcome
} from "../../src/utils/saveFilePicker";

// Regression for the spike's own first failure in Photoshop. The method was
// pulled off localFileSystem to typeof-check it and then called bare, so `this`
// was undefined inside UXP and it threw before any dialog appeared. Nothing in
// TypeScript catches a detached method; only calling it can.
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

    await openSaveDialog(host, "spike.png");

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

    await openSaveDialog(host, "OpenLayer_SavePickerSpike.png");

    expect(calls).toEqual([["OpenLayer_SavePickerSpike.png", { types: ["png"] }]]);
  });
});

// The picker call itself needs Photoshop and is Mehran's smoke test. What can
// be checked here is that the bytes the spike offers to write are a real PNG,
// so that "the saved file will not open" can be attributed to the write path
// rather than to the payload.
describe("save file picker spike payload", () => {
  it("encodes a decodable 64x64 PNG", () => {
    const decoded = decodeRgbaPng(createSpikeImageBytes());

    expect(decoded.width).toBe(64);
    expect(decoded.height).toBe(64);
    expect(decoded.rgba.byteLength).toBe(64 * 64 * 4);
  });

  it("draws an opaque black border around a magenta field", () => {
    const decoded = decodeRgbaPng(createSpikeImageBytes());
    const pixelAt = (x: number, y: number) => {
      const offset = (y * decoded.width + x) * 4;

      return Array.from(decoded.rgba.slice(offset, offset + 4));
    };

    expect(pixelAt(0, 0)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(63, 63)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(32, 32)).toEqual([255, 0, 255, 255]);
  });
});

describe("save file picker spike reporting", () => {
  // Cancel and unsupported are expected answers, not failures, and the spike is
  // only useful if its report says which one happened.
  it("describes every outcome distinctly", () => {
    const outcomes: SaveFilePickerOutcome[] = [
      { kind: "saved", fileName: "spike.png", byteLength: 128 },
      { kind: "cancelled" },
      { kind: "unsupported" },
      { kind: "failed", stage: "picker", message: "boom" },
      { kind: "failed", stage: "write", message: "boom" }
    ];

    const described = outcomes.map(describeSaveFilePickerOutcome);

    expect(new Set(described).size).toBe(outcomes.length);
    expect(described.every((text) => text.startsWith("Save picker spike:"))).toBe(true);
  });

  it("reports the saved file name and size", () => {
    const text = describeSaveFilePickerOutcome({
      kind: "saved",
      fileName: "spike.png",
      byteLength: 128
    });

    expect(text).toContain("spike.png");
    expect(text).toContain("128");
  });

  it("distinguishes a failed dialog from a failed write", () => {
    const picker = describeSaveFilePickerOutcome({ kind: "failed", stage: "picker", message: "no" });
    const write = describeSaveFilePickerOutcome({ kind: "failed", stage: "write", message: "no" });

    expect(picker).toContain("opening the dialog failed");
    expect(write).toContain("writing to it failed");
  });
});
