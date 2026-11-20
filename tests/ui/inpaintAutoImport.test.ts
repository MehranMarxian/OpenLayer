// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";

/**
 * Inpaint was the odd one out: it offered "Import to Layers" but no
 * "Import Automatically" beside it, so every inpaint result had to be imported
 * by hand while Text to Image, Image to Image and Upscale all imported for you.
 *
 * Asserted against the markup and the element lookup because the feature is
 * three separate pieces that must agree -- the button, the AppElements entry
 * App.ts writes its label through, and the data-openlayer-action the delegated
 * click handler dispatches on. Drop any one and the button silently does
 * nothing rather than failing loudly.
 */
describe("inpaint auto import", () => {
  const markup = createAppMarkup();

  it("sits in the same import row as Import to Layers", () => {
    // Read through the DOM, not a regex: the buttons are divs now, so the
    // first </div> after the Import button is its own close tag.
    const root = document.createElement("div");
    root.innerHTML = markup;
    const row = root.querySelector("#import-inpaint-result")?.closest(".import-actions");

    expect(row, "inpaint import-actions row not found").not.toBeNull();
    expect(row!.querySelector("#inpaint-auto-import-toggle")).not.toBeNull();
  });

  it("dispatches the action App.ts registers", () => {
    expect(markup).toContain('data-openlayer-action="toggleInpaintAutoImport"');
  });

  it("resolves through getAppElements", () => {
    const root = document.createElement("div");
    root.innerHTML = markup;

    expect(getAppElements(root).inpaintAutoImportToggle).not.toBeNull();
  });

  it("starts off, matching the other tools", () => {
    const root = document.createElement("div");
    root.innerHTML = markup;
    const toggle = getAppElements(root).inpaintAutoImportToggle;

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.textContent).toBe("Import Automatically");
  });
});
