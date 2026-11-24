// @vitest-environment jsdom
//
// Two contracts. The DOM one: flipping a flag repaints the button the way the
// older hand-written toggles do (text, aria-pressed, is-active), and one tool's
// flag never touches another's. The wiring one: every tool that shows an
// Import to Layers button shows Import Automatically beside it, and App.ts acts
// on the flag after a generation succeeds.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTO_IMPORT_OFF_LABEL,
  AUTO_IMPORT_ON_LABEL,
  AUTO_IMPORT_TOOL_NAMES,
  createAutoImportFlags,
  paintAutoImportToggle,
  type AutoImportTool
} from "../../src/ui/autoImportFlags";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";

function toggle(): HTMLElement {
  const element = document.createElement("div");
  element.setAttribute("role", "button");
  element.setAttribute("aria-pressed", "false");
  element.textContent = AUTO_IMPORT_OFF_LABEL;
  return element;
}

describe("paintAutoImportToggle", () => {
  it("paints on and off the way the older toggles do", () => {
    const element = toggle();

    paintAutoImportToggle(element, true);
    expect(element.textContent).toBe("Auto Import On");
    expect(element.getAttribute("aria-pressed")).toBe("true");
    expect(element.classList.contains("is-active")).toBe(true);

    paintAutoImportToggle(element, false);
    expect(element.textContent).toBe("Import Automatically");
    expect(element.getAttribute("aria-pressed")).toBe("false");
    expect(element.classList.contains("is-active")).toBe(false);
  });

  it("uses plain text labels, because panel text renders via textContent", () => {
    for (const label of [AUTO_IMPORT_OFF_LABEL, AUTO_IMPORT_ON_LABEL]) {
      expect(label).not.toMatch(/[`*_]|--/);
    }
  });
});

describe("createAutoImportFlags", () => {
  function build() {
    const toggles = {
      outpaint: toggle(),
      unflatten: toggle()
    };
    return { toggles, flags: createAutoImportFlags<keyof typeof toggles>(toggles) };
  }

  it("starts off, flips on and off, and reports the new state", () => {
    const { toggles, flags } = build();

    expect(flags.isOn("outpaint")).toBe(false);
    expect(flags.toggle("outpaint")).toBe(true);
    expect(flags.isOn("outpaint")).toBe(true);
    expect(toggles.outpaint.getAttribute("aria-pressed")).toBe("true");
    expect(flags.toggle("outpaint")).toBe(false);
    expect(flags.isOn("outpaint")).toBe(false);
    expect(toggles.outpaint.textContent).toBe(AUTO_IMPORT_OFF_LABEL);
  });

  it("keeps each tool's flag and button separate", () => {
    const { toggles, flags } = build();

    flags.toggle("outpaint");

    expect(flags.isOn("unflatten")).toBe(false);
    expect(toggles.unflatten.classList.contains("is-active")).toBe(false);
    expect(toggles.outpaint.classList.contains("is-active")).toBe(true);
  });

  it("paintAll draws every button from its flag", () => {
    const { toggles, flags } = build();
    toggles.unflatten.textContent = "stale";
    toggles.unflatten.setAttribute("aria-pressed", "true");

    flags.paintAll();

    expect(toggles.unflatten.textContent).toBe(AUTO_IMPORT_OFF_LABEL);
    expect(toggles.unflatten.getAttribute("aria-pressed")).toBe("false");
  });
});

// Which handler App.ts must call after each of these tools' generation succeeds.
const IMPORT_HANDLER: Record<AutoImportTool, string> = {
  "sketch-to-image": "handleImportSketch",
  outpaint: "handleImportOutpaint",
  "style-reference": "handleImportStyleReference",
  "multi-reference": "handleImportMultiReference",
  unflatten: "handleImportUnflatten",
  "camera-angle": "handleImportCameraAngle",
  "custom-workflow": "handleImportCustomWorkflow"
};

describe("Import Automatically in every tool's preview", () => {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();

  it("sits beside Import to Layers in every row that has one", () => {
    const rows = [...root.querySelectorAll(".import-actions")].filter((row) =>
      [...row.querySelectorAll(".button")].some((button) => button.textContent?.trim() === "Import to Layers")
    );

    // Thirteen tools with a result preview (Custom Workflow since v0.50), plus Live Painting.
    expect(rows.length).toBe(14);

    for (const row of rows) {
      const buttons = [...row.querySelectorAll(".button")];
      const importIndex = buttons.findIndex((button) => button.textContent?.trim() === "Import to Layers");
      // By label, not class: Live Painting's switch predates the shared class.
      const toggleIndex = buttons.findIndex((button) => button.textContent?.trim() === AUTO_IMPORT_OFF_LABEL);

      expect(toggleIndex, `row of ${buttons[importIndex]?.id}`).toBe(importIndex + 1);
      expect(buttons[toggleIndex].getAttribute("aria-pressed")).toBe("false");
      expect(buttons[toggleIndex].textContent?.trim()).toBe(AUTO_IMPORT_OFF_LABEL);
    }
  });

  it("gives each new toggle an element App.ts resolves and an action it binds", () => {
    const elements = getAppElements(root);
    const app = readFileSync(resolve(__dirname, "../../src/ui/App.ts"), "utf8");
    const map: Record<AutoImportTool, { element: keyof typeof elements; action: string }> = {
      "sketch-to-image": { element: "sketchAutoImportToggle", action: "toggleSketchAutoImport" },
      outpaint: { element: "outpaintAutoImportToggle", action: "toggleOutpaintAutoImport" },
      "style-reference": { element: "styleReferenceAutoImportToggle", action: "toggleStyleReferenceAutoImport" },
      "multi-reference": { element: "multiReferenceAutoImportToggle", action: "toggleMultiReferenceAutoImport" },
      unflatten: { element: "unflattenAutoImportToggle", action: "toggleUnflattenAutoImport" },
      "camera-angle": { element: "cameraAngleAutoImportToggle", action: "toggleCameraAngleAutoImport" },
      "custom-workflow": { element: "customWorkflowAutoImportToggle", action: "toggleCustomWorkflowAutoImport" }
    };

    expect(Object.keys(map).sort()).toEqual(Object.keys(AUTO_IMPORT_TOOL_NAMES).sort());

    for (const { element, action } of Object.values(map)) {
      expect(elements[element].getAttribute("data-openlayer-action")).toBe(action);
      expect(app).toContain(`bindActionControl(elements.${element}, actionHandlers.${action});`);
    }
  });

  it("imports through the tool's own handler once a generation succeeds with the flag on", () => {
    const app = readFileSync(resolve(__dirname, "../../src/ui/App.ts"), "utf8");

    for (const [tool, handler] of Object.entries(IMPORT_HANDLER)) {
      const hook = new RegExp(`if \\(autoImportFlags\\.isOn\\("${tool}"\\)\\) \\{[^}]*await ${handler}\\(\\);`);

      expect(app, tool).toMatch(hook);
    }
  });
});
