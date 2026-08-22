import { describe, expect, it } from "vitest";
import { normalizeTheme, OPEN_LAYER_THEMES, OpenLayerTheme } from "../../src/utils/preferences";

describe("normalizeTheme", () => {
  it("accepts every theme the picker offers", () => {
    for (const theme of OPEN_LAYER_THEMES) {
      expect(normalizeTheme(theme)).toBe(theme);
    }
  });

  it("falls back to compact for anything unrecognised", () => {
    // Stored preferences outlive releases: a theme removed in a later version
    // must not leave the panel with no theme class at all.
    expect(normalizeTheme("artist-friendly-dark")).toBe("compact");
    expect(normalizeTheme("")).toBe("compact");
    expect(normalizeTheme(undefined)).toBe("compact");
    expect(normalizeTheme(null)).toBe("compact");
    expect(normalizeTheme(42)).toBe("compact");
    expect(normalizeTheme({ theme: "artist" })).toBe("compact");
  });

  it("keeps compact as the default so an upgrade does not restyle the panel", () => {
    expect(OPEN_LAYER_THEMES[0]).toBe("compact");
  });
});

/**
 * Mirrors applyTheme's class stacking. Artist-Friendly Dark is compact plus
 * token overrides, so it MUST keep the compact class -- the compact rules are
 * the stylesheet, and a theme that drops them inherits the nine unprefixed
 * base rules instead. Encoded here because the failure is silent: the panel
 * still renders, just unstyled in ways nobody notices until a screenshot.
 */
function themeClassesFor(theme: OpenLayerTheme): string[] {
  const normalized = normalizeTheme(theme);
  const classes: string[] = [];
  if (normalized === "compact" || normalized === "artist") {
    classes.push("theme-compact");
  }
  if (normalized === "classic") {
    classes.push("theme-classic");
  }
  if (normalized === "artist") {
    classes.push("theme-artist");
  }
  return classes;
}

describe("theme class stacking", () => {
  it("gives artist the compact class so it inherits the compact rules", () => {
    expect(themeClassesFor("artist")).toEqual(["theme-compact", "theme-artist"]);
  });

  it("leaves compact exactly as it was", () => {
    expect(themeClassesFor("compact")).toEqual(["theme-compact"]);
  });

  it("never mixes classic with compact", () => {
    expect(themeClassesFor("classic")).toEqual(["theme-classic"]);
  });

  it("applies a theme class for every offered theme", () => {
    for (const theme of OPEN_LAYER_THEMES) {
      expect(themeClassesFor(theme).length).toBeGreaterThan(0);
    }
  });
});
