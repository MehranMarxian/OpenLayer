// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";

/**
 * The brand lockup must stay addressable, because App.ts hides it on every
 * screen except home.
 *
 * It sits above each tool screen's `position: sticky` header, so once a screen
 * grows tall enough to scroll, the lockup slides underneath that header and
 * renders as a half-clipped logo with the title cut off -- reported three
 * times against real Photoshop. The status row directly below it was hidden
 * on tool screens for the same reason back in v0.8.
 *
 * Asserted against the markup because the fix depends on one inert `id`
 * attribute, and nothing else in the suite would notice it being dropped:
 * getAppElements would start throwing at panel startup instead.
 */
describe("brand header markup", () => {
  it("carries the id App.ts resolves it by", () => {
    expect(createAppMarkup()).toContain('id="app-header"');
  });

  it("resolves through getAppElements", () => {
    const root = document.createElement("div");
    root.innerHTML = createAppMarkup();

    expect(getAppElements(root).appHeader).not.toBeNull();
  });
});
