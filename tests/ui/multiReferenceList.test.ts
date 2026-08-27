import { describe, expect, it } from "vitest";
import {
  canAddReference,
  describeReferenceCount,
  moveReference,
  removeReference
} from "../../src/ui/multiReferenceList";

const list = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("multi-reference list", () => {
  it("moves an entry one place and reports where it landed", () => {
    const down = moveReference(list, "a", 1);

    expect(down.references.map((entry) => entry.id)).toEqual(["b", "a", "c"]);
    expect(down.movedTo).toBe(1);

    const up = moveReference(list, "c", -1);

    expect(up.references.map((entry) => entry.id)).toEqual(["a", "c", "b"]);
    expect(up.movedTo).toBe(1);
  });

  it("clamps at both ends instead of wrapping", () => {
    // Wrapping would send a repeatedly pressed top item to the bottom, which
    // reads as the list losing it.
    const offTop = moveReference(list, "a", -1);
    const offBottom = moveReference(list, "c", 1);

    expect(offTop.references.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(offTop.movedTo).toBeNull();
    expect(offBottom.references.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(offBottom.movedTo).toBeNull();
  });

  it("promotes the second entry when the first is removed", () => {
    // Reference 1 sets the output canvas, so this is a size change, not just a
    // shorter list.
    const { references, removed } = removeReference(list, "a");

    expect(removed?.id).toBe("a");
    expect(references.map((entry) => entry.id)).toEqual(["b", "c"]);
  });

  it("leaves the list alone for an id it does not hold", () => {
    const move = moveReference(list, "missing", 1);
    const remove = removeReference(list, "missing");

    expect(move.references.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(move.movedTo).toBeNull();
    expect(remove.removed).toBeNull();
    expect(remove.references.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("never mutates the array it was given", () => {
    const original = [...list];

    moveReference(list, "a", 1);
    removeReference(list, "a");

    expect(list).toEqual(original);
  });

  it("reports the count against the ceiling", () => {
    expect(describeReferenceCount([], 8)).toBe("None captured");
    expect(describeReferenceCount(list, 8)).toBe("3 of 8");
    expect(canAddReference(list, 8)).toBe(true);
    expect(canAddReference(list, 3)).toBe(false);
  });
});
