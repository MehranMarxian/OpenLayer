// @vitest-environment jsdom
//
// Scoped to this file on purpose. The suite runs on node because it is almost
// all pure logic, and previewHub/previewState stub the two DOM calls they need
// rather than pulling jsdom in globally. This module is different: the DOM
// contract IS the thing worth testing -- both bugs that reached Photoshop were
// contract bugs, not logic bugs, and a hand-rolled fake would test the fake.
import { beforeEach, describe, expect, it } from "vitest";
import {
  ARTIST_CONTROLS,
  formatArtistLabel,
  setArtistControlsEnabled,
  syncArtistControls,
  widenToFit
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

function sliders(root: ParentNode): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>(".artist-slider"));
}

describe("setArtistControlsEnabled", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.append(
      buildField("steps", { min: "1", max: "150", step: "1", value: "8" }),
      buildField("img-denoise", { min: "0.05", max: "1", step: "0.05", value: "0.6" })
    );
    document.body.replaceChildren(root);
  });

  it("builds a slider row for each number input it finds", () => {
    expect(setArtistControlsEnabled(root, true)).toBe(2);

    const slider = sliders(root)[0];
    expect(slider.type).toBe("range");
    // UXP ignores an implicit step, so it must be on the element.
    expect(slider.step).toBe("1");
    expect(root.querySelector(".artist-label")!.textContent).toBe("Detail (steps): 8");
  });

  it("nests the slider so compact's .field > input rules cannot match it", () => {
    // Not cosmetic. `.field > input { display: block !important; width: 96px !important }`
    // matched an injected slider directly and leaked it into Compact Adobe Dark.
    setArtistControlsEnabled(root, true);
    const slider = sliders(root)[0];
    expect(slider.parentElement!.className).toBe("artist-row");
    expect(slider.parentElement!.parentElement!.classList.contains("field")).toBe(true);
  });

  it("removes every trace of itself when the theme goes back to compact", () => {
    setArtistControlsEnabled(root, true);
    expect(root.querySelectorAll(".artist-row")).toHaveLength(2);

    setArtistControlsEnabled(root, false);

    expect(root.querySelectorAll(".artist-row")).toHaveLength(0);
    expect(root.querySelectorAll(".has-artist-slider")).toHaveLength(0);
    expect(root.querySelector<HTMLInputElement>("#steps")!.value).toBe("8");
  });

  it("leaves the number input in the DOM as the source of truth", () => {
    setArtistControlsEnabled(root, true);
    expect(root.querySelector<HTMLInputElement>("#steps")!.value).toBe("8");
  });

  it("writes a dragged value through to the number input", () => {
    setArtistControlsEnabled(root, true);
    const input = root.querySelector<HTMLInputElement>("#steps")!;
    const slider = sliders(root)[0];

    slider.value = "24";
    slider.dispatchEvent(new Event("input"));

    expect(input.value).toBe("24");
  });

  it("does not recurse when a value assignment echoes back as an input event", () => {
    // The crash this replaced. UXP is not the browser and may fire `input` on a
    // programmatic `.value` write; unguarded that is unbounded recursion, and a
    // stack overflow inside UXP takes Photoshop down with it.
    setArtistControlsEnabled(root, true);
    const input = root.querySelector<HTMLInputElement>("#steps")!;
    const slider = sliders(root)[0];

    let echoes = 0;
    input.addEventListener("input", () => {
      echoes += 1;
      if (echoes < 50) {
        slider.dispatchEvent(new Event("input"));
      }
    });

    slider.value = "24";
    expect(() => slider.dispatchEvent(new Event("input"))).not.toThrow();
    // The latch swallows the re-entry, so exactly one pass runs.
    expect(echoes).toBe(1);
    expect(input.value).toBe("24");
  });

  it("fires change once at the end of a drag, not on every step of it", () => {
    setArtistControlsEnabled(root, true);
    const input = root.querySelector<HTMLInputElement>("#steps")!;
    const slider = sliders(root)[0];

    let changes = 0;
    input.addEventListener("change", () => {
      changes += 1;
    });

    for (const value of ["10", "12", "14", "16"]) {
      slider.value = value;
      slider.dispatchEvent(new Event("input"));
    }
    expect(changes).toBe(0);

    slider.dispatchEvent(new Event("change"));
    expect(changes).toBe(1);
  });

  it("quantises a dragged value onto the declared step", () => {
    setArtistControlsEnabled(root, true);
    const input = root.querySelector<HTMLInputElement>("#img-denoise")!;
    const slider = sliders(root)[1];

    slider.value = "0.63";
    slider.dispatchEvent(new Event("input"));

    expect(Number(input.value)).toBe(0.65);
  });

  it("follows the number input when a preset writes to it", () => {
    setArtistControlsEnabled(root, true);
    const input = root.querySelector<HTMLInputElement>("#steps")!;

    input.value = "30";
    input.dispatchEvent(new Event("change"));

    expect(sliders(root)[0].value).toBe("30");
    expect(root.querySelector(".artist-label")!.textContent).toBe("Detail (steps): 30");
  });

  it("widens the slider instead of clamping a value past the soft range", () => {
    // The exact path that crashed Photoshop: steps 90 in compact, then switch.
    root.querySelector<HTMLInputElement>("#steps")!.value = "90";

    expect(() => setArtistControlsEnabled(root, true)).not.toThrow();

    const slider = sliders(root)[0];
    expect(slider.max).toBe("90");
    expect(slider.value).toBe("90");
    expect(root.querySelector<HTMLInputElement>("#steps")!.value).toBe("90");
  });

  it("does not build a second row when enabled twice", () => {
    setArtistControlsEnabled(root, true);
    setArtistControlsEnabled(root, true);
    expect(root.querySelectorAll(".artist-row")).toHaveLength(2);
  });

  it("survives repeated theme switching", () => {
    for (let index = 0; index < 5; index += 1) {
      setArtistControlsEnabled(root, true);
      setArtistControlsEnabled(root, false);
    }
    expect(root.querySelectorAll(".artist-row")).toHaveLength(0);

    setArtistControlsEnabled(root, true);
    expect(root.querySelectorAll(".artist-row")).toHaveLength(2);
  });

  it("skips controls whose field is not on this screen", () => {
    const partial = document.createElement("div");
    partial.append(buildField("steps", { min: "1", max: "150", step: "1", value: "8" }));
    expect(setArtistControlsEnabled(partial, true)).toBe(1);
  });
});

describe("syncArtistControls", () => {
  it("recovers a slider left stale by a silent value assignment", () => {
    const root = document.createElement("div");
    root.append(buildField("steps", { min: "1", max: "150", step: "1", value: "8" }));
    document.body.replaceChildren(root);
    setArtistControlsEnabled(root, true);

    // No event dispatched -- this is the case the sync exists for.
    root.querySelector<HTMLInputElement>("#steps")!.value = "42";
    expect(sliders(root)[0].value).toBe("8");

    syncArtistControls(root);

    expect(sliders(root)[0].value).toBe("42");
    expect(root.querySelector(".artist-label")!.textContent).toBe("Detail (steps): 42");
  });

  it("does nothing when the rows have been torn down", () => {
    const root = document.createElement("div");
    root.append(buildField("steps", { min: "1", max: "150", step: "1", value: "8" }));
    document.body.replaceChildren(root);
    expect(() => syncArtistControls(root)).not.toThrow();
  });
});
