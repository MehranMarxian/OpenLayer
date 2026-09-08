import { describe, expect, it } from "vitest";
import { HOME_TOOL_SECTIONS, TOOL_CARDS } from "../../src/ui/appConstants";

/**
 * The dashboard is driven by two lists, and only one of them decides what a
 * person can see.
 *
 * `TOOL_CARDS` describes every tool; `HOME_TOOL_SECTIONS` decides which ones
 * are grouped onto the home screen and in what order. A card missing from the
 * sections is not an error anywhere -- the renderer maps ids to cards and drops
 * what it cannot find -- so the tool simply never appears, with its view, its
 * bindings and its preset all present and working behind an entry point nobody
 * can reach. That is exactly how Remove Background first shipped into a build:
 * fully wired, completely invisible.
 *
 * Checked in both directions. An id in a section with no card is the same bug
 * seen from the other end, and would render nothing while looking deliberate.
 */
describe("home tool sections", () => {
  const sectionIds = HOME_TOOL_SECTIONS.flatMap((section) => section.toolIds);
  const cardIds = TOOL_CARDS.map((card) => card.id);

  it("puts every tool card on the home screen", () => {
    const missing = cardIds.filter((id) => !sectionIds.includes(id));

    expect(missing, "tool cards that no home section lists, so they never render").toEqual([]);
  });

  it("has a card for every id a section names", () => {
    const unknown = sectionIds.filter((id) => !cardIds.includes(id));

    expect(unknown, "home section entries with no matching tool card").toEqual([]);
  });

  it("lists each tool exactly once", () => {
    const duplicates = sectionIds.filter((id, index) => sectionIds.indexOf(id) !== index);

    expect(duplicates, "tools listed in more than one home section").toEqual([]);
  });
});
