import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeZip } from "./lib/zipWriter.mjs";
import { narrowManifestHostForCcx } from "./lib/ccxManifest.mjs";

/**
 * Builds the plugin zip that is attached to a GitHub Release and loaded through
 * the UXP Developer Tool.
 *
 * This used to shell out to `Compress-Archive` on Windows and `zip` on
 * everything else. PowerShell 5.1's `Compress-Archive` writes entry paths with
 * backslashes, which the ZIP spec forbids: every release zip from v0.1.0 to
 * v0.9.0-alpha stored `assets\index-….js` rather than `assets/index-….js`.
 * Windows Explorer and UDT tolerate that, which is why it survived nine
 * releases unnoticed, but macOS `unzip` does not — it treats the whole string
 * as one filename and unpacks a flat directory with no `assets/` folder, so the
 * plugin simply fails to render. See `docs/DISTRIBUTION_SPIKE.md`, Finding 2.
 *
 * `writeZip` is the same spec-correct writer the setup pack already uses, so
 * both archives now come out of one implementation and neither depends on a
 * platform binary being installed.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(root, "dist");
const packagesDir = resolve(root, "packages");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const releaseLabel = process.env.OPENLAYER_RELEASE_LABEL ?? `v${packageJson.version}-alpha`;
const zipPath = resolve(packagesDir, `openlayer-${releaseLabel}.zip`);

/**
 * Every file under `dist/`, as archive entries rooted at the archive itself —
 * `manifest.json` must sit at the top level for UDT to recognise the plugin.
 * Paths are joined with "/" rather than `path.join` so the archive is identical
 * whichever platform built it.
 *
 * @param {string} directory absolute path to walk
 * @param {string} prefix in-archive path of `directory`, "" at the root
 * @returns {Promise<{ path: string, data: Buffer }[]>}
 */
async function collectEntries(directory, prefix = "") {
  const dirEntries = await readdir(directory, { withFileTypes: true });
  /** @type {{ path: string, data: Buffer }[]} */
  const entries = [];

  // Sorted so entry order is deterministic: readdir order is filesystem order,
  // which differs between machines. This does not make the zip byte-identical
  // across builds — `writeZip` stamps entries with the current time — but it
  // does make two archives diffable entry by entry.
  for (const dirEntry of [...dirEntries].sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = resolve(directory, dirEntry.name);
    const archivePath = prefix ? `${prefix}/${dirEntry.name}` : dirEntry.name;

    if (dirEntry.isDirectory()) {
      entries.push(...(await collectEntries(absolutePath, archivePath)));
      continue;
    }

    entries.push({ path: archivePath, data: await readFile(absolutePath) });
  }

  return entries;
}

const entries = await collectEntries(distDir);

if (!entries.some((entry) => entry.path === "manifest.json")) {
  throw new Error(
    `No manifest.json at the root of ${distDir}. Run \`npm run build\` before packaging — ` +
      "a zip without a top-level manifest is not a loadable UXP plugin."
  );
}

await mkdir(packagesDir, { recursive: true });
await rm(zipPath, { force: true });
await writeZip(zipPath, entries);

console.log(`Created ${zipPath}`);
console.log(`  ${entries.length} files`);

/**
 * The `.ccx` is built from the same entries, because per Finding 1 of
 * `docs/DISTRIBUTION_SPIKE.md` it is the same archive -- Adobe's own packager
 * adds no signature and no metadata. It is written directly rather than by
 * shelling out to `uxp plugin package`, because that CLI talks to the UXP
 * Developer Tool Service on port 14001 and so would require UDT installed on
 * whatever machine builds a release.
 *
 * Whether a double-click actually installs this on a machine that has never had
 * UDT is still unanswered and cannot be answered here -- this machine has UDT,
 * so a success proves nothing. It is built and published anyway: the archive
 * costs nothing to produce, a release asset can be added at any time, and the
 * question has stayed open across three releases precisely because nobody had
 * an artifact to hand someone with a clean machine.
 */
const ccxPath = resolve(packagesDir, `openlayer-${releaseLabel}.ccx`);
const manifestEntry = entries.find((entry) => entry.path === "manifest.json");
const { json: ccxManifestJson, narrowed } = narrowManifestHostForCcx(
  manifestEntry.data.toString("utf8")
);
const ccxEntries = entries.map((entry) =>
  entry.path === "manifest.json"
    ? { path: entry.path, data: Buffer.from(ccxManifestJson, "utf8") }
    : entry
);

await rm(ccxPath, { force: true });
await writeZip(ccxPath, ccxEntries);

console.log(`Created ${ccxPath}`);
console.log(`  ${ccxEntries.length} files${narrowed ? ", host narrowed to a single object" : ""}`);

/**
 * Unversioned copies, byte-identical to the two above, so the README's Download
 * button can point at a URL that never needs a version-number edit:
 * `.../releases/latest/download/openlayer-latest.ccx`. That URL only resolves
 * once a release is explicitly marked "Latest" — every OpenLayer release is a
 * pre-release, and GitHub's automatic "latest" selection skips pre-releases
 * entirely — so `docs/release-checklist.md` carries the `gh release edit --latest`
 * step this file cannot do on its own.
 */
const latestZipPath = resolve(packagesDir, "openlayer-latest.zip");
const latestCcxPath = resolve(packagesDir, "openlayer-latest.ccx");

await rm(latestZipPath, { force: true });
await writeZip(latestZipPath, entries);
await rm(latestCcxPath, { force: true });
await writeZip(latestCcxPath, ccxEntries);

console.log(`Created ${latestZipPath} and ${latestCcxPath} (unversioned copies for the "Latest" release link)`);
