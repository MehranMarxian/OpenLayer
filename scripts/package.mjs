import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const packagesDir = resolve(root, "packages");
const zipPath = resolve(packagesDir, "openlayer-v0.1.6.zip");

await mkdir(packagesDir, { recursive: true });
await rm(zipPath, { force: true });

if (process.platform === "win32") {
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${resolve(root, "dist")}\\*' -DestinationPath '${zipPath}' -Force`
  ]);
} else {
  await execFileAsync("zip", ["-r", zipPath, "."], { cwd: resolve(root, "dist") });
}

console.log(`Created ${zipPath}`);
