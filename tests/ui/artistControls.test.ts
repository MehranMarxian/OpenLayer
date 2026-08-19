// @vitest-environment jsdom
//
// Scoped to this file on purpose. The suite runs on node because it is
// almost all pure logic, and previewHub/previewState stub the two DOM calls
// they need rather than pulling jsdom in globally. This module is different:
// what is worth testing IS the DOM contract -- that the slider writes through
// to the number input and re-dispatches input/change so handlers bound before
// it existed still fire. A hand-rolled fake would end up testing the fake.
import { beforeEach, describe, expect, it } from "vitest";
import {
  ARTIST_CONTROLS,
  formatArtistLabel,
  syncArtistControls,
  widenToFit,
  wireArtistControls
} from "../../src/ui/artistControls";

describe("widenToFit", () => {
  it("leaves the soft range alone for a value inside it", () => {
    expect(widenToFit(20, 1, 60)).toEqual({ min: 1, max: 60 });
  });

  it("extends rather than clamps a value above the soft range", () => {
    // Steps accepts up to 150. A saved 90 must survive a theme switch intact.
    expect(widenToFit(90, 1, 60)).toEqual({ min: 1, max: 90 });
  });

  it("extends rather than clamps a value below the soft range", () => {
    expect(widenToFit(0, 1, 60)).toEqual({ min: 0, max: 60 });
  });

  it("keeps the soft range when the value is not a number", () => {
    expect(widenToFit(Number.NaN, 1, 60)).toEqual({ min: 1, max: 60 });
  });
});

describe("formatArtistLabel", () => {
  const steps = ARTIST_CONTROLS.find((control) => control.inputId === "steps")!;
  const cfg = ARTIST_CONTROLS.find((control) => control.inputId === "cfg")!;
  const denoise = ARTIST_CONTROLS.find((control) => control.inputId === "img-denoise")!;

  it("leads with the artist word and keeps the jargon searchable", () => {
    expect(formatArtistLabel(steps, 8)).toBe("Detail (steps): 8");
    expect(formatArtistLabel(cfg, 1)).toBe("Guidance (CFG): 1.0");
  });

  it("shows denoise as a percentage rather than a decimal", () => {
    expect(formatArtistLabel(denoise, 0.6)).toBe("Strength (denoise): 60%");
    expect(formatArtistLabel(denoise, 1)).toBe("Strength (denoise): 100%");
  });

  it("does not invent a number when the input is empty", () => {
    expect(formatArtistLabel(steps, Number.NaN)).toBe("Detail (steps): --");
  });
});

function buildField(id: string, attrs: Record<string, string>): HTMLElement {
  const field = document.createElement("label");
  field.className = "field";
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = id;
  const input = document.createElement("input");
  input.className = "input input-compact";
  input.type = "number";
  input.id = id;
  for (const [key, value] of Object.entries(attrs)) {
    input.setAttribute(key, value);
  }
  field.append(label, input);
  return field;
}

describe("wireArtistControls", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.append(
      buildField("steps", { min: "1", max: "150", step: "1", value: "8" }),
      buildField("img-denoise", { min: "0.05", max: "1", step: "0.05", value: "0.6" })
    );
    document.body.replaceChildren(root);
  });

  it("injects a slider and label beside each number input it finds", () => {
    expect(wireArtistControls(root)).toBe(2);

    const slider = root.querySelector<HTMLInputElement>("#steps-artist-slider")!;
    expect(slider.type).toBe("range");
    // UXP ignores an implicit step, so it must be on the element.
    expect(slider.step).toBe("1");
    expect(root.querySelector("#steps-artist-label")!.textContent).toBe("Detail (steps): 8");
  });

  it("leaves the number input in the DOM as the source of truth", () => {
    wireArtistControls(root);
    expect(root.querySelector<HTMLInputElement>("#steps")!.value).toBe("8");
  });

  it("writes through to the number input and notifies existing handlers", () => {
    wireArtistControls(root);
    const input = root.querySelector<HTMLInputElement>("#steps")!;
    const slider = root.querySelector<HTMLInputElement>("#steps-artist-slider")!;

    const seen: string[] = [];
    input.addEventListener("input", () => seen.push("input"));
    input.addEventListener("change", () => seen.push("change"));

    slider.value = "24";
    slider.dispatchEvent(new Event("input"));

    expect(input.value).toBe("24");
    // Handlers bound before the slider existed must still fire untouched.
    expect(seen).toEqual(["input", "change"]);
  });

  it("quantises a dragged value onto the declared step", () => {
    wireArtistControls(root);
    const input = root.querySelector<HTMLInputElement>("#img-denoise")!;
    const slider = root.querySelector<HTMLInputElement>("#img-denoise-artist-slider")!;

    slider.value = "0.63";
    slider.dispatchEvent(new Event("input"));

    expect(Number(input.value)).toBe(0.65);
    expect(root.querySelector("#img-denoise-artist-label")!.textContent).toBe("Strength (denoise): 65%");
  });

  it("follows the number input when a preset writes to it", () => {
    wireArtistControls(root);
    const input = root.querySelector<HTMLInputElement>("#steps")!;

    input.value = "30";
    input.dispatchEvent(new Event("change"));

    expect(root.querySelector<HTMLInputElement>("#steps-artist-slider")!.value).toBe("30");
    expect(root.querySelector("#steps-artist-label")!.textContent).toBe("Detail (steps): 30");
  });

  it("widens the slider instead of clamping a value past the soft range", () => {
    wireArtistControls(root);
    const input = root.querySelector<HTMLInputElement>("#steps")!;
    const slider = root.querySelector<HTMLInputElement>("#steps-artist-slider")!;

    // 90 is legal for the typed input but past the slider's soft max of 60.
    input.value = "90";
    input.dispatchEvent(new Event("change"));

    expect(slider.max).toBe("90");
    expect(input.value).toBe("90");
  });

  it("does not inject a second slider when called twice", () => {
    wireArtistControls(root);
    expect(wireArtistControls(root)).toBe(0);
    expect(root.querySelectorAll("#steps-artist-slider")).toHaveLength(1);
  });

  it("skips controls whose field is not on this screen", () => {
    const partial = document.createElement("div");
    partial.append(buildField("steps", { min: "1", max: "150", step: "1", value: "8" }));
    expect(wireArtistControls(partial)).toBe(1);
  });
});

describe("syncArtistControls", () => {
  it("recovers a slider left stale by a silent value assignment", () => {
    const root = document.createElement("div");
    root.append(buildField("steps", { min: "1", max: "150", step: "1", value: "8" }));
    document.body.replaceChildren(root);
    wireArtistControls(root);

    // No event dispatched -- this is the case the sync exists for.
    root.querySelector<HTMLInputElement>("#steps")!.value = "42";
    expect(root.querySelector<HTMLInputElement>("#steps-artist-slider")!.value).toBe("8");

    syncArtistControls(root);

    expect(root.querySelector<HTMLInputElement>("#steps-artist-slider")!.value).toBe("42");
    expect(root.querySelector("#steps-artist-label")!.textContent).toBe("Detail (steps): 42");
  });
});
