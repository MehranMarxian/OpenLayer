// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { enhanceSelectAsPicker, PICKER_POLL_MS, PICKER_SYNC_EVENT } from "../../src/ui/wheelProofPicker";

// jsdom cannot show the bug (UXP's wheel changing a native select); Photoshop
// is the proof of that. These pin the picker's own contract: it mirrors the
// hidden select exactly, and the only way its value changes is a choice.
function setup(values = ["klein", "flux1-dev", "qwen"], selected = "klein", pollMs = 0) {
  const field = document.createElement("div");
  field.innerHTML = `<select class="select" id="model">${values.map((v) => `<option value="${v}">${v}</option>`).join("")}</select>`;
  document.body.appendChild(field);
  const select = field.querySelector<HTMLSelectElement>("#model")!;
  select.value = selected;
  const onChange = vi.fn();
  select.addEventListener("change", onChange);
  const picker = enhanceSelectAsPicker(select, { pollMs });
  const label = () => picker.field.querySelector(".ol-picker-label")!.textContent;
  const items = () => Array.from(picker.list.querySelectorAll<HTMLElement>(".ol-picker-item"));
  return { select, picker, onChange, label, items };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("enhanceSelectAsPicker", () => {
  it("hides the native select by class and shows its value in a field", () => {
    const { select, picker, label } = setup();

    expect(select.classList.contains("ol-picker-native")).toBe(true);
    expect(select.classList.contains("select")).toBe(false);
    expect(picker.field.classList.contains("select")).toBe(true);
    expect(label()).toBe("klein");
    expect(picker.list.hidden).toBe(true);
  });

  it("opens a list of the select's options on click, marking the current one", () => {
    const { picker, items } = setup();

    picker.field.click();

    expect(picker.list.hidden).toBe(false);
    expect(items().map((item) => item.textContent)).toEqual(["klein", "flux1-dev", "qwen"]);
    expect(items().filter((item) => item.classList.contains("is-selected")).map((item) => item.textContent)).toEqual([
      "klein"
    ]);
  });

  it("sets the select and fires one change event when an item is chosen", () => {
    const { select, picker, onChange, label, items } = setup();

    picker.field.click();
    items()[2].click();

    expect(select.value).toBe("qwen");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(label()).toBe("qwen");
    expect(picker.list.hidden).toBe(true);
  });

  it("fires nothing when the current item is chosen again", () => {
    const { picker, onChange, items } = setup();

    picker.field.click();
    items()[0].click();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("follows a refill of the options, which is how the panel loads the live model list", async () => {
    const { select, label } = setup();

    select.innerHTML = `<option value="z-image">z-image</option><option value="krea2">krea2</option>`;
    select.value = "krea2";
    await flush();

    expect(label()).toBe("krea2");
  });

  it("follows a value set in code once the setter announces it", () => {
    const { select, label } = setup();

    select.value = "flux1-dev";
    select.dispatchEvent(new Event(PICKER_SYNC_EVENT));

    expect(label()).toBe("flux1-dev");
  });

  it("will not open while the select is disabled, as it is during a generation", async () => {
    const { select, picker } = setup();

    select.disabled = true;
    await flush();
    picker.field.click();

    expect(picker.list.hidden).toBe(true);
    expect(picker.field.classList.contains("is-disabled")).toBe(true);
  });

  it("gives the wheel nothing to change", () => {
    const { select, picker, onChange } = setup();

    picker.field.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));

    expect(select.value).toBe("klein");
    expect(onChange).not.toHaveBeenCalled();
    expect(picker.list.hidden).toBe(true);
  });

  it("opens from the keyboard and closes on Escape or a click elsewhere", () => {
    const { picker } = setup();

    picker.field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(picker.list.hidden).toBe(false);
    picker.field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(picker.list.hidden).toBe(true);

    picker.field.click();
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(picker.list.hidden).toBe(true);
  });

  it("catches up within half a second when nothing announced the change (as in Photoshop at startup)", () => {
    vi.useFakeTimers();
    try {
      const { select, label } = setup(["klein", "flux1-dev"], "klein", PICKER_POLL_MS);

      // A value set in code with no event, and no observer firing.
      select.value = "flux1-dev";
      expect(label()).toBe("klein");

      vi.advanceTimersByTime(PICKER_POLL_MS);
      expect(label()).toBe("flux1-dev");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the first option when nothing is selected, as the panel's readSelectValue assumes", () => {
    const { select, picker, label, items } = setup();

    // What UXP reports for a select whose value was never set.
    Object.defineProperty(select, "selectedIndex", { value: -1, configurable: true });
    Object.defineProperty(select, "value", { value: "", configurable: true, writable: true });
    picker.sync();
    picker.open();

    expect(label()).toBe("klein");
    expect(items()[0].classList.contains("is-selected")).toBe(true);
  });
});
