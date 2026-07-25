import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const assets = [
  ["src/manifest.json", "dist/manifest.json"],
  ["src/icons", "dist/icons"],
  ["src/workflows", "dist/workflows"],
  // Claims the panel entrypoints ahead of the bundle. Vite leaves the plain
  // <script src> tag in index.html alone but does not treat the file as an
  // input, so it has to be copied here.
  ["src/panelBootstrap.js", "dist/panelBootstrap.js"]
];

for (const [from, to] of assets) {
  const source = resolve(root, from);
  const target = resolve(root, to);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}

const indexPath = resolve(root, "dist/index.html");
const indexHtml = await readFile(indexPath, "utf8");
const patchedHtml = indexHtml
  .replace('<script type="module" crossorigin src=', "<script defer src=")
  .replace('<link rel="stylesheet" crossorigin href=', '<link rel="stylesheet" href=');

await writeFile(indexPath, patchedHtml, "utf8");

/*
 * The second panel only initialises if panelBootstrap.js runs before the bundle
 * and is not deferred (see the file's own comment for why). Both properties are
 * easy to break from a distance — a Vite upgrade that starts hashing plain
 * script tags, or someone tidying the copy list above — and the failure mode is
 * a silently blank panel in Photoshop rather than a build error. So assert them.
 */
const bootstrapTag = '<script src="./panelBootstrap.js"></script>';

if (!patchedHtml.includes(bootstrapTag)) {
  throw new Error(
    `dist/index.html is missing the exact early bootstrap tag ${bootstrapTag}. ` +
      "The second panel cannot initialise without it."
  );
}

if (patchedHtml.indexOf(bootstrapTag) > patchedHtml.indexOf("<script defer src=")) {
  throw new Error("panelBootstrap.js must be loaded before the application bundle.");
}

await access(resolve(root, "dist/panelBootstrap.js"));

console.log("Copied UXP assets to dist.");
