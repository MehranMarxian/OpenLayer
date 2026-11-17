// @vitest-environment jsdom

/**
 * Text to Image's Generate path moves from native <button> to the div button
 * primitive (src/ui/buttonMarkup.ts), because Photoshop 28 paints its own grey
 * face over every native button (docs/ui-audit-ps28.md, R1).
 *
 * The swap must change the tag and nothing the stylesheet or the scripts key
 * on: the exact class set, the id, the action, whether it starts hidden, and
 * whether it starts disabled. Each entry below records what the native button
 * carried on main, so a later edit to the primitive's tone classes cannot
 * quietly restyle one of these (the "import" tone, for one, adds
 * button-import-blue, which Text to Image's Import never had).
 */
import { describe, expect, it } from "vitest";
import { createAppMarkup } from "../../src/ui/appMarkup";

interface Expected {
  id: string;
  classes: string[];
  action: string;
  hidden: boolean;
  disabled: boolean;
}

const EXPECTED: Expected[] = [
  {
    id: "generate",
    classes: ["button", "button-primary", "button-generate", "button-wide", "action-control"],
    action: "generate",
    hidden: false,
    disabled: false
  },
  {
    id: "cancel-generation",
    classes: ["button", "button-wide", "action-control", "cancel-generation-button"],
    action: "cancelGeneration",
    hidden: true,
    disabled: false
  }
];

function render() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  return root;
}

describe("Text to Image div buttons", () => {
  for (const expected of EXPECTED) {
    describe(`#${expected.id}`, () => {
      it("is the div primitive, reachable by Tab", () => {
        const element = render().querySelector<HTMLElement>(`#${expected.id}`)!;

        expect(element.tagName).toBe("DIV");
        expect(element.getAttribute("role")).toBe("button");
        expect(element.getAttribute("tabindex")).toBe(expected.disabled ? "-1" : "0");
      });

      it("keeps the native button's exact classes, action and starting state", () => {
        const element = render().querySelector<HTMLElement>(`#${expected.id}`)!;

        expect([...element.classList].sort()).toEqual([...expected.classes, ...(expected.disabled ? ["is-disabled"] : [])].sort());
        expect(element.getAttribute("data-openlayer-action")).toBe(expected.action);
        expect(element.hidden).toBe(expected.hidden);
        expect(element.getAttribute("aria-disabled")).toBe(String(expected.disabled));
      });
    });
  }
});
