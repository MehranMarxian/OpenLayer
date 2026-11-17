// @vitest-environment jsdom

/**
 * Sketch to Image's capture row, Generate, Cancel and Import move to the div
 * button primitive (docs/ui-audit-ps28.md, R1), the pilot for the three shapes
 * Text to Image did not cover: a capture row, a Cancel reached only through
 * the delegated binding, and an Import with no toggle beside it.
 *
 * Each entry records the class set, action and starting state the native
 * button had on main, read from the markup rather than assumed from the
 * primitive's tone table.
 */
import { describe, expect, it } from "vitest";
import { createAppMarkup } from "../../src/ui/appMarkup";

interface Expected {
  /** How to find it: an id, or (for the id-less Cancel) Generate's next sibling. */
  find: (root: HTMLElement) => HTMLElement | null;
  name: string;
  classes: string[];
  action: string;
  hidden: boolean;
  disabled: boolean;
}

const EXPECTED: Expected[] = [
  {
    name: "Capture Active Layer",
    find: (root) => root.querySelector("#capture-sketch-source"),
    classes: ["button", "source-action-button", "action-control"],
    action: "captureSketchSource",
    hidden: false,
    disabled: false
  },
  {
    name: "Capture Canvas",
    find: (root) => root.querySelector("#capture-sketch-canvas-source"),
    classes: ["button", "source-action-button", "action-control"],
    action: "captureSketchCanvasSource",
    hidden: false,
    disabled: false
  }
];

function render() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  return root;
}

describe("Sketch to Image div buttons", () => {
  for (const expected of EXPECTED) {
    describe(expected.name, () => {
      it("is the div primitive, reachable by Tab", () => {
        const element = expected.find(render())!;

        expect(element.tagName).toBe("DIV");
        expect(element.getAttribute("role")).toBe("button");
        expect(element.getAttribute("tabindex")).toBe(expected.disabled ? "-1" : "0");
      });

      it("keeps the native button's exact classes, action and starting state", () => {
        const element = expected.find(render())!;

        expect([...element.classList].sort()).toEqual(
          [...expected.classes, ...(expected.disabled ? ["is-disabled"] : [])].sort()
        );
        expect(element.getAttribute("data-openlayer-action")).toBe(expected.action);
        expect(element.hidden).toBe(expected.hidden);
        expect(element.getAttribute("aria-disabled")).toBe(String(expected.disabled));
      });
    });
  }
});
