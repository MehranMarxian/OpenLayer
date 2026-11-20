/**
 * Enter and Space for a div button that is wired with its own click listener.
 *
 * A native <button> turns Enter and Space into a click. The div button
 * primitive (buttonMarkup.ts) does not, and two existing key paths cover only
 * controls with a data-openlayer-action: bindActionControl and the delegated
 * path in bindDelegatedActions (appBindings.ts). Controls that listen for
 * click themselves, such as the seed Roll button and the Prompt Wallet dots,
 * get neither, so they would become mouse-only when they stop being a
 * <button>. This gives them the native behaviour back by turning the key into
 * a click, so the click listener stays the one place the action runs and its
 * own disabled check still applies.
 *
 * Only when the control itself has focus, never from a field inside it, and
 * never when it carries is-disabled.
 */
export function activateOnEnterAndSpace(element: HTMLElement) {
  element.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if ((key !== "Enter" && key !== " ") || event.defaultPrevented || event.target !== element) {
      return;
    }

    event.preventDefault();

    if (!element.classList.contains("is-disabled")) {
      element.click();
    }
  });
}
