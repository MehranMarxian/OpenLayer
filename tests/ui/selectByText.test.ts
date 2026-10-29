import { describe, expect, it } from "vitest";
import {
  decideSelectionOutcome,
  describeNothingFound,
  describeSelectionMade,
  parseSelectionReport
} from "../../src/ui/tools/selectByText";

// Verbatim PreviewAny text from ComfyUI 0.37, 2026-10-29, on the terrace photo.
const TWO_UMBRELLAS = `[
    [
        {
            "x": 673.5,
            "y": 216.75,
            "width": 77.0,
            "height": 299.75,
            "score": 0.888671875
        },
        {
            "x": 286.0,
            "y": 274.5,
            "width": 94.0,
            "height": 216.5,
            "score": 0.8837890625
        }
    ]
]`;
const NOTHING = `[
    []
]`;

describe("parseSelectionReport", () => {
  it("counts the objects SAM found", () => {
    expect(parseSelectionReport(TWO_UMBRELLAS)).toEqual({ objectCount: 2 });
  });

  it("reads an empty report as zero objects", () => {
    expect(parseSelectionReport(NOTHING)).toEqual({ objectCount: 0 });
  });

  it("returns null for text it cannot read, rather than guessing zero", () => {
    expect(parseSelectionReport(undefined)).toBeNull();
    expect(parseSelectionReport("")).toBeNull();
    expect(parseSelectionReport("not json")).toBeNull();
    expect(parseSelectionReport("{\"x\": 1}")).toBeNull();
    expect(parseSelectionReport("[1, 2]")).toBeNull();
  });
});

describe("decideSelectionOutcome", () => {
  it("selects when objects were found", () => {
    expect(decideSelectionOutcome({ objectCount: 2 }, "umbrella")).toEqual({
      kind: "select",
      message: "Selected 2 objects."
    });
  });

  it("never sends an empty mask to Photoshop", () => {
    const outcome = decideSelectionOutcome({ objectCount: 0 }, "person");

    expect(outcome.kind).toBe("nothing-found");
    expect(outcome.message).toContain("\"person\"");
  });

  it("still selects when the report could not be read", () => {
    expect(decideSelectionOutcome(null, "chair")).toEqual({ kind: "select", message: "Selection made." });
  });
});

describe("Select by Text wording", () => {
  it("uses the singular for one object", () => {
    expect(describeSelectionMade(1)).toBe("Selected 1 object.");
    expect(describeSelectionMade(3)).toBe("Selected 3 objects.");
  });

  it("is plain text, because the panel renders it with textContent", () => {
    for (const message of [describeSelectionMade(2), describeNothingFound("the red car")]) {
      expect(message).not.toMatch(/`|--|\*\*|Photoshop plugin/);
    }
  });
});
