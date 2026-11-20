/**
 * Everything a native <button> did for free, for the div button that replaces
 * it on Photoshop 28.
 *
 * Why divs at all: UXP 9.4.1 (Photoshop 28) paints its own grey face over every
 * native <button>, whatever the stylesheet says, and the stylesheet's rounded
 * border then draws on top of it as a doubled outline (docs/ui-audit-ps28.md,
 * R1). A <div role="button"> draws only what the stylesheet says. The markup
 * side is buttonMarkup.ts; this file is the behaviour side, and it stays free
 * of imports so the main panel, the Preview panel and the Prompt Wallet can all
 * use it.
 *
 * What the native tag gave, and where each piece now comes from:
 * - Focus by Tab: role="button" and tabindex (createDivButton, buttonMarkup).
 * - Disabled: is-disabled + aria-disabled + tabindex="-1" (setActionDisabled).
 *   A div has no `.disabled`; writing it is a silent no-op, so never do.
 * - Enter and Space: installDivButtonBehaviour turns them into a click for any
 *   focused div button that no earlier handler took (bindActionControl, the
 *   delegated path in bindDelegatedActions and activateOnEnterAndSpace all
 *   call preventDefault first, so nothing runs twice).
 * - Not leaking clicks to a <label>: a click on a native button inside a label
 *   stays on the button, because a button is interactive content; a click on a
 *   div is passed by the label to the field it labels. Measured on Photoshop
 *   28: Enter on the div Roll rolled the seed, then focus jumped into the seed
 *   input and the next Space typed into it. Cancelling the click's default
 *   stops that; the label acts only after the event has finished dispatching,
 *   so cancelling it at the root is in time.
 */

const DIV_BUTTON_SELECTOR = '[role="button"]';

export function isActionDisabled(element: HTMLElement) {
  return element.classList.contains("is-disabled") || element.getAttribute("aria-disabled") === "true";
}

export function setActionDisabled(element: HTMLElement, isDisabled: boolean) {
  element.classList.toggle("is-disabled", isDisabled);
  element.setAttribute("aria-disabled", String(isDisabled));
  element.setAttribute("tabindex", isDisabled ? "-1" : "0");
}

/**
 * A div button made in code, in place of document.createElement("button").
 * Same class string the native button had; the caller sets the label and
 * listeners as before.
 */
export function createDivButton(doc: Document, className: string) {
  const element = doc.createElement("div");
  element.className = className;
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-disabled", "false");
  return element;
}

function closestDivButton(target: EventTarget | null): HTMLElement | null {
  const element = target as HTMLElement | null;

  if (!element || typeof element.closest !== "function") {
    return null;
  }

  const control = element.closest<HTMLElement>(DIV_BUTTON_SELECTOR);
  return control && control.tagName !== "BUTTON" ? control : null;
}

const installedRoots = new WeakSet<EventTarget>();

/**
 * The catch-all, installed once per root (the document, and each panel root
 * in case a panel's events do not reach it). Bubble phase on purpose: every
 * specific handler has already run and can claim the event with
 * preventDefault.
 */
export function installDivButtonBehaviour(root: Document | HTMLElement) {
  if (installedRoots.has(root)) {
    return;
  }

  installedRoots.add(root);

  // A disabled native button never dispatched click at all; a div does. Every
  // listener in the panel ignores a disabled control anyway, but a few code-made
  // ones (Setup's Download, the Preview panel's import) relied on the native
  // `disabled` instead of checking, so the guard lives here once: capture
  // phase, first in line when installed before the panel's own bindings.
  root.addEventListener(
    "click",
    (event) => {
      const control = closestDivButton(event.target);

      if (control && isActionDisabled(control)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  root.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if ((key !== "Enter" && key !== " ") || event.defaultPrevented) {
      return;
    }

    const control = closestDivButton(event.target);

    // Only when the control itself has focus, never a field inside one.
    if (!control || control !== event.target) {
      return;
    }

    event.preventDefault();

    if (!isActionDisabled(control)) {
      control.click();
    }
  });

  root.addEventListener("click", (event) => {
    if (closestDivButton(event.target)) {
      event.preventDefault();
    }
  });
}

/**
 * The same two behaviours bound on one element. Kept for the controls swapped
 * before the catch-all existed (Roll, the Prompt Wallet dots); with the
 * catch-all installed it is belt and braces, and it is what the unit tests of
 * those controls exercise.
 */
export function activateOnEnterAndSpace(element: HTMLElement) {
  element.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if ((key !== "Enter" && key !== " ") || event.defaultPrevented || event.target !== element) {
      return;
    }

    event.preventDefault();

    if (!isActionDisabled(element)) {
      element.click();
    }
  });

  element.addEventListener("click", (event) => {
    event.preventDefault();
  });
}
