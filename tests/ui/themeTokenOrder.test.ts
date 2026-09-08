// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OPEN_LAYER_THEMES } from "../../src/utils/preferences";

/**
 * A theme's token block has to sit after every compact block it overrides.
 *
 * Every theme now carries `.theme-compact` and stacks its own class on top, so
 * a theme is a set of colour overrides rather than a second stylesheet. Both
 * selectors have the same specificity — `.app-shell.theme-compact` and
 * `.app-shell.theme-classic` are each (0,2,0) — which means the winner is
 * decided purely by source order.
 *
 * That is not theoretical. The compact sheet re-declares `--ol-bg` three times,
 * and Classic v0.4's token block used to sit above all of them: the moment
 * Classic started inheriting the compact layout, its palette silently lost to
 * the very rules it was meant to override, and the theme rendered as plain
 * compact with none of its own colours. Artist-Friendly Dark has carried a
 * "keep this block LAST" comment since v0.16 for the same reason, which is
 * exactly the kind of instruction that survives right up until someone appends
 * one more rule.
 *
 * Checked against the real stylesheet rather than a copy, so it fails on the
 * edit that would cause it.
 */
describe("theme token source order", () => {
  const css = readFileSync(resolve(__dirname, "../../src/styles.css"), "utf8");

  /**
   * The last compact rule that declares a CUSTOM PROPERTY, not simply the last
   * one that mentions the class. Only token declarations compete with a theme's
   * palette; the component rules that trail the file (`.prompt-wallet-card` and
   * friends) style elements and never touch `--ol-*`, so ordering against those
   * would fail for no reason.
   */
  const lastCompactTokenBlock = (() => {
    const blocks = [...css.matchAll(/\.app-shell\.theme-compact[^{]*\{([^}]*)\}/g)];
    // A DECLARATION (`--ol-bg: #222`), not a use (`var(--ol-bg)`). Almost every
    // compact rule reads tokens; only a handful set them.
    const tokenBlocks = blocks.filter((block) => /(^|[;{])\s*--ol-[a-z-]+\s*:/.test(block[1]));

    return tokenBlocks.length > 0 ? tokenBlocks[tokenBlocks.length - 1].index ?? -1 : -1;
  })();

  it("has compact token declarations to override in the first place", () => {
    expect(lastCompactTokenBlock).toBeGreaterThan(-1);
  });

  for (const theme of OPEN_LAYER_THEMES) {
    if (theme === "compact") {
      continue;
    }

    it(`declares ${theme}'s tokens after the last compact rule`, () => {
      const selector = `.app-shell.theme-${theme}`;
      const firstDeclaration = css.indexOf(selector);

      expect(firstDeclaration, `${selector} is not in the stylesheet at all`).toBeGreaterThan(-1);
      expect(
        firstDeclaration,
        `${selector} is declared before the last .app-shell.theme-compact block that sets ` +
          "tokens, so the compact sheet wins at equal specificity and this theme's colours are " +
          "silently ignored"
      ).toBeGreaterThan(lastCompactTokenBlock);
    });
  }
});
