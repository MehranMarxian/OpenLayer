// @vitest-environment jsdom
//
// The screen is mostly declarative markup, so the thing worth asserting is that
// every id the panel looks up actually exists and that the controls the gate
// findings ruled out are genuinely absent rather than merely unused.
import { describe, expect, it } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";
import { bindStickyProgress } from "../../src/ui/appBindings";

function mount() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  return root;
}

describe("multi-reference screen", () => {
  it("resolves every element the panel binds", () => {
    const elements = getAppElements(mount());

    // getAppElements throws on a missing id, so reaching these at all is the
    // assertion; naming them keeps the failure readable when one is renamed.
    expect(elements.multiReferenceView).toBeTruthy();
    expect(elements.multiReferenceList).toBeTruthy();
    expect(elements.multiReferenceCount).toBeTruthy();
    expect(elements.addMultiReferenceLayerButton).toBeTruthy();
    expect(elements.addMultiReferenceCanvasButton).toBeTruthy();
    expect(elements.generateMultiReferenceButton).toBeTruthy();
    expect(elements.importMultiReferenceButton).toBeTruthy();
    expect(elements.multiReferenceResultPreviewPanel).toBeTruthy();
  });

  it("offers steps, CFG and seed but not the controls the technique fixes", () => {
    const root = mount();
    const view = root.querySelector<HTMLElement>("#multi-reference-view");

    expect(view).toBeTruthy();
    expect(view?.querySelector("#multi-reference-steps")).toBeTruthy();
    expect(view?.querySelector("#multi-reference-cfg")).toBeTruthy();
    expect(view?.querySelector("#multi-reference-seed")).toBeTruthy();

    // Denoise is fixed at 1 and the canvas comes from reference 1, so neither
    // has a control to offer. A stray width box here would be a promise the
    // workflow does not keep.
    expect(view?.querySelector("#multi-reference-denoise")).toBeNull();
    expect(view?.querySelector("#multi-reference-width")).toBeNull();
    expect(view?.querySelector("#multi-reference-height")).toBeNull();
  });

  it("gets the pinned head and scrolling body every other screen gets", () => {
    const root = mount();
    bindStickyProgress(root);
    const view = root.querySelector<HTMLElement>("#multi-reference-view");

    expect(view?.classList.contains("has-screen-head")).toBe(true);
    expect(view?.querySelector(":scope > .screen-head")).toBeTruthy();
    expect(view?.querySelector(":scope > .screen-body")).toBeTruthy();
  });

  it("tells the artist what carries and what does not, on the screen itself", () => {
    const root = mount();
    const view = root.querySelector<HTMLElement>("#multi-reference-view");
    const text = (view?.textContent ?? "").toLowerCase();

    // The likeness limit has to be readable before a run, not discovered after
    // one -- see docs/multi-reference-gate-findings.md, Q2.
    expect(text).toContain("faces do not");
    // And the one ordering rule that actually changes output.
    expect(text).toContain("sets the output size");
  });
});
