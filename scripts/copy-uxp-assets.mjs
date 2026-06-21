import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const assets = [
  ["src/manifest.json", "dist/manifest.json"],
  ["src/icons", "dist/icons"],
  ["src/workflows", "dist/workflows"]
];

for (const [from, to] of assets) {
  const source = resolve(root, from);
  const target = resolve(root, to);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}

const indexPath = resolve(root, "dist/index.html");
const indexHtml = await readFile(indexPath, "utf8");
await writeFile(
  indexPath,
  indexHtml
    .replace('<script type="module" crossorigin src=', "<script defer src=")
    .replace('<link rel="stylesheet" crossorigin href=', '<link rel="stylesheet" href='),
  "utf8"
);

console.log("Copied UXP assets to dist.");
