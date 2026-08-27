// @vitest-environment jsdom
//
// Reordering a reference left the progress bar spinning forever in Photoshop.
//
// `setStatusProgress` treats tone "idle" as *busy* unless the message reads as
// finished, which is right for "Uploading reference 2 of 3..." and wrong for
// "Reference moved to position 2." -- a completed action that happens to
// contain none of the words the busy check whitelists. So the bar started and
// nothing ever stopped it.
//
// The bug lives in the pairing of message and tone, not in either alone, which
// is why this covers both halves: that the helper behaves as expected, and that
// the two call sites still pass the tone that makes it behave.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { setStatusProgress, StatusTone } from "../../src/ui/statusBars";

const appSource = readFileSync(resolve(__dirname, "../../src/ui/App.ts"), "utf8");

function progressAfter(status: string, tone: StatusTone) {
  const element = document.createElement("div");
  element.className = "status-progress";
  element.appendChild(document.createElement("span"));
  setStatusProgress(element, status, tone);
  return element;
}

describe("multi-reference status progress", () => {
  it("would spin forever if a finished list action reported itself as idle", () => {
    // The trap, stated so the next person to reach for "idle" here sees why.
    expect(progressAfter("Reference moved to position 2.", "idle").hidden).toBe(false);
    expect(progressAfter("Reference removed.", "idle").hidden).toBe(false);
  });

  it("reports both list actions as finished, not as work in progress", () => {
    // Reading the source is the only way to catch a wrong tone here: the
    // handlers live inside the renderApp closure and cannot be called directly.
    expect(appSource).toContain(
      'setMultiReferenceStatus(elements, "Reference removed.", "ready");'
    );
    expect(appSource).toContain(
      "setMultiReferenceStatus(elements, `Reference moved to position ${movedTo + 1}.`, \"ready\");"
    );
  });

  it("stops the bar for a finished list action", () => {
    for (const status of ["Reference moved to position 2.", "Reference removed.", "Reference 3 added."]) {
      expect(progressAfter(status, "ready").hidden).toBe(true);
    }
  });

  it("still runs the bar while a composition is actually working", () => {
    for (const status of [
      "Preparing composition workflow...",
      "Uploading reference 2 of 3...",
      "Composing image..."
    ]) {
      expect(progressAfter(status, "idle").hidden).toBe(false);
    }
  });

  it("stops the bar when the composition finishes or fails", () => {
    expect(progressAfter("Composition complete.", "ready").hidden).toBe(true);
    expect(progressAfter("Composition failed.", "error").hidden).toBe(true);
    expect(progressAfter("Reference list full.", "error").hidden).toBe(true);
  });
});
