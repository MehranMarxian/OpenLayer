// @vitest-environment jsdom

/**
 * installDivButtonBehaviour gives every div button what a native <button> did
 * for free, from one listener per root instead of wiring each of ~120
 * controls. These pin each behaviour, and that the existing key paths still
 * run exactly once with the catch-all in place.
 */
import { describe, expect, it, vi } from "vitest";
import { ActionHandlers, bindActionControl, bindDelegatedActions } from "../../src/ui/appBindings";
import { activateOnEnterAndSpace, createDivButton, installDivButtonBehaviour, setActionDisabled } from "../../src/ui/divButton";

function freshRoot(markup = "") {
  // A new root per test, installed on the document only, as the main panel
  // does (App.ts): the root's own handlers then run first.
  const root = document.createElement("section");
  root.innerHTML = markup;
  document.body.replaceChildren(root);
  installDivButtonBehaviour(document);
  return root;
}

function press(element: Element, key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

function click(element: Element) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe("installDivButtonBehaviour", () => {
  it("turns Enter and Space on a plain div button into one click each", () => {
    const root = freshRoot();
    const control = createDivButton(document, "button");
    root.appendChild(control);
    const onClick = vi.fn();
    control.addEventListener("click", onClick);

    press(control, "Enter");
    press(control, " ");
    press(control, "a");

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("swallows a click on a disabled div button before any listener, as a disabled native button did", () => {
    const root = freshRoot();
    const control = createDivButton(document, "button");
    root.appendChild(control);
    const onClick = vi.fn();
    control.addEventListener("click", onClick);

    setActionDisabled(control, true);
    click(control);
    press(control, "Enter");
    setActionDisabled(control, false);
    click(control);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("cancels the click's default at the root, so an enclosing label does not act", () => {
    const root = freshRoot(`<label><input id="f" /><span class="slot"></span></label>`);
    const control = createDivButton(document, "seed-dice-button");
    root.querySelector(".slot")!.appendChild(control);

    expect(click(control).defaultPrevented).toBe(true);
  });

  it("leaves clicks on other elements alone", () => {
    const root = freshRoot(`<div class="card">x</div>`);

    expect(click(root.querySelector(".card")!).defaultPrevented).toBe(false);
  });

  it("does not double-run a control bound with bindActionControl", () => {
    const root = freshRoot();
    const control = createDivButton(document, "button");
    root.appendChild(control);
    const run = vi.fn();
    bindActionControl(control, run);

    press(control, "Enter");

    expect(run.mock.calls).toEqual([["keyboard:Enter"]]);
  });

  it("does not double-run a delegated action control", () => {
    const root = freshRoot(`<div class="button" role="button" tabindex="0" data-openlayer-action="cancelGeneration">Cancel</div>`);
    const cancelGeneration = vi.fn();
    bindDelegatedActions(root, { cancelGeneration } as unknown as ActionHandlers);

    press(root.querySelector("[role=button]")!, " ");

    expect(cancelGeneration.mock.calls).toEqual([["keyboard:space"]]);
  });

  it("does not double-run a control that also uses activateOnEnterAndSpace", () => {
    const root = freshRoot();
    const control = createDivButton(document, "prompt-wallet-dot");
    root.appendChild(control);
    const onClick = vi.fn();
    control.addEventListener("click", onClick);
    activateOnEnterAndSpace(control);

    press(control, "Enter");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores keys from a field inside a div button", () => {
    const root = freshRoot(`<div role="button" tabindex="0" class="button"><input /></div>`);
    const onClick = vi.fn();
    root.querySelector("[role=button]")!.addEventListener("click", onClick);

    press(root.querySelector("input")!, "Enter");

    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("createDivButton", () => {
  it("is a focusable div announced as a button, with the given class", () => {
    const control = createDivButton(document, "button setup-row-action");

    expect(control.tagName).toBe("DIV");
    expect(control.getAttribute("role")).toBe("button");
    expect(control.getAttribute("tabindex")).toBe("0");
    expect(control.className).toBe("button setup-row-action");
  });
});
