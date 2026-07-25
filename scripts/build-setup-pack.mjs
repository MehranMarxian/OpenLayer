import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import { writeZip } from "./lib/zipWriter.mjs";

/**
 * Builds the ComfyUI setup pack: a zip that takes a machine with bare ComfyUI
 * to "OpenLayer works".
 *
 * Everything in it is generated from `src/comfy/setupManifest.ts`, which reads
 * the preset registry. That is the whole point — a setup guide maintained by
 * hand drifts from the software the first time a preset changes, and a setup
 * guide that is wrong about which folder a model goes in is worse than none.
 *
 * The pack contains no model weights. They are tens of gigabytes and two of
 * them are licence-restricted; it ships workflows, an exact requirements list,
 * and a downloader.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const packagesDir = resolve(root, "packages");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const version = packageJson.version;

/**
 * The manifest lives in TypeScript so the panel can import it later. Node
 * cannot load it directly (extensionless relative imports), so bundle it with
 * the Vite already in devDependencies rather than adding a build dependency.
 */
async function loadSetupManifestModule() {
  const outDir = await mkdtemp(join(tmpdir(), "openlayer-setup-pack-"));

  await build({
    configFile: false,
    logLevel: "error",
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      lib: {
        entry: resolve(root, "src/comfy/setupManifest.ts"),
        formats: ["es"],
        fileName: () => "setupManifest.mjs"
      }
    }
  });

  const module = await import(pathToFileURL(join(outDir, "setupManifest.mjs")).href);
  await rm(outDir, { recursive: true, force: true });
  return module;
}

const { buildSetupManifest, formatBytes } = await loadSetupManifestModule();
const manifest = buildSetupManifest({ pluginVersion: version });

