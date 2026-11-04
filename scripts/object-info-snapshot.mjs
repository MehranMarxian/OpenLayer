import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Records, or checks against, the parts of ComfyUI's /object_info that OpenLayer
 * depends on. Beta gate G1 (roadmap U2).
 *
 *   node scripts/object-info-snapshot.mjs [serverUrl]           record tests/fixtures/comfyui-object-info.json
 *   node scripts/object-info-snapshot.mjs --check [serverUrl]   diff a live ComfyUI against the recording
 *
 * Only the node classes OpenLayer uses are kept: every class_type in the bundled
 * API workflows, every classType the preset registry requires, and every
 * class_type the TypeScript builds itself (Live Painting, the LoRA splice). For
 * each input the snapshot keeps its type and, for a fixed list of choices such
 * as a sampler or scheduler, the choices -- but never a list of model files,
 * which differs on every machine. Nested inputs (ComfyUI's dynamic combo and
 * autogrow inputs, written "parent.child" in a workflow) keep the names they
 * allow. tests/comfy/objectInfoSnapshot.test.ts checks the presets against it.
 *
 * Read-only against ComfyUI: one GET of /object_info and one of /system_stats.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const snapshotPath = resolve(root, "tests/fixtures/comfyui-object-info.json");
const args = process.argv.slice(2);
const checkMode = args.includes("--check");
const serverUrl = (args.find((arg) => !arg.startsWith("--")) ?? "http://127.0.0.1:8188").replace(/\/+$/, "");

const FILE_LIKE = /\.(safetensors|pt|pth|gguf|ckpt|bin|onnx|png|jpe?g|webp|json|ya?ml)$/i;

// "Class.input" -> the literal values the bundled workflows set on it, so a
// choice removed upstream only fails the check when a preset uses it.
const usedChoices = new Map();

async function usedClasses() {
  const classes = new Set();
  const apiDir = resolve(root, "src/workflows/api");

  for (const name of await readdir(apiDir)) {
    if (!name.endsWith(".json")) continue;
    const workflow = JSON.parse(await readFile(join(apiDir, name), "utf8"));
    for (const node of Object.values(workflow)) {
      if (!node || typeof node !== "object" || typeof node.class_type !== "string") continue;
      classes.add(node.class_type);
      for (const [input, value] of Object.entries(node.inputs ?? {})) {
        if (typeof value !== "string" || value === "") continue;
        const key = `${node.class_type}.${input}`;
        if (!usedChoices.has(key)) usedChoices.set(key, new Set());
        usedChoices.get(key).add(value);
      }
    }
  }

  const comfyDir = resolve(root, "src/comfy");
  for (const name of await readdir(comfyDir)) {
    if (!name.endsWith(".ts")) continue;
    const source = await readFile(join(comfyDir, name), "utf8");
    for (const match of source.matchAll(/class(?:_t|T)ype: "([^"]+)"/g)) classes.add(match[1]);
  }

  return [...classes].sort();
}

function choicesOf(spec) {
  if (Array.isArray(spec) && Array.isArray(spec[0])) return spec[0];
  if (Array.isArray(spec) && spec[0] === "COMBO" && Array.isArray(spec[1]?.options)) return spec[1].options;
  return null;
}

function summarizeInput(spec) {
  const type = Array.isArray(spec) ? spec[0] : spec;

  if (type === "COMFY_DYNAMICCOMBO_V3") {
    const nested = {};
    for (const option of spec[1]?.options ?? []) {
      nested[option.key] = Object.keys({ ...(option.inputs?.required ?? {}), ...(option.inputs?.optional ?? {}) }).sort();
    }
    return { type, nested };
  }

  if (type === "COMFY_AUTOGROW_V3") {
    // ComfyUI 0.44 keeps the slot names ("image_1", ...) under "template".
    return { type, names: spec[1]?.template?.names ?? spec[1]?.names ?? [] };
  }

  const choices = choicesOf(spec);
  if (choices) {
    const fixed = choices.length > 0 && choices.every((choice) => typeof choice === "string" && !FILE_LIKE.test(choice) && !choice.includes("/") && !choice.includes("\\"));
    return fixed ? { type: "COMBO", choices } : { type: "COMBO" };
  }

  return { type: typeof type === "string" ? type : "UNKNOWN" };
}

