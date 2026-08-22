import { describe, expect, it } from "vitest";
import { createAppMarkup } from "../../src/ui/appMarkup";

/**
 * The seed fields must not be <input type="number">.
 *
 * A UXP number input clamps at roughly 214748.36 -- 2147483647 scaled by
 * 1/10000 -- so every seed wider than six digits came back out as that same
 * mangled string. That is worse than a display bug: readRequiredInteger in
 * comfy/settings.ts rejects non-integers, so a mangled seed fails the run with
 * "Seed must be a whole number". Loading any History entry was enough to hit
 * it, because entry seeds are full-width server-side rolls.
 *
 * This is asserted against the markup rather than in a DOM test because the
 * bug lives in the attribute, and nothing else in the suite would notice it
 * being changed back.
 */
describe("seed field markup", () => {
  const markup = createAppMarkup();
  const seedIds = ["seed", "img-seed", "sketch-seed", "inpaint-seed", "outpaint-seed"];

  function tagFor(id: string): string {
    const match = markup.match(new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`));
    expect(match, `no input found with id="${id}"`).not.toBeNull();
    return match![0];
  }

  it("renders every seed field the dice button targets", () => {
    for (const id of seedIds) {
      expect(() => tagFor(id)).not.toThrow();
    }
  });

  it("never uses type=number for a seed field", () => {
    for (const id of seedIds) {
      expect(tagFor(id), `#${id} must not be a number input`).not.toContain('type="number"');
    }
  });

  it("uses a text input with a numeric input mode instead", () => {
    for (const id of seedIds) {
      const tag = tagFor(id);
      expect(tag).toContain('type="text"');
      expect(tag).toContain('inputmode="numeric"');
    }
  });
});
