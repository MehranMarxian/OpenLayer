import { describe, expect, it } from "vitest";
import {
  createInpaintImportContext,
  resolveInpaintImportContext
} from "../../src/ui/inpaintImportContext";

describe("Inpaint import context", () => {
  it("uses the immutable history source instead of a newer active source", () => {
    const historySource = { filename: "original-mask-source.png", selectionId: "selection-a" };
    const historyResult = { filename: "original-result.png" };
    const newerSource = { filename: "new-mask-source.png", selectionId: "selection-b" };
    const newerResult = { filename: "new-result.png" };
    const historyContext = createInpaintImportContext(historySource, historyResult);
    const activeContext = createInpaintImportContext(newerSource, newerResult);

    const resolved = resolveInpaintImportContext(historyContext, activeContext);

    expect(resolved).toBe(historyContext);
    expect(resolved?.source).toBe(historySource);
    expect(resolved?.result).toBe(historyResult);
  });

  it("uses the active result context for a normal non-history import", () => {
    const activeContext = createInpaintImportContext(
      { filename: "active-source.png" },
      { filename: "active-result.png" }
    );

    expect(resolveInpaintImportContext(undefined, activeContext)).toBe(activeContext);
  });
});
