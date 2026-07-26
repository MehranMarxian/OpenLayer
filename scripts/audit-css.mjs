// Measures src/styles.css and regenerates docs/css-audit.md.
//
// Read-only with respect to the stylesheet: it parses, counts, and writes a
// report. It changes no CSS. Run it with `npm run audit-css` after any styling
// work so the numbers in the doc stay honest.
//
// The one judgement call encoded here is the dynamic-class rule. Several class
// names are assembled at runtime (`is-${card.status}`, `is-${item.state}`,
// `is-${card.state}`), so a plain text search reports them as unused when they
// are not. Anything matching a dynamic prefix is reported separately and never
// listed as dead.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles.css"), "utf8");
const lines = css.split(/\r?\n/);

const sourceFiles = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs|html|json)$/.test(name)) sourceFiles.push(full);
  }
}
walk(join(root, "src"));
walk(join(root, "scripts"));
const sourceText = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");

// Blank comments in place so line numbers stay true.
const blanked = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

const rules = [];
const ruleRegex = /([^{}]+)\{([^{}]*)\}/g;
let match;
while ((match = ruleRegex.exec(blanked))) {
  const prelude = match[1].trim();
  if (!prelude || prelude.startsWith("@")) continue;
  const startLine = blanked.slice(0, match.index).split("\n").length;
  const endLine = blanked.slice(0, match.index + match[0].length).split("\n").length;
  rules.push({ selectors: prelude, body: match[2], lineCount: endLine - startLine + 1 });
}

const normalize = (selector) => selector.trim().replace(/\s+/g, " ");

const selectorCounts = new Map();
for (const rule of rules) {
  for (const selector of rule.selectors.split(",")) {
    const key = normalize(selector);
    if (key) selectorCounts.set(key, (selectorCounts.get(key) ?? 0) + 1);
  }
}
const repeated = [...selectorCounts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);

const compactRules = rules.filter((rule) => rule.selectors.includes("theme-compact"));
const classicRules = rules.filter((rule) => rule.selectors.includes("theme-classic"));
const baseRules = rules.filter(
  (rule) => !rule.selectors.includes("theme-compact") && !rule.selectors.includes("theme-classic")
);
const sumLines = (list) => list.reduce((total, rule) => total + rule.lineCount, 0);

const compactSelectors = new Set();
for (const rule of compactRules) {
  for (const selector of rule.selectors.split(",")) {
    compactSelectors.add(
      normalize(selector).replace(/^\.app-shell\.theme-compact\s*/, "").replace(/^\.theme-compact\s*/, "")
    );
  }
}
const baseSelectors = new Set();
for (const rule of baseRules) for (const selector of rule.selectors.split(",")) baseSelectors.add(normalize(selector));
const shadowed = [...baseSelectors].filter((selector) => compactSelectors.has(selector));

const importantTotal = (blanked.match(/!important/g) ?? []).length;
const importantInCompact = compactRules.reduce((n, rule) => n + (rule.body.match(/!important/g) ?? []).length, 0);