function summarizeNode(info) {
  const inputs = {};
  for (const [name, spec] of Object.entries({ ...(info.input?.required ?? {}), ...(info.input?.optional ?? {}) })) {
    inputs[name] = summarizeInput(spec);
  }
  return { inputs };
}

async function fetchJson(path) {
  const response = await fetch(`${serverUrl}${path}`);
  if (!response.ok) throw new Error(`${serverUrl}${path} answered HTTP ${response.status}`);
  return response.json();
}

const classes = await usedClasses();
const [objectInfo, systemStats] = await Promise.all([fetchJson("/object_info"), fetchJson("/system_stats")]);
const live = {
  comfyuiVersion: systemStats.system?.comfyui_version ?? "unknown",
  recordedAt: new Date().toISOString().slice(0, 10),
  missingClasses: classes.filter((name) => !objectInfo[name]),
  nodes: Object.fromEntries(classes.filter((name) => objectInfo[name]).map((name) => [name, summarizeNode(objectInfo[name])]))
};

// process.exitCode rather than process.exit(): exiting while fetch's sockets
// are still closing trips a libuv assertion on Windows.
if (!checkMode) {
  await writeFile(snapshotPath, `${JSON.stringify(live, null, 2)}\n`);
  console.log(`Recorded ${Object.keys(live.nodes).length} node classes from ComfyUI ${live.comfyuiVersion} at ${serverUrl}.`);
  if (live.missingClasses.length > 0) console.log(`Not installed there: ${live.missingClasses.join(", ")}.`);
} else {
  process.exitCode = checkAgainstSnapshot(JSON.parse(await readFile(snapshotPath, "utf8"))) ? 0 : 1;
}

function checkAgainstSnapshot(recorded) {
  const problems = [];
  const notes = [];
  let unusedChoicesGone = 0;

  for (const missing of recorded.missingClasses ?? []) {
    notes.push(`${missing}: was not installed when the snapshot was recorded`);
  }

  for (const [name, node] of Object.entries(recorded.nodes)) {
    const now = live.nodes[name];
    if (!now) {
      problems.push(`${name}: class is not there (a core node renamed, or its node pack is not installed)`);
      continue;
    }
    for (const [input, spec] of Object.entries(node.inputs)) {
      const current = now.inputs[input];
      if (!current) {
        problems.push(`${name}.${input}: input is gone`);
        continue;
      }
      for (const choice of spec.choices ?? []) {
        if (!current.choices || current.choices.includes(choice)) continue;
        if (usedChoices.get(`${name}.${input}`)?.has(choice)) problems.push(`${name}.${input}: choice "${choice}" is gone, and a preset uses it`);
        else unusedChoicesGone += 1;
      }
      for (const [key, names] of Object.entries(spec.nested ?? {})) {
        const nowNames = current.nested?.[key];
        if (!nowNames) problems.push(`${name}.${input}: option "${key}" is gone`);
        else for (const child of names) if (!nowNames.includes(child)) problems.push(`${name}.${input}.${child}: nested input is gone`);
      }
    }
    for (const input of Object.keys(now.inputs)) {
      if (!node.inputs[input]) notes.push(`${name}.${input}: new input`);
    }
  }

  console.log(`Snapshot: ComfyUI ${recorded.comfyuiVersion} (${recorded.recordedAt}). Live: ComfyUI ${live.comfyuiVersion} at ${serverUrl}.`);
  console.log(problems.length === 0 ? "Nothing OpenLayer uses is missing." : `Missing, and OpenLayer uses it:\n  ${problems.join("\n  ")}`);
  if (unusedChoicesGone > 0) console.log(`${unusedChoicesGone} choice(s) no preset uses are also missing there (harmless).`);
  if (notes.length > 0) console.log(`Notes:\n  ${notes.join("\n  ")}`);
  return problems.length === 0;
}
