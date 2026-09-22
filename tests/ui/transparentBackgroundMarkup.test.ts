// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";
import { listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";

function mount() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  return root;
}

describe("Text to Image transparent background toggle", () => {
  it("lives on the Text to Image screen and starts hidden", () => {
    const root = mount();
    const elements = getAppElements(root);

    // Hidden until renderApp sees a preset with transparentOutput selected. If
    // that sync ever fails to run, the safe failure is no toggle at all rather
    // than a toggle that silently does nothing on the default preset.
    expect(elements.transparentBackgroundField.hidden).toBe(true);
    expect(elements.transparentBackgroundField.contains(elements.transparentBackgroundToggle)).toBe(true);
    expect(root.querySelector("#generator-view #transparent-background-toggle")).toBeTruthy();
    expect(elements.transparentBackgroundToggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("is offered by at least one Text to Image preset, and not by the default", () => {
    const presets = listRunnableWorkflowPresets("txt2img");

    expect(presets.some((preset) => preset.transparentOutput)).toBe(true);
    expect(presets[0].transparentOutput).toBeUndefined();
  });
});
