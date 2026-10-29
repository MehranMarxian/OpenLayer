import { describe, expect, it } from "vitest";
import { DEFAULT_SELECTION_COUNT, normalizeSelectionPrompt } from "../../src/comfy/selectionPrompt";

describe("normalizeSelectionPrompt", () => {
  it("gives a bare subject a count, because SAM 3.1 otherwise returns one object", () => {
    expect(normalizeSelectionPrompt("chair")).toBe(`chair:${DEFAULT_SELECTION_COUNT}`);
    expect(DEFAULT_SELECTION_COUNT).toBe(10);
  });

  it("keeps a count the artist wrote", () => {
    expect(normalizeSelectionPrompt("chair:20")).toBe("chair:20");
    expect(normalizeSelectionPrompt("eye : 2")).toBe("eye : 2");
  });

  it("handles several subjects separately", () => {
    expect(normalizeSelectionPrompt("table, umbrella:3,the red car")).toBe("table:10, umbrella:3, the red car:10");
  });

  it("drops empty parts and returns nothing when nothing was typed", () => {
    expect(normalizeSelectionPrompt(" car ,, tree ,")).toBe("car:10, tree:10");
    expect(normalizeSelectionPrompt("")).toBe("");
    expect(normalizeSelectionPrompt(" , ")).toBe("");
  });

  it("does not mistake a number inside a subject for a count", () => {
    expect(normalizeSelectionPrompt("route 66 sign")).toBe("route 66 sign:10");
  });
});
