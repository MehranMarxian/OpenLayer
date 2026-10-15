import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Adobe rejected an Exchange submission over this wording (2026-09-25), and the
 * pages below are what search engines, LLMs and Adobe's reviewers read: ChatGPT
 * is OpenLayer's largest referrer and quotes README, llms.txt and the landing
 * page's meta description and JSON-LD.
 *
 * The rule (CLAUDE.md): say "plugin for Photoshop", and never use "Photoshop"
 * as an adjective. "Photoshop plugin", "Photoshop panel", "Photoshop UXP" and
 * "Photoshop layer" all break it. Rewording keeps the meaning: "a layer in
 * Photoshop", "the panel in Photoshop", "UXP in Photoshop".
 *
 * Only public copy is checked. CHANGELOG history, design notes and agent
 * prompts are not, because they are not what a visitor or a reviewer reads, and
 * rewriting release history to satisfy a later rule would make it less true.
 */
const PUBLIC_COPY = [
  "README.md",
  "CONTRIBUTING.md",
  "docs/index.html",
  "docs/become-a-tester.html",
  "docs/privacy.html",
  "docs/terms.html",
  "docs/llms.txt",
  "bridge/README.md",
  "bridge/package.json",
  "src/manifest.json",
  ...readdirSync("docs/exchange-assets")
    .filter((name) => name.endsWith(".txt"))
    .map((name) => join("docs/exchange-assets", name).replace(/\\/g, "/"))
];

// "Photoshop" followed by a generic noun it would be modifying.
const ADJECTIVE_USE =
  /\bphotoshop[\s-]+(?:uxp[\s-]+)?(?:plug-?ins?|panels?|uxp|layers?|documents?|selections?|canvas(?:es)?|extensions?|add-?ons?|ai|files?)\b/gi;

export function findBrandWordingSlips(text: string) {
  const slips: Array<{ line: number; match: string }> = [];

  text.split(/\r?\n/).forEach((lineText, index) => {
    for (const match of lineText.matchAll(ADJECTIVE_USE)) {
      slips.push({ line: index + 1, match: match[0] });
    }
  });

  return slips;
}

describe("brand wording in public copy", () => {
  it("covers files that exist", () => {
    expect(PUBLIC_COPY.filter((path) => !existsSync(path))).toEqual([]);
  });

  it("never uses Photoshop as an adjective", () => {
    const slips = PUBLIC_COPY.flatMap((path) =>
      findBrandWordingSlips(readFileSync(path, "utf8")).map((slip) => `${path}:${slip.line} "${slip.match}"`)
    );

    expect(slips).toEqual([]);
  });

  it("recognises the forms Adobe objected to, and allows the approved one", () => {
    expect(findBrandWordingSlips("A free Photoshop plugin.")).toHaveLength(1);
    expect(findBrandWordingSlips("an open-source Photoshop UXP plugin")).toHaveLength(1);
    expect(findBrandWordingSlips("as an editable Photoshop layer")).toHaveLength(1);
    expect(findBrandWordingSlips("Photoshop-plugin")).toHaveLength(1);
    expect(findBrandWordingSlips("a free plugin for Photoshop that runs ComfyUI")).toEqual([]);
    expect(findBrandWordingSlips("a layer in Photoshop; open Photoshop and click")).toEqual([]);
  });
});