function renderRequirementsMarkdown() {
  const lines = [];

  lines.push(`# OpenLayer ${manifest.pluginVersion} — ComfyUI Requirements`);
  lines.push("");
  lines.push(
    "Generated from OpenLayer's preset registry. Do not edit by hand — regenerate with `npm run setup-pack`."
  );
  lines.push("");
  lines.push(
    `${manifest.totals.presets} runnable presets need ${manifest.totals.models} models ` +
      `(${formatBytes(manifest.totals.knownDownloadBytes)} of downloads) and ` +
      `${manifest.customNodes.length} custom node package${manifest.customNodes.length === 1 ? "" : "s"}.`
  );
  lines.push("");

  lines.push("## Put each file in the right folder");
  lines.push("");
  lines.push(
    "This is the mistake that costs people the most time. ComfyUI reads each loader from exactly one " +
      "folder. A model in the wrong folder is not a warning — it is simply invisible, and OpenLayer can " +
      "only report that the model is missing."
  );
  lines.push("");
  lines.push("| Model | Goes in | Size | Loaded by |");
  lines.push("| --- | --- | --- | --- |");

  for (const model of manifest.models) {
    const size = model.layout === "repo-folder" ? "repository" : formatBytes(model.sizeBytes ?? 0);
    lines.push(`| \`${model.modelName}\` | \`${model.targetPath}/\` | ${size} | \`${model.loaderNode}\` |`);
  }

  lines.push("");
  lines.push("## Custom nodes");
  lines.push("");

  if (manifest.customNodes.length === 0) {
    lines.push("None. Every node these workflows use ships with core ComfyUI.");
  } else {
    lines.push("Clone these into `ComfyUI/custom_nodes/` (or install them through ComfyUI-Manager):");
    lines.push("");

    for (const node of manifest.customNodes) {
      lines.push(`- **${node.name}** — ${node.repoUrl}`);
      lines.push(`  - provides: ${node.classTypes.map((entry) => `\`${entry}\``).join(", ")}`);
      lines.push(`  - needed by: ${node.usedByPresets.join(", ")}`);
    }
  }

  lines.push("");

  const gated = manifest.models.filter((model) => model.licenseGate);

  if (gated.length > 0) {
    lines.push("## Licence-restricted models");
    lines.push("");
    lines.push(
      "The downloader will not fetch these without an explicit flag. Read the terms first — they are " +
        "not the usual permissive model licences."
    );
    lines.push("");

    for (const model of gated) {
      lines.push(`- \`${model.modelName}\` — ${model.licenseGate.name}`);
      lines.push(`  - ${model.licenseGate.summary}`);
      lines.push(`  - terms: ${model.licenseGate.url}`);
    }

    lines.push("");
  }

  lines.push("## What each preset needs");
  lines.push("");

  for (const preset of manifest.presets) {
    lines.push(`### ${preset.id}`);
    lines.push("");
    lines.push(preset.description);
    lines.push("");
    lines.push(`- workflow: \`${preset.workflowFile}\``);

    // Several presets name a source workflow the repository never exported.
    // Listing one that is not in the zip sends people looking for a file that
    // does not exist, so only shipped sources are advertised.
    if (preset.sourceWorkflowFile && shippedFilePaths.has(preset.sourceWorkflowFile)) {
      lines.push(`- editable source: \`${preset.sourceWorkflowFile}\``);
    }

    if (preset.modelKeys.length === 0) {
      lines.push("- models: none pinned — pick any compatible checkpoint you already have.");
    } else {
      lines.push("- models:");

      for (const key of preset.modelKeys) {
        const model = manifest.models.find((entry) => entry.key === key);

        if (!model) {
          continue;
        }

        const accepted = model.acceptedModelNames?.length
          ? ` (also accepts ${model.acceptedModelNames.map((entry) => `\`${entry}\``).join(", ")})`
          : "";
        lines.push(`  - \`${model.modelName}\` → \`${model.targetPath}/\`${accepted}`);
      }
    }

    lines.push(
      `- custom nodes: ${preset.customNodePackages.length > 0 ? preset.customNodePackages.join(", ") : "none"}`
    );
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderReadme() {
  return `# OpenLayer ComfyUI Setup Pack — ${manifest.pluginVersion}

This pack gets a machine that already runs ComfyUI to the point where OpenLayer works.

**It contains no model weights.** The models are tens of gigabytes, and two of them are
licence-restricted, so shipping them here would be both impractical and wrong. What you get is the
exact list of what to install, where each file goes, the workflows themselves, and a downloader.
You will need an internet connection.

## What is in here

| Path | What it is |
| --- | --- |
| \`REQUIREMENTS.md\` | Human-readable: every model, its exact target folder, and every custom node repo |
| \`requirements.json\` | The same information, machine-readable |
| \`Install-OpenLayerModels.ps1\` | Downloads the models into the right folders, skipping ones you already have |
| \`workflows/api/\` | The workflows OpenLayer actually submits |
| \`workflows/source/\` | The same graphs in ComfyUI's editable format, for inspection |

## 1. Install the custom nodes

See the Custom nodes section of \`REQUIREMENTS.md\`. Clone each repository into
\`ComfyUI/custom_nodes/\` and restart ComfyUI.

## 2. Download the models

\`\`\`powershell
./Install-OpenLayerModels.ps1 -ComfyUIRoot "C:\\path\\to\\ComfyUI"
\`\`\`

Add \`-WhatIf\` first to see what it would fetch without downloading anything. Files that already
exist are skipped, so it is safe to re-run after an interrupted download.

Licence-restricted models are skipped unless you pass \`-AcceptLicenseRestrictedModels\`. Read the
terms linked in \`REQUIREMENTS.md\` before you do.

If your ComfyUI uses \`extra_model_paths.yaml\` to keep models on another drive, point
\`-ComfyUIRoot\` at the root that owns the folders you want written, or move the files yourself
using the folder table in \`REQUIREMENTS.md\`.

## 3. Start ComfyUI on port ${manifest.comfyui.defaultPort}

OpenLayer defaults to \`http://127.0.0.1:${manifest.comfyui.defaultPort}\` so it does not collide with another plugin
already using ComfyUI on 8188.

\`\`\`powershell
python main.py --listen 127.0.0.1 --port ${manifest.comfyui.defaultPort}
\`\`\`

If you already run ComfyUI on 8188 for something else, start a second instance on
${manifest.comfyui.defaultPort} rather than moving the first one. OpenLayer can also be pointed at a different port
from its Settings screen.

## 4. Check it from OpenLayer

1. Open the OpenLayer panel in Photoshop.
2. Click **Check ComfyUI**. It should report the server version.
3. Open **Settings → Check Workflow Health**. Every preset whose models you installed should read
   as ready. Anything still missing is named explicitly, with the folder it belongs in.

## Regenerating this pack

It is generated from OpenLayer's preset registry, so it cannot drift from the plugin:

\`\`\`powershell
npm run setup-pack
\`\`\`

Generated ${manifest.generatedAt} for OpenLayer ${manifest.pluginVersion}.
`;
}

