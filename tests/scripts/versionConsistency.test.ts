import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The version number lives in seven places. Keeping them in step was a manual
 * grep (`docs/release-checklist.md` §Version Consistency) until it failed twice
 * in a row without anyone noticing:
 *
 * - **v0.14.0 shipped with the panel reporting v0.13.0.** `APP_VERSION` moved
 *   from `App.ts` to `appConstants.ts` in 51387c0, and the next bump commit's
 *   idea of "all four sites" silently replaced it with `become-a-tester.html`.
 *   That constant is not cosmetic: it is the panel footer, both diagnostics
 *   lines, the `pluginVersion` stamped into history metadata, and the input to
 *   `evaluateSetupRequirements`. A stale one misreports every generation a
 *   tester sends back.
 * - **`package-lock.json` sat at 0.12.0 for two releases**, because it is not a
 *   file anyone opens while cutting a release.
 *
 * Both failures share a cause: the checklist names the *files*, so a location
 * that moves between files stops being checked while the checklist still looks
 * complete. This test names the *values* instead, and reads them out of the
 * real files, so a location can move without escaping the check.
 *
 * `package.json` is the source of truth; everything else is compared to it.
 */

const repoRoot = resolve(__dirname, "..", "..");
const read = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), "utf8");

const packageJson = JSON.parse(read("package.json")) as { version: string };
const version = packageJson.version;

/**
 * Every OpenLayer version string in a file, as `0.15.0`.
 *
 * Deliberately narrow: the docs also carry Photoshop's `25.0.0` minimum and
 * ComfyUI versions, and matching those would make the check meaningless. An
 * OpenLayer version is always written with a `v` prefix (`v0.15.0-alpha`, the
 * release-tag URLs, the zip and ccx filenames) or as the bare quoted
 * `softwareVersion` in the landing page's JSON-LD.
 */
function openLayerVersionsIn(source: string): string[] {
  const prefixed = [...source.matchAll(/v(\d+\.\d+\.\d+)/g)].map((match) => match[1]);
  const softwareVersion = [...source.matchAll(/"(\d+\.\d+\.\d+)-alpha"/g)].map((match) => match[1]);

  return [...prefixed, ...softwareVersion];
}

describe("version consistency", () => {
  it("reads a plain semver out of package.json", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("matches package-lock.json in both of its root-project fields", () => {
    // Two fields describe this package: the top-level one and `packages[""]`.
    // `npm install` rewrites both, but a hand-edited bump reaches neither, and
    // every other `version` in the file belongs to a dependency.
    const lock = JSON.parse(read("package-lock.json")) as {
      version: string;
      packages: Record<string, { version?: string }>;
    };

    expect(lock.version).toBe(version);
    expect(lock.packages[""].version).toBe(version);
  });

  it("matches the UXP manifest, which is what Photoshop installs", () => {
    const manifest = JSON.parse(read("src/manifest.json")) as { version: string };

    expect(manifest.version).toBe(version);
  });

  it("matches APP_VERSION, which is the version a tester can actually see", () => {
    // Asserted against the source text rather than by importing the module,
    // because importing it pulls in the UXP-facing preferences types for a
    // one-line string constant.
    const match = /export const APP_VERSION = "([^"]+)";/.exec(read("src/ui/appConstants.ts"));

    expect(match?.[1]).toBe(version);
  });

  it.each(["docs/index.html", "docs/become-a-tester.html"])(
    "leaves no stale version anywhere in %s",
    (page) => {
      // Both pages are pure shopfront: hero badge, download buttons, release-tag
      // URLs, ccx and zip filenames, footer. Every version they mention is a
      // claim about the *current* release, so any other version is stale by
      // definition. If a release history is ever added to a landing page this
      // will fail loudly — that is the point; relax it deliberately, then.
      const found = new Set(openLayerVersionsIn(read(page)));

      expect([...found]).toEqual([version]);
    }
  );

  it("carries the current version in README's checkpoint line and package filenames", () => {
    // README cannot use the rule above: it keeps a cumulative "Also new in
    // v0.13.0-alpha" history whose old versions are correct and must survive.
    // So it is pinned at the three places that describe the release being cut.
    const readme = read("README.md");

    expect(readme).toContain(`\`v${version}-alpha\` is the current public alpha checkpoint.`);
    expect(readme).toContain(`packages/openlayer-v${version}-alpha.zip`);
    expect(readme).toContain(`packages/openlayer-v${version}-alpha.ccx`);
  });
});
