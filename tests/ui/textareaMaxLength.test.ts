import { describe, expect, it } from "vitest";
import { createAppMarkup } from "../../src/ui/appMarkup";

/**
 * Every textarea must carry an explicit maxlength.
 *
 * Measured in real Photoshop: a UXP <textarea> stops accepting input at
 * exactly 256 characters. 256 is a buffer size, not a layout accident -- the
 * cap held regardless of how tall the box was, and `scrollHeight` reads 0 in
 * this host, so the earlier "the text is just scrolled out of view" theory was
 * wrong twice over.
 *
 * 256 characters is roughly one sentence. It silently truncated every prompt,
 * and two non-prompt fields nobody had connected to this: the Prompt from
 * Layer caption box (Florence-2 detailed_caption routinely runs longer) and
 * the Settings diagnostics report that Copy Diagnostics reads from.
 *
 * Asserted against the markup because the whole fix is one attribute per
 * field, and the failure mode is silent truncation that no other test in the
 * suite would notice -- jsdom has no such cap.
 */
describe("textarea maxlength", () => {
  const markup = createAppMarkup();
  const textareas = markup.match(/<textarea[^>]*>/g) ?? [];

  it("finds every textarea in the panel", () => {
    expect(textareas.length).toBe(13);
  });

  it("gives each one a maxlength well above the UXP 256-character cap", () => {
    for (const tag of textareas) {
      const match = tag.match(/maxlength="(\d+)"/);
      expect(match, `textarea without maxlength: ${tag}`).not.toBeNull();
      expect(Number(match![1])).toBeGreaterThan(256);
    }
  });
});
