// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isInstructionEditPreset,
  listImageScreenPresets,
  listRunnableWorkflowPresets
} from "../../src/comfy/presetRegistry";
import { DEFAULT_EDIT_WORKFLOW, DEFAULT_IMAGE_WORKFLOW, HOME_TOOL_SECTIONS, TOOL_CARDS } from "../../src/ui/appConstants";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";

describe("Edit Image mode (v0.36)", () => {
  it("splits every image-to-image preset into exactly one mode", () => {
    const transform = listImageScreenPresets("transform").map((preset) => preset.id);
    const edit = listImageScreenPresets("edit").map((preset) => preset.id);
    const all = listRunnableWorkflowPresets("img2img").map((preset) => preset.id);

    expect(edit).toEqual(["edit-flux2-klein", "edit-qwen-image-21"]);
    expect([...transform, ...edit].sort()).toEqual([...all].sort());
    expect(transform.some((id) => edit.includes(id))).toBe(false);
  });

  it("decides the mode from the declared denoise control, so Image to Image's slider always matters", () => {
    for (const preset of listImageScreenPresets("transform")) {
      expect(preset.capability?.controls, preset.id).toContain("denoise");
    }

    for (const preset of listImageScreenPresets("edit")) {
      expect(isInstructionEditPreset(preset)).toBe(true);
      expect(preset.capability?.uiHints.screenHint, `${preset.id} has no screen hint`).toBeTruthy();
    }
  });

  it("defaults each mode to a preset it actually lists, and Edit to the Apache-licensed one", () => {
    expect(listImageScreenPresets("transform").map((preset) => preset.id)).toContain(DEFAULT_IMAGE_WORKFLOW);
    expect(listImageScreenPresets("edit").map((preset) => preset.id)).toContain(DEFAULT_EDIT_WORKFLOW);
    expect(DEFAULT_EDIT_WORKFLOW).toBe("edit-flux2-klein");
  });

  it("puts an Edit Image card on Home, next to Image to Image, with an icon that exists", () => {
    const card = TOOL_CARDS.find((entry) => entry.id === "edit-image");

    expect(card?.view).toBe("edit-image");
    expect(existsSync(resolve(__dirname, "../../src/icons/tools/edit-image.png"))).toBe(true);

    const generate = HOME_TOOL_SECTIONS.find((section) => section.title === "Generate")?.toolIds ?? [];
    expect(generate.indexOf("edit-image")).toBe(generate.indexOf("image-to-image") + 1);
  });

  it("opens the shared screen in Image to Image mode, with the edit-only parts hidden", () => {
    const root = document.createElement("div");
    root.innerHTML = createAppMarkup();
    const elements = getAppElements(root);
    const options = Array.from(elements.imgWorkflow.options).map((option) => option.value);

    expect(options).toEqual(listImageScreenPresets("transform").map((preset) => preset.id));
    expect(elements.imgScreenTitle.textContent).toBe("Image to Image");
    expect(elements.imgScreenIconEdit.hidden).toBe(true);
    expect(elements.imgEditHint.hidden).toBe(true);
    expect(elements.imgDenoiseField.hidden).toBe(false);
  });
});

describe("Edit Image selection capture", () => {
  it("starts hidden, wrapped so the compact theme's forced flex row cannot show it", () => {
    const root = document.createElement("div");
    root.innerHTML = createAppMarkup();
    const elements = getAppElements(root);

    expect(elements.imgSelectionCaptureField.hidden).toBe(true);
    expect(elements.imgSelectionCaptureField.classList.contains("source-action-row")).toBe(false);
    expect(elements.imgSelectionCaptureField.contains(elements.captureImageSelectionButton)).toBe(true);
  });
});
