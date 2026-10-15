/**
 * A dropdown the mouse wheel cannot change.
 *
 * In Photoshop's UXP panels, one wheel notch over a closed native `<select>`
 * changes its value, focused or not, so an artist scrolling past the Model
 * dropdown could switch models without noticing (measured in Photoshop 2025:
 * flux-2-klein-4b-fp8 became flux1-dev-fp8). Three fixes that kept the native
 * control were tried in Photoshop and all failed: preventDefault on the wheel is
 * ignored, the host never reports the wheel over a select to the panel, and a
 * pick from the native list delivers no press the panel can see. So the native
 * control is taken out of the pointer's way instead.
 *
 * The `<select>` stays in the document as the source of truth: everything that
 * fills it, reads it or listens to its `change` event keeps working unchanged.
 * It is hidden, and a plain field-styled element shows its current value. Click
 * (or Enter, Space or Alt+Down) opens a list of its options inline below the
 * field; choosing one sets the select and fires the same `change` event the
 * native control would. Neither element has any wheel behaviour, so scrolling
 * the panel past it changes nothing.
 *
 * The label follows the select however its value changes: a refill of its
 * options (watched with a MutationObserver), a `change` event, or the
 * `ol-picker-sync` event that code setting `.value` directly dispatches. In
 * Photoshop the observer did not fire when the panel refilled the model list
 * at startup (the field loaded blank until the pointer arrived), so a cheap
 * check every half second backs them all up and only touches the DOM when the
 * shown value is out of date.
 *
 * Used on every tool's Workflow and Model dropdown (App.ts). The LoRA, theme and
 * Prompt from Layer task dropdowns are still native and still wheel-prone.
 */

export const PICKER_SYNC_EVENT = "ol-picker-sync";

export type WheelProofPicker = {
  field: HTMLElement;
  list: HTMLElement;
  sync: () => void;
  open: () => void;
  close: () => void;
};

export const PICKER_POLL_MS = 500;

export function enhanceSelectAsPicker(
  select: HTMLSelectElement,
  options: { pollMs?: number } = {}
): WheelProofPicker {
  const doc = select.ownerDocument;
  const wrapper = doc.createElement("div");
  wrapper.className = "ol-picker";

  const field = doc.createElement("div");
  // "select" keeps the field identical to every other dropdown in both themes.
  field.className = "select ol-picker-field";
  field.setAttribute("role", "button");
  field.setAttribute("tabindex", "0");
  field.setAttribute("aria-haspopup", "listbox");
  field.setAttribute("aria-expanded", "false");

  const label = doc.createElement("span");
  label.className = "ol-picker-label";
  // A PNG, drawn to match the native dropdown's own chevron. Neither of the
  // cheaper routes works in UXP: a chevron glyph may have no font and render
  // blank, and a CSS border triangle drew as a flat bar (transparent side
  // borders are not honoured).
  const caret = doc.createElement("img");
  caret.className = "ol-picker-caret";
  caret.setAttribute("src", "icons/picker-chevron.png");
  caret.setAttribute("alt", "");
  caret.setAttribute("aria-hidden", "true");
  field.appendChild(label);
  field.appendChild(caret);

  const list = doc.createElement("div");
  list.className = "ol-picker-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;

  wrapper.appendChild(field);
  wrapper.appendChild(list);
  select.parentNode?.insertBefore(wrapper, select.nextSibling);

  // Out of the pointer's way, but still in the document and still the source
  // of truth. A class, not an inline style: the compact theme forces
  // `.select { display: block !important }`, which an inline style cannot beat.
  select.classList.remove("select");
  select.classList.add("ol-picker-native");
  select.setAttribute("aria-hidden", "true");
  select.tabIndex = -1;

  const isOpen = () => !list.hidden;

  // The option the panel will actually use. In UXP a select whose value was
  // never set reports an empty value and selectedIndex -1, while the native
  // control still displays its first option and readSelectValue in App.ts falls
  // back to that same first option. Showing anything else (the field loaded
  // blank on Remove Background, Layer Maps and Unflatten) would misstate it.
  const effectiveOption = (): HTMLOptionElement | undefined =>
    select.options[select.selectedIndex] ??
    Array.from(select.options).find((option) => option.value === select.value && select.value !== "") ??
    select.options[0];

  const currentText = () => {
    const option = effectiveOption();
    return option ? (option.textContent ?? option.value).trim() : select.value;
  };

  const renderList = () => {
    while (list.firstChild) list.removeChild(list.firstChild);

    for (const option of Array.from(select.options)) {
      const item = doc.createElement("div");
      item.className = "ol-picker-item";
      item.setAttribute("role", "option");
      item.setAttribute("data-value", option.value);
      item.textContent = option.textContent ?? option.value;
      const selected = option === effectiveOption();
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-selected", String(selected));
      list.appendChild(item);
    }
  };

  const sync = () => {
    label.textContent = currentText();
    field.title = currentText();
    field.classList.toggle("is-disabled", select.disabled);
    field.setAttribute("aria-disabled", String(select.disabled));

    if (select.disabled && isOpen()) close();
    if (isOpen()) renderList();
  };

  const open = () => {
    if (select.disabled) return;
    renderList();
    list.hidden = false;
    field.setAttribute("aria-expanded", "true");
    list.querySelector<HTMLElement>(".is-selected")?.scrollIntoView?.({ block: "nearest" });
  };

  function close() {
    list.hidden = true;
    field.setAttribute("aria-expanded", "false");
  }

  const choose = (value: string) => {
    close();

    if (value === select.value) return;

    select.value = value;
    sync();
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  field.addEventListener("click", () => (isOpen() ? close() : open()));
  field.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " " || (key === "ArrowDown" && (event as KeyboardEvent).altKey)) {
      event.preventDefault();
      if (isOpen()) close();
      else open();
    } else if (key === "Escape") {
      close();
    }
  });

  list.addEventListener("click", (event) => {
    const item = (event.target as Element | null)?.closest?.(".ol-picker-item");
    const value = item?.getAttribute("data-value");
    if (value !== null && value !== undefined) choose(value);
  });

  // Clicking anywhere else closes the list, as a native dropdown would.
  doc.addEventListener("mousedown", (event) => {
    if (isOpen() && !wrapper.contains(event.target as Node)) close();
  }, true);

  select.addEventListener("change", sync);
  select.addEventListener(PICKER_SYNC_EVENT, sync);
  field.addEventListener("mouseenter", sync);

  if (typeof MutationObserver === "function") {
    new MutationObserver(sync).observe(select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"]
    });
  }

  sync();

  const pollMs = options.pollMs ?? PICKER_POLL_MS;

  if (pollMs > 0) {
    setInterval(() => {
      const stale =
        label.textContent !== currentText() || field.classList.contains("is-disabled") !== select.disabled;
      if (stale) sync();
    }, pollMs);
  }

  return { field, list, sync, open, close };
}
