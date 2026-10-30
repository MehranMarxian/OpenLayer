import { describe, expect, it } from "vitest";
import { evaluateInpaintSelectionFreshness } from "../../src/ui/inpaintSelectionFreshness";
import type { InpaintSourceMode } from "../../src/photoshop/inpaintSourceMode";
import type { NormalizedSelectionBounds } from "../../src/photoshop/selectionUtils";

function bounds(left: number, top: number, right: number, bottom: number): NormalizedSelectionBounds {
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

const CAPTURED = bounds(100, 200, 300, 500);

function source(sourceMode: InpaintSourceMode = "visible-canvas") {
  return {
    originatingDocument: { id: 7, name: "Doc" },
    selection: { bounds: CAPTURED },
    sourceMode
  } as Parameters<typeof evaluateInpaintSelectionFreshness>[0];
}

describe("evaluateInpaintSelectionFreshness", () => {
  it("passes when the live selection has the captured bounds", () => {
    expect(evaluateInpaintSelectionFreshness(source(), { documentId: 7, bounds: bounds(100, 200, 300, 500) }))
      .toEqual({ stale: false });
  });

  it("passes when nothing is selected, because deselecting is how the artist keeps the capture", () => {
    expect(evaluateInpaintSelectionFreshness(source(), { documentId: 7, bounds: null }))
      .toEqual({ stale: false });
  });

  it("passes when another document is active, because its selection is unrelated to the capture", () => {
    expect(evaluateInpaintSelectionFreshness(source(), { documentId: 8, bounds: bounds(0, 0, 10, 10) }))
      .toEqual({ stale: false });
  });

  it.each([
    ["left", bounds(99, 200, 300, 500)],
    ["top", bounds(100, 201, 300, 500)],
    ["right", bounds(100, 200, 301, 500)],
    ["bottom", bounds(100, 200, 300, 499)]
  ])("is stale when only the %s edge moved by one pixel", (_edge, live) => {
    expect(evaluateInpaintSelectionFreshness(source(), { documentId: 7, bounds: live }).stale).toBe(true);
  });

  it("is stale when the selection moved without changing size", () => {
    expect(evaluateInpaintSelectionFreshness(source(), { documentId: 7, bounds: bounds(110, 200, 310, 500) }).stale)
      .toBe(true);
  });

  it.each([
    ["visible-canvas", "Capture Visible"],
    ["active-layer", "Capture Active Layer"]
  ] as const)("names the button that made a %s capture", (mode, label) => {
    const result = evaluateInpaintSelectionFreshness(source(mode), { documentId: 7, bounds: bounds(0, 0, 10, 10) });

    expect(result.stale && result.message).toContain(`Click ${label} to use the new selection.`);
  });

  it("writes plain text, because panel status strings render via textContent", () => {
    const result = evaluateInpaintSelectionFreshness(source(), { documentId: 7, bounds: bounds(0, 0, 10, 10) });

    expect(result.stale && result.message).not.toMatch(/`|--|\*\*/);
  });

  it("reports both sets of bounds for the diagnostics line", () => {
    const result = evaluateInpaintSelectionFreshness(source(), { documentId: 7, bounds: bounds(0, 0, 10, 10) });

    expect(result.stale && result.technicalMessage).toBe(
      "Captured selection 200 x 300 at 100, 200; live selection 10 x 10 at 0, 0."
    );
  });
});
