/**
 * What a native <button> did for free, for a div button that is wired with its
 * own click listener.
 *
 * 1. Enter and Space. A native <button> turns them into a click. The div button
 *    primitive (buttonMarkup.ts) does not, and the two existing key paths cover
 *    only controls with a data-openlayer-action: bindActionControl and the
 *    delegated path in bindDelegatedActions (appBindings.ts). Controls that
 *    listen for click themselves, such as the seed Roll button and the Prompt
 *    Wallet dots, get neither. The key becomes a click, so the click listener
 *    stays the one place the action runs and keeps its own disabled check.
 *    Only when the control itself has focus, never from a field inside it, and
 *    never when it carries is-disabled.
 *
 * 2. Staying out of a <label>'s way. Roll and the dots sit inside a
 *    `<label class="field">`. A click on a native button inside a label stays
 *    on the button, because a button is interactive content. A click on a div
 *    is passed on by the label to the field it labels. Measured on Photoshop
 *    28: Enter on the div Roll rolled the seed, then focus jumped into the seed
 *    input, so the next Space typed into it. Cancelling the click's default
 *    stops the label's forwarding; the click listeners still run, since they
 *    do not check defaultPrevented.
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

  element.addEventListener("click", (event) => {
    event.preventDefault();
  });
}
