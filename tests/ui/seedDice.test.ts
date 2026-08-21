// @vitest-environment jsdom
//
// Same rationale as artistControls.test.ts: the DOM contract here (moving the
// input out of the field, restoring it on teardown) is what actually matters,
// not just the pure roll logic.
import { beforeEach, describe, expect, it } from "vitest";
import { rollSeed, setSeedDiceEnabled } from "../../src/ui/seedDice";

describe("rollSeed", () => {
  it("returns a non-negative integer within the seed range", () => {
    for (let i = 0; i < 20; i += 1) {
      const seed = rollSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(Number.MAX_SAFE_INTEGER);
    }
  });

  it("does not return the same value every time", () => {
    const values = new Set(Array.from({ length: 10 }, () => rollSeed()));
    expect(values.size).toBeGreaterThan(1);
  });
});

function buildSeedField(id: string): HTMLElement {
  const field = document.createElement("label");
  field.className = "field settings-seed";
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Seed";
  const input = document.createElement("input");
  input.className = "input input-compact";
  input.type = "number";
  input.id = id;
  input.min = "0";
  input.placeholder = "Random";
  field.append(label, input);
  return field;
}

describe("setSeedDiceEnabled", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.append(buildSeedField("seed"), buildSeedField("img-seed"));
    document.body.replaceChildren(root);
  });

  it("reports every seed field found on this screen", () => {
    expect(setSeedDiceEnabled(root, true)).toBe(2);
  });

  it("moves the input into a row beside a dice button", () => {
    setSeedDiceEnabled(root, true);

    const input = root.querySelector<HTMLInputElement>("#seed")!;
    const row = input.parentElement!;
    expect(row.className).toBe("seed-row");
    expect(row.querySelector(".seed-dice-button")).not.toBeNull();
    // The input is still the direct value holder, just re-parented.
    expect(row.contains(input)).toBe(true);
  });

  it("leaves the field's own label untouched and in place", () => {
    setSeedDiceEnabled(root, true);
    const field = root.querySelector<HTMLElement>(".field")!;
    expect(field.querySelector<HTMLElement>(":scope > .label")?.textContent).toBe("Seed");
  });

  it("rolls a fresh value into the input on click", () => {
    setSeedDiceEnabled(root, true);
    const input = root.querySelector<HTMLInputElement>("#seed")!;
    const button = root.querySelector<HTMLButtonElement>(".seed-dice-button")!;

    expect(input.value).toBe("");
    button.click();

    expect(input.value).not.toBe("");
    expect(Number.isInteger(Number(input.value))).toBe(true);
  });

  it("rolls a different value on repeated clicks", () => {
    setSeedDiceEnabled(root, true);
    const input = root.querySelector<HTMLInputElement>("#seed")!;
    const button = root.querySelector<HTMLButtonElement>(".seed-dice-button")!;

    button.click();
    const first = input.value;
    button.click();
    const second = input.value;

    expect(first).not.toBe(second);
  });

  it("fires input and change so any future listener sees the roll", () => {
    setSeedDiceEnabled(root, true);
    const input = root.querySelector<HTMLInputElement>("#seed")!;
    const button = root.querySelector<HTMLButtonElement>(".seed-dice-button")!;

    const seen: string[] = [];
    input.addEventListener("input", () => seen.push("input"));
    input.addEventListener("change", () => seen.push("change"));

    button.click();

    expect(seen).toEqual(["input", "change"]);
  });

  it("removes the row and restores the input as a direct child on teardown", () => {
    setSeedDiceEnabled(root, true);
    const field = root.querySelector<HTMLElement>(".field")!;

    setSeedDiceEnabled(root, false);

    expect(field.querySelector(".seed-row")).toBeNull();
    expect(field.classList.contains("has-seed-dice")).toBe(false);
    expect(field.querySelector<HTMLInputElement>("#seed")!.parentElement).toBe(field);
  });

  it("preserves a value already in the field across teardown", () => {
    root.querySelector<HTMLInputElement>("#seed")!.value = "12345";
    setSeedDiceEnabled(root, true);
    setSeedDiceEnabled(root, false);
    expect(root.querySelector<HTMLInputElement>("#seed")!.value).toBe("12345");
  });

  it("does not build a second row when enabled twice", () => {
    setSeedDiceEnabled(root, true);
    setSeedDiceEnabled(root, true);
    expect(root.querySelectorAll(".seed-row")).toHaveLength(2);
    expect(root.querySelectorAll(".seed-dice-button")).toHaveLength(2);
  });

  it("survives repeated theme switching", () => {
    for (let i = 0; i < 5; i += 1) {
      setSeedDiceEnabled(root, true);
      setSeedDiceEnabled(root, false);
    }
    expect(root.querySelectorAll(".seed-row")).toHaveLength(0);
    setSeedDiceEnabled(root, true);
    expect(root.querySelectorAll(".seed-row")).toHaveLength(2);
  });

  it("skips screens where a seed field is not present", () => {
    const partial = document.createElement("div");
    partial.append(buildSeedField("seed"));
    expect(setSeedDiceEnabled(partial, true)).toBe(1);
  });
});
