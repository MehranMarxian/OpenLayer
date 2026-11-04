import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A failed capture must not leave the previous capture in place.
 *
 * Eight tools used to keep it: the error turned red, but the old source
 * preview stayed and so did the enabled Generate button, so the next press
 * quietly ran on a selection or layer the artist had already replaced. Seen
 * 2026-10-30 in Inpaint, after Capture Active Layer failed on a masked layer.
 *
 * Read from source because renderApp needs a whole Photoshop host to run. Each
 * catch block that reports a failed capture must also clear that tool's source.
 */
describe("failed captures", () => {
  const app = readFileSync(resolve(__dirname, "../../src/ui/App.ts"), "utf8").replace(/\r\n/g, "\n");
  const catchBlocks = [...app.matchAll(/\} catch \(caughtError\) \{\n([\s\S]*?)\n {4}\}/g)].map((match) => match[1] ?? "");
  // "Reference capture failed" is Edit Image's and Multi-Reference's Add
  // button: it appends to a list, so a failure rightly leaves the references
  // already there. Every other capture replaces the tool's one source.
  const captureFailures = catchBlocks.filter(
    (block) => /capture failed\./i.test(block) && !/Reference capture failed\./.test(block)
  );

  it("finds the capture failure handlers it is guarding", () => {
    // Inpaint, Image to Image, Sketch, Outpaint, Upscale, Style Reference,
    // Unflatten, Prompt from Layer, Remove Background, Select by Text, Layer
    // Maps and Camera Angle. A drop here means the pattern stopped matching.
    expect(captureFailures.length).toBeGreaterThanOrEqual(12);
  });

  it("clears the tool's source in every one of them", () => {
    const keepsOldSource = captureFailures.filter((block) => !/set\w+Source\(null\)/.test(block));

    expect(keepsOldSource, "catch blocks that report a failed capture but keep the old one").toEqual([]);
  });
});
