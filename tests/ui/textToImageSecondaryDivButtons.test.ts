// @vitest-environment jsdom

/**
 * Text to Image's remaining native buttons move to divs, because on Photoshop
 * 28 the host paints its own grey face over a native <button> and the
 * stylesheet's rounded border draws on top of it (docs/ui-audit-ps28.md, R1):
 * Ask the Agent, Show Negative Prompt and Transparent Background drew doubled
 * corners, Roll the same, and the Prompt Wallet dots drew grey with only a
 * coloured ring.
 *
 * Classes are read from the native markup on main, so the stylesheet sees the
 * same element apart from its tag. Roll and the dots have their own click
 * listeners and no data-openlayer-action, so neither existing key path covers
 * them; activateOnEnterAndSpace does, and is pinned here.
 */
import { describe, expect, it, vi } from "vitest";
import { createAppMarkup } from "../../src/ui/appMarkup";
import { activateOnEnterAndSpace } from "../../src/ui/keyActivation";
import { setSeedDiceEnabled } from "../../src/ui/seedDice";

function render() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  return root;
}

function press(element: Element, key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

const TEXT_TO_IMAGE_CONTROLS = [
  { id: "suggest-prompt", classes: ["button", "action-control"], action: "suggestPrompt" },
  { id: "negative-prompt-toggle", classes: ["button", "disclosure-button", "action-control"], action: "toggleNegativePrompt" },
  {
    id: "transparent-background-toggle",
    classes: ["button", "experimental-toggle", "action-control"],
    action: "toggleTransparentBackground"
  }
];

describe("Text to Image secondary div buttons", () => {
  for (const control of TEXT_TO_IMAGE_CONTROLS) {
    it(`${control.id} is a div with the native button's exact classes and action`, () => {
      const element = render().querySelector<HTMLElement>(`#${control.id}`)!;

      expect(element.tagName).toBe("DIV");
      expect(element.getAttribute("role")).toBe("button");
      expect(element.getAttribute("tabindex")).toBe("0");
      expect([...element.classList].sort()).toEqual([...control.classes].sort());
      expect(element.getAttribute("data-openlayer-action")).toBe(control.action);
    });
  }

  it("keeps aria-pressed on Transparent Background at first paint, with no data-state", () => {
    const toggle = render().querySelector<HTMLElement>("#transparent-background-toggle")!;

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.hasAttribute("data-state")).toBe(false);
  });

  it("draws every Prompt Wallet dot as a focusable div with its colour class", () => {
    const dots = [...render().querySelectorAll<HTMLElement>(".prompt-wallet-dot")];

    expect(dots.length).toBeGreaterThan(0);
    expect(dots.length % 3).toBe(0);

    for (const dot of dots) {
      expect(dot.tagName).toBe("DIV");
      expect(dot.getAttribute("role")).toBe("button");
      expect(dot.getAttribute("tabindex")).toBe("0");
      expect(dot.getAttribute("aria-label")).toBeTruthy();
      expect(
        ["prompt-wallet-save", "prompt-wallet-load", "prompt-wallet-enhance"].some((name) => dot.classList.contains(name))
      ).toBe(true);
    }
  });

  it("no native <button> is left in Text to Image's prompt section", () => {
    const section = render().querySelector("#generator-view .generator-panel")!;

    expect(section.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("Roll", () => {
  function buildRoot() {
    const root = document.createElement("div");
    root.innerHTML = `<label class="field settings-seed"><span class="label">Seed</span><input id="seed" type="text" /></label>`;
    document.body.replaceChildren(root);
    setSeedDiceEnabled(root, true);
    return root;
  }

  it("is a focusable div, not a native button", () => {
    const roll = buildRoot().querySelector<HTMLElement>(".seed-dice-button")!;

    expect(roll.tagName).toBe("DIV");
    expect(roll.getAttribute("role")).toBe("button");
    expect(roll.getAttribute("tabindex")).toBe("0");
  });

  it("rolls a new seed on Enter and on Space", () => {
    const root = buildRoot();
    const roll = root.querySelector<HTMLElement>(".seed-dice-button")!;
    const input = root.querySelector<HTMLInputElement>("#seed")!;

    press(roll, "Enter");
    const first = input.value;
    press(roll, " ");

    expect(first).toMatch(/^\d+$/);
    expect(input.value).toMatch(/^\d+$/);
  });
});

describe("activateOnEnterAndSpace", () => {
  function setup(className = "") {
    const element = document.createElement("div");
    element.className = className;
    element.innerHTML = `<input type="text" />`;
    document.body.replaceChildren(element);
    const onClick = vi.fn();
    element.addEventListener("click", onClick);
    activateOnEnterAndSpace(element);
    return { element, onClick };
  }

  it("turns Enter and Space into one click each, and stops the key's default", () => {
    const { element, onClick } = setup();

    expect(press(element, "Enter").defaultPrevented).toBe(true);
    expect(press(element, " ").defaultPrevented).toBe(true);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("cancels the click's default, so an enclosing <label> does not pass focus to its field", () => {
    const label = document.createElement("label");
    label.innerHTML = `<input id="field" type="text" /><div role="button" tabindex="0">Roll</div>`;
    document.body.replaceChildren(label);
    const control = label.querySelector<HTMLElement>("div")!;
    const onClick = vi.fn();
    control.addEventListener("click", onClick);
    activateOnEnterAndSpace(control);

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    control.dispatchEvent(event);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(label.querySelector("input"));
  });

  it("ignores other keys, a field inside the control, and a disabled control", () => {
    const { element, onClick } = setup();

    press(element, "a");
    press(element.querySelector("input")!, "Enter");
    element.classList.add("is-disabled");
    press(element, "Enter");

    expect(onClick).not.toHaveBeenCalled();
  });
});