const DOWNLOADER = String.raw`<#
.SYNOPSIS
    Downloads the ComfyUI models OpenLayer needs, into the folders ComfyUI reads them from.

.DESCRIPTION
    Reads requirements.json (generated from OpenLayer's preset registry) and fetches each model
    into its target folder under the given ComfyUI root. Files that already exist are skipped,
    so an interrupted run can simply be repeated.

    Licence-restricted models are skipped unless -AcceptLicenseRestrictedModels is passed.
    Models published as a repository folder rather than a single file are reported with
    instructions instead of being downloaded, because fetching one file of such a model
    produces a broken install that looks complete.

.EXAMPLE
    ./Install-OpenLayerModels.ps1 -ComfyUIRoot "C:\ComfyUI" -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string] $ComfyUIRoot,

    [switch] $AcceptLicenseRestrictedModels,

    [string] $ManifestPath = (Join-Path $PSScriptRoot 'requirements.json')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ComfyUIRoot)) {
    throw "ComfyUI root not found: $ComfyUIRoot"
}

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    throw "requirements.json not found: $ManifestPath"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json

Write-Host ""
Write-Host "OpenLayer $($manifest.pluginVersion) - ComfyUI model setup"
Write-Host "ComfyUI root: $ComfyUIRoot"
Write-Host ""

$downloaded = 0
$skipped = 0
$gatedSkipped = 0
$manual = 0
$failed = @()

foreach ($model in $manifest.models) {
    $targetDir = Join-Path $ComfyUIRoot ($model.targetPath -replace '/', '\')
    $targetFile = Join-Path $targetDir $model.modelName

    if ($model.layout -eq 'repo-folder') {
        if (Test-Path -LiteralPath $targetFile) {
            Write-Host "[have] $($model.modelName)"
            $skipped++
        }
        else {
            Write-Host "[manual] $($model.modelName) is a repository folder, not a single file."
            Write-Host "         git clone $($model.sourcePageUrl) ""$targetFile"""
            $manual++
        }

        continue
    }

    if (Test-Path -LiteralPath $targetFile) {
        $existing = (Get-Item -LiteralPath $targetFile).Length

        if ($model.sizeBytes -and $existing -ne $model.sizeBytes) {
            Write-Warning "$($model.modelName) exists but is $existing bytes, expected $($model.sizeBytes). Leaving it alone - delete it and re-run to replace."
        }
        else {
            Write-Host "[have] $($model.modelName)"
        }

        $skipped++
        continue
    }

    if ($model.licenseGate -and -not $AcceptLicenseRestrictedModels) {
        Write-Host "[licence] $($model.modelName) - $($model.licenseGate.name)"
        Write-Host "          $($model.licenseGate.summary)"
        Write-Host "          Terms: $($model.licenseGate.url)"
        Write-Host "          Re-run with -AcceptLicenseRestrictedModels to download it."
        $gatedSkipped++
        continue
    }

    if (-not $model.downloadUrl) {
        Write-Host "[manual] $($model.modelName) has no direct download. See $($model.sourcePageUrl)"
        $manual++
        continue
    }

    if (-not $PSCmdlet.ShouldProcess($targetFile, "Download $($model.modelName)")) {
        continue
    }

    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }

    $partial = "$targetFile.partial"
    Write-Host "[get]  $($model.modelName) -> $($model.targetPath)/"

    try {
        # Downloading to .partial first means an interrupted run never leaves a
        # truncated file that looks installed to both this script and ComfyUI.
        Invoke-WebRequest -Uri $model.downloadUrl -OutFile $partial -UseBasicParsing

        if ($model.sizeBytes) {
            $actual = (Get-Item -LiteralPath $partial).Length

            if ($actual -ne $model.sizeBytes) {
                Remove-Item -LiteralPath $partial -Force
                throw "size mismatch: got $actual bytes, expected $($model.sizeBytes)"
            }
        }

        Move-Item -LiteralPath $partial -Destination $targetFile -Force
        $downloaded++
    }
    catch {
        if (Test-Path -LiteralPath $partial) {
            Remove-Item -LiteralPath $partial -Force
        }

        Write-Warning "Failed: $($model.modelName) - $($_.Exception.Message)"
        $failed += $model.modelName
    }
}

Write-Host ""
Write-Host "Downloaded: $downloaded   Already present: $skipped   Licence-gated: $gatedSkipped   Manual: $manual"

if ($manifest.customNodes.Count -gt 0) {
    Write-Host ""
    Write-Host "Custom nodes still to install into $ComfyUIRoot\custom_nodes:"

    foreach ($node in $manifest.customNodes) {
        Write-Host "  git clone $($node.repoUrl)"
    }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Warning "These did not download: $($failed -join ', '). Re-run to retry."
    exit 1
}
`;

