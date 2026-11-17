// @vitest-environment jsdom

/**
 * The delegated action binding listened for click only. A native <button>
 * turns Enter and Space into a click, so every control reached only through
 * that binding worked by keyboard as long as it was a <button>; the div button
 * primitive does not, so it needs its own key path. These pin that path and
 * the two ways it must stay out of the way: native buttons (they already
 * click) and controls bound directly with bindActionControl (they already
 * handle the key).
 */
import { describe, expect, it, vi } from "vitest";
import { ActionHandlers, bindActionControl, bindDelegatedActions } from "../../src/ui/appBindings";

function setup(markup: string) {
  const root = document.createElement("div");
  root.innerHTML = markup;
  document.body.appendChild(root);
  const cancelGeneration = vi.fn();
  const handlers = { cancelGeneration } as unknown as ActionHandlers;
  bindDelegatedActions(root, handlers);
  return { root, cancelGeneration, handlers };
}

function press(element: Element, key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe("delegated Enter and Space", () => {
  it("runs a div action control on Enter and on Space, naming the key", () => {
    const { root, cancelGeneration } = setup(
      `<div class="button" role="button" tabindex="0" data-openlayer-action="cancelGeneration">Cancel</div>`
    );
    const control = root.querySelector("div")!;

    expect(press(control, "Enter").defaultPrevented).toBe(true);
    press(control, " ");

    expect(cancelGeneration.mock.calls).toEqual([["keyboard:Enter"], ["keyboard:space"]]);
  });

  it("ignores other keys", () => {
    const { root, cancelGeneration } = setup(
      `<div role="button" tabindex="0" data-openlayer-action="cancelGeneration">Cancel</div>`
    );

    press(root.querySelector("div")!, "a");
    press(root.querySelector("div")!, "Tab");

    expect(cancelGeneration).not.toHaveBeenCalled();
  });

  it("leaves a native button alone, because it already turns the key into a click", () => {
    const { root, cancelGeneration } = setup(
      `<button type="button" data-openlayer-action="cancelGeneration">Cancel</button>`
    );

    expect(press(root.querySelector("button")!, "Enter").defaultPrevented).toBe(false);
    expect(cancelGeneration).not.toHaveBeenCalled();
  });

  it("does nothing for a disabled div", () => {
    const { root, cancelGeneration } = setup(
      `<div class="is-disabled" role="button" tabindex="-1" aria-disabled="true" data-openlayer-action="cancelGeneration">Cancel</div>`
    );

    press(root.querySelector("div")!, "Enter");

    expect(cancelGeneration).not.toHaveBeenCalled();
  });

  it("does not run twice for a control also bound with bindActionControl", () => {
    const { root, handlers } = setup(
      `<div role="button" tabindex="0" data-openlayer-action="cancelGeneration">Cancel</div>`
    );
    const control = root.querySelector<HTMLElement>("div")!;
    bindActionControl(control, handlers.cancelGeneration);

    press(control, "Enter");

    expect(handlers.cancelGeneration).toHaveBeenCalledTimes(1);
  });

  it("does not fire from a field inside an action element", () => {
    const { root, cancelGeneration } = setup(
      `<div data-openlayer-action="cancelGeneration"><input type="text" /></div>`
    );

    press(root.querySelector("input")!, "Enter");

    expect(cancelGeneration).not.toHaveBeenCalled();
  });
});