const classNames = new Set();
for (const found of blanked.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classNames.add(found[1]);

const DYNAMIC_PREFIXES = ["is-"];
const isDynamic = (name) => DYNAMIC_PREFIXES.some((prefix) => name.startsWith(prefix));
const dead = [...classNames].filter((name) => !isDynamic(name) && !sourceText.includes(name)).sort();
const dynamicOnly = [...classNames].filter((name) => isDynamic(name) && !sourceText.includes(name)).sort();
const deadSet = new Set(dead);

const classesIn = (selector) => [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((found) => found[1]);
const deletableRules = rules.filter((rule) => {
  const parts = rule.selectors.split(",").map(normalize).filter(Boolean);
  return parts.length > 0 && parts.every((part) => classesIn(part).some((name) => deadSet.has(name)));
});

const list = (names) => (names.length ? names.map((name) => `\`.${name}\``).join(", ") : "_none_");
const pct = (part, whole) => ((part / whole) * 100).toFixed(1);

const report = `# CSS audit — \`src/styles.css\`

Task 9 of v0.8. **Measurement only: no CSS was changed.** Regenerate with \`npm run audit-css\`;
the numbers come from parsing the stylesheet and cross-referencing every class name against
\`src/\` and \`scripts/\`.

## Size

| | |
|---|---:|
| Lines | ${lines.length} |
| Rule blocks | ${rules.length} |
| Distinct selectors | ${selectorCounts.size} |
| Selectors declared more than once | ${repeated.length} |
| \`!important\` declarations | ${importantTotal} |
| …of those, inside a \`theme-compact\` rule | ${importantInCompact} |

## The two themes

\`theme-compact\` and \`theme-classic\` are both selectable in Settings ("Compact Adobe Dark" and
"Classic v0.4"). Compact is the default and the shipped look. Classic is not a dead code path —
it is what the ${baseRules.length} unscoped rules render.

| | rules | lines |
|---|---:|---:|
| Scoped to \`.theme-compact\` | ${compactRules.length} | ${sumLines(compactRules)} |
| Scoped to \`.theme-classic\` | ${classicRules.length} | ${sumLines(classicRules)} |
| Unscoped (base — what Classic renders) | ${baseRules.length} | ${sumLines(baseRules)} |

${pct(compactRules.length, rules.length)}% of all rules are compact overrides and they carry
${pct(importantInCompact, importantTotal)}% of the \`!important\` in the file. **${shadowed.length}** base selectors have a
\`theme-compact\` counterpart.

That last number is the override tax, and it is the mechanism behind the trap recorded in
\`docs/ORCHESTRATION.md\` §3: a base rule that looks correct is often beaten by a compact
\`!important\` block hundreds of lines further down. Grep \`theme-compact <selector>\` before
concluding a base rule is what renders.

## Most-redeclared selectors

| times | selector |
|---:|---|
${repeated.slice(0, 20).map(([selector, n]) => `| ${n} | \`${selector}\` |`).join("\n")}

## Unreferenced classes

${dead.length} class names appear in the stylesheet and nowhere in \`src/\` or \`scripts/\`. Rules that match
only those names span **${sumLines(deletableRules)} lines across ${deletableRules.length} rule blocks** — roughly ${pct(sumLines(deletableRules), lines.length)}% of the file.

### \`ol-*\` (the pre-v0.5 naming)

${list(dead.filter((name) => name.startsWith("ol-")))}

### Everything else

${list(dead.filter((name) => !name.startsWith("ol-")))}

### Checked, and NOT dead

${dynamicOnly.length} \`is-*\` names never appear as literals because they are assembled at runtime from
\`is-\${card.status}\` (\`ToolCardStatus\`), \`is-\${item.state}\` (\`WorkflowHealthState\`) and
\`is-\${card.state}\` (the diagnostics summary cards). A text search calls them unused. They are
not. Do not delete these:

${list(dynamicOnly)}

## What the numbers say

1. **Deleting the dead classes is the cheap, safe win** — about ${sumLines(deletableRules)} lines, no live selector
   touched. It still needs a real Photoshop pass, because the check is "no literal mention in
   the source", and only the host can prove nothing regressed.
2. **Consolidation is a bigger job than it looks, and it is not deletion.** Both themes ship,
   so the ${shadowed.length} shadowed selectors cannot simply collapse into one rule; that work is merging
   two designs, and it belongs behind a decision about whether Classic still earns its place.
3. **The \`!important\` count is a symptom, not the disease.** ${pct(importantInCompact, importantTotal)}% of it sits in compact
   overrides fighting base rules. It shrinks when the theme layering is fixed, not by editing
   the declarations.
`;

writeFileSync(join(root, "docs/css-audit.md"), report);
console.log(`docs/css-audit.md written — ${lines.length} lines measured, ${dead.length} unreferenced classes, ${sumLines(deletableRules)} deletable lines.`);
