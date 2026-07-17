import { describe, expect, it } from "vitest";
import { resolveStatusProgress } from "../../src/ui/App";

describe("resolveStatusProgress", () => {
  it("is hidden when not busy", () => {
    expect(resolveStatusProgress("Ready.", false, 40)).toEqual({ isBusy: false, percent: null });
  });

  it("clears a remembered percentage after cancellation", () => {
    expect(resolveStatusProgress("Generation cancelled.", false, 48)).toEqual({
      isBusy: false,
      percent: null
    });
  });

  it("is indeterminate during warm-up before any step progress", () => {
    expect(resolveStatusProgress("Preparing workflow...", true, null)).toEqual({
      isBusy: true,
      percent: null
    });
  });

  it("becomes determinate from a ComfyUI step message", () => {
    expect(resolveStatusProgress("Generating step 5 of 20 (25%)...", true, null)).toEqual({
      isBusy: true,
      percent: 25
    });
  });

  it("keeps the last percent when a percent-less poll tick arrives mid-run", () => {
    // The bug this guards against: the history poll tick has no percent and
    // must not collapse the determinate bar back to the warm-up animation.
    expect(resolveStatusProgress("ComfyUI is running this prompt...", true, 25)).toEqual({
      isBusy: true,
      percent: 25
    });
  });

  it("keeps the last percent while retrieving the final image", () => {
    expect(resolveStatusProgress("Retrieving final image...", true, 100)).toEqual({
      isBusy: true,
      percent: 100
    });
  });

  it("advances to a newer step percentage", () => {
    expect(resolveStatusProgress("Generating step 18 of 20 (90%)...", true, 25).percent).toBe(90);
  });
});
