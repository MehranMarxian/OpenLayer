// @vitest-environment jsdom

/**
 * Photoshop 28 paints its own grey face over every native <button> (docs/
 * ui-audit-ps28.md, R1), so the panel draws every control as a div button
 * (buttonMarkup.ts, divButton.ts). This keeps a new native button from
 * slipping back in: in the markup, and in code that builds controls.
 *
 * The UI sheet (componentSheet.ts) is the one exemption. It draws native
 * buttons on purpose, beside the div ones, as the reference for comparing
 * them in the host.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAppMarkup } from "../../src/ui/appMarkup";

const UI_DIR = join(__dirname, "../../src/ui");
const EXEMPT = new Set(["componentSheet.ts"]);

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("no native buttons", () => {
  it("the panel markup has no <button>", () => {
    const root = document.createElement("div");
    root.innerHTML = createAppMarkup();
    // The UI sheet is only a placeholder here; componentSheet.ts fills it at
    // runtime, so the markup itself must have none at all.
    const native = [...root.querySelectorAll("button")];

    expect(native.map((button) => button.id || button.className)).toEqual([]);
  });

  it("no UI module builds a <button> in code or writes one in a template", () => {
    const offenders: string[] = [];

    for (const file of readdirSync(UI_DIR)) {
      if (!file.endsWith(".ts") || EXEMPT.has(file)) {
        continue;
      }

      const source = stripComments(readFileSync(join(UI_DIR, file), "utf8"));

      if (/createElement\(\s*["']button["']\s*\)/.test(source) || /<button[\s>]/.test(source)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("every div button is focusable and announced as a button", () => {
    const root = document.createElement("div");
    root.innerHTML = createAppMarkup();

    for (const control of root.querySelectorAll<HTMLElement>('div[role="button"]')) {
      expect(control.getAttribute("tabindex"), control.id || control.className).toMatch(/^(0|-1)$/);
    }
  });
});
