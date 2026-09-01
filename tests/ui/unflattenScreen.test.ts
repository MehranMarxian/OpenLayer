// @vitest-environment jsdom
//
// The screen is mostly declarative markup, so the thing worth asserting is that
// every id the panel looks up exists, and that the controls the gate findings
// ruled out are genuinely absent rather than merely unused.
import { describe, expect, it } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";
import { HOME_TOOL_SECTIONS, TOOL_CARDS } from "../../src/ui/appConstants";
import {
  MAX_UNFLATTEN_LAYER_COUNT,
  MIN_UNFLATTEN_LAYER_COUNT,
  DEFAULT_UNFLATTEN_LAYER_COUNT
} from "../../src/ui/appConstants";

function mount() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  return root;
}

describe("unflatten screen", () => {
  it("resolves every element the panel binds", () => {
    const elements = getAppElements(mount());

    // getAppElements throws on a missing id, so reaching these at all is the
    // assertion; naming them keeps the failure readable when one is renamed.
    expect(elements.unflattenView).toBeTruthy();
    expect(elements.unflattenPrompt).toBeTruthy();
    expect(elements.unflattenLayerCount).toBeTruthy();
    expect(elements.unflattenSourcePreviewPanel).toBeTruthy();
    expect(elements.unflattenSourceTitle).toBeTruthy();
    expect(elements.unflattenSourceMeta).toBeTruthy();
    expect(elements.captureUnflattenLayerButton).toBeTruthy();
    expect(elements.captureUnflattenCanvasButton).toBeTruthy();
    expect(elements.describeUnflattenSourceButton).toBeTruthy();
    expect(elements.generateUnflattenButton).toBeTruthy();
    expect(elements.importUnflattenButton).toBeTruthy();
    expect(elements.unflattenResultPreviewPanel).toBeTruthy();
  });

  it("offers layers, steps and seed but not the controls the technique fixes", () => {
    const view = mount().querySelector<HTMLElement>("#unflatten-view");

    expect(view).toBeTruthy();
    expect(view?.querySelector("#unflatten-layer-count")).toBeTruthy();
    expect(view?.querySelector("#unflatten-steps")).toBeTruthy();
    expect(view?.querySelector("#unflatten-seed")).toBeTruthy();

    // The latent is sized from the captured source and the graph decomposes an
    // existing picture rather than re-sampling it, so width, height and denoise
    // have nothing to control. CFG is fixed at 2.5 the same way -- it is the
    // technique, not a default, so there is nowhere for a slider to go.
    expect(view?.querySelector("#unflatten-width")).toBeNull();
    expect(view?.querySelector("#unflatten-height")).toBeNull();
    expect(view?.querySelector("#unflatten-denoise")).toBeNull();
    expect(view?.querySelector("#unflatten-cfg")).toBeNull();
    expect(view?.querySelector("#unflatten-negative-prompt")).toBeNull();
  });

  it("caps the layer control at the measured range rather than leaving it open", () => {
    const input = mount().querySelector<HTMLInputElement>("#unflatten-layer-count");

    // Two fuses distinct objects into one plate and six returns blank layers,
    // so the range is a finding rather than a guess. Gate findings, Q2.
    expect(input?.getAttribute("min")).toBe(String(MIN_UNFLATTEN_LAYER_COUNT));
    expect(input?.getAttribute("max")).toBe(String(MAX_UNFLATTEN_LAYER_COUNT));
    expect(input?.getAttribute("value")).toBe(DEFAULT_UNFLATTEN_LAYER_COUNT);
    expect(DEFAULT_UNFLATTEN_LAYER_COUNT).toBe("4");
  });

  it("states the close-up limit where it can actually be read", () => {
    const view = mount().querySelector<HTMLElement>("#unflatten-view");
    const hint = view?.querySelector("#unflatten-prompt-hint");

    // Whether a picture actually separated needs its alpha channel, which
    // nothing here can read, and both cheap proxies were measured and rejected.
    // So this sentence is the only warning an artist gets, and it has to stay.
    expect(hint?.textContent).toMatch(/close-up/i);
    expect(hint?.textContent).toMatch(/in front of/i);

    // Deliberately NOT an info panel. In the active compact theme the info
    // toggle is display:none and the panel it would open starts [hidden], so
    // anything put there is unreachable. A diagnostics line is always visible.
    expect(hint?.classList.contains("diagnostics-line")).toBe(true);
    expect(view?.querySelector("#unflatten-compatibility-note")).toBeNull();
  });

  it("carries the img2img screen shape, so it inherits both themes", () => {
    const view = mount().querySelector<HTMLElement>("#unflatten-view");

    // The compact theme scopes its rules on .image-to-image-view. Dropping this
    // class would leave the screen styled by base-theme rules only, which is the
    // trap ORCHESTRATION section 3 describes.
    expect(view?.classList.contains("image-to-image-view")).toBe(true);
  });

  it("is listed as an experimental tool card on Home", () => {
    const card = TOOL_CARDS.find((entry) => entry.id === "unflatten");

    expect(card?.status).toBe("experimental");
    expect(card?.view).toBe("unflatten");
    // The subtitle must not grow into a claim that it takes any layer apart.
    expect(card?.subtitle).toBe("Split a flat layer into separate layers");
    expect(HOME_TOOL_SECTIONS.some((section) => section.toolIds.includes("unflatten"))).toBe(true);
  });
});

describe("unflatten description assist", () => {
  it("offers to write the description, next to the field it fills", () => {
    const view = mount().querySelector<HTMLElement>("#unflatten-view");
    const button = view?.querySelector<HTMLElement>("#describe-unflatten-source");

    expect(button).toBeTruthy();
    // Unflatten is the one tool whose prompt describes what is already in the
    // picture rather than what is wanted, which is exactly what Florence-2
    // produces -- so the two halves of that operation live on one screen.
    expect(button?.textContent).toMatch(/describe/i);
    expect(view?.querySelector("#unflatten-prompt")).toBeTruthy();
  });

  it("does not dress an assist as a primary action", () => {
    const button = mount().querySelector<HTMLElement>("#describe-unflatten-source");

    // The panel has two button colours that carry meaning: orange generates,
    // blue imports. A third would invent a third meaning for one assist.
    expect(button?.classList.contains("button-primary")).toBe(false);
    expect(button?.classList.contains("button-import")).toBe(false);
    expect(button?.classList.contains("action-control")).toBe(true);
  });
});