async function collectWorkflowFiles() {
  const entries = [];

  for (const folder of ["api", "source"]) {
    const dir = resolve(root, "src/workflows", folder);
    const names = await readdir(dir);

    for (const name of names) {
      entries.push({
        path: `workflows/${folder}/${name}`,
        data: await readFile(join(dir, name))
      });
    }
  }

  return entries;
}

const workflowEntries = await collectWorkflowFiles();
const shippedFilePaths = new Set(workflowEntries.map((entry) => entry.path));

// A runnable preset without its API workflow would produce a pack that cannot
// run that preset, so this is fatal rather than a warning.
const missingWorkflows = manifest.presets
  .map((preset) => preset.workflowFile)
  .filter((file) => !shippedFilePaths.has(file));

if (missingWorkflows.length > 0) {
  throw new Error(`Setup pack is missing workflow files for: ${missingWorkflows.join(", ")}`);
}

// Missing GUI sources are only a documentation gap — the presets still run —
// but they are worth reporting rather than silently papering over.
const missingSources = manifest.presets
  .map((preset) => preset.sourceWorkflowFile)
  .filter((file) => file && !shippedFilePaths.has(file));

if (missingSources.length > 0) {
  console.warn(
    `  note: ${missingSources.length} preset(s) name a GUI source workflow that was never exported ` +
      `(${missingSources.join(", ")}); omitted from REQUIREMENTS.md`
  );
}

const zipEntries = [
  { path: "README.md", data: renderReadme() },
  { path: "REQUIREMENTS.md", data: renderRequirementsMarkdown() },
  { path: "requirements.json", data: `${JSON.stringify(manifest, null, 2)}\n` },
  { path: "Install-OpenLayerModels.ps1", data: DOWNLOADER },
  ...workflowEntries
];

await mkdir(packagesDir, { recursive: true });
const zipPath = resolve(packagesDir, `openlayer-comfyui-setup-${version}.zip`);
await rm(zipPath, { force: true });
await writeZip(zipPath, zipEntries);

console.log(`Created ${zipPath}`);
console.log(
  `  ${zipEntries.length} files | ${manifest.totals.presets} presets | ${manifest.totals.models} models ` +
    `(${formatBytes(manifest.totals.knownDownloadBytes)}) | ${manifest.customNodes.length} custom node packages`
);
console.log(`  workflows: ${workflowEntries.map((entry) => basename(entry.path)).length} files`);
