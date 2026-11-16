# Advisor notes: the hard decisions left before and after the beta

Written 2026-11-16 by the Fable 5.2 advisor, for the sessions that build next (probably a weaker
model). It does not restate [the plan](plan-beta-and-beyond.md) or [the UI audit](ui-audit-ps28.md).
Read those first. Each note below is a rule, a check, a stop condition and a link.

**Trust levels.** Anything marked **UNVERIFIED** was not read from the repo or run in Photoshop. It
is a thing to check, not a fact. Every "grep before you swap" item is a check to run and record,
not a claim that the code has the problem.

## 0. The one hard task: the native-button fix (R1) is the critical path

Photoshop 28 paints every native `<button>` grey, so G7 fails on every screen
([audit](ui-audit-ps28.md) §1, R1). The audit's fix plan is U0, U1a, U1b, U1c, U2
([audit](ui-audit-ps28.md) §5). Everything else on the roadmap waits behind it.

### Decision for Mehran (flag it, do not decide it)

The beta plan's fallback rule ([plan](plan-beta-and-beyond.md), decision 1) says G5 and G7 may drop
to Wanted on 2026-12-01 if no outside report exists. That rule was written for "no tester
appeared". G7 now has a report, and the report is a failure. **Recommendation: a known break on
the newest Photoshop cannot drop to Wanted.** If U1a and U1b are not merged by 12-01, the beta
slips a week; it does not ship with grey Generate buttons. U1c (buttons made in code) is the only
part the audit allows to slip, with a release note.
`docs/beta-gate.md` still has no G7 row. The first PR that touches it adds one.

### Scope rule: pre-beta is the minimum

- **In:** the shared div-button primitive (U1a), toggles, chips and disclosures (U1b), buttons made
  in code (U1c), and the copy fixes (U2). Mechanical tag swaps with explicit state colours.
- **Out until after the beta:** tokens everywhere, two complete themes, Home regroup, the Look
  picker, minimum width, consistency (audit U3 to U8).
- **Why:** 134 buttons at one PR per screen cannot also carry a redesign by 12-08.
- **Stop condition:** a pre-beta PR that adds a new visual idea (a new colour, size or layout) is
  out of scope. Split that part out and park it.

### Order of work

1. **Make selectors tag-agnostic first.** Change CSS and script selectors that name `button` so
   they match both tags. Prove nothing changed with a capture on Photoshop 2025, where native
   buttons still draw correctly. This PR changes no markup.
2. **Then swap screen by screen,** starting with the Generate path (Text to Image). One PR per
   area, the audit's U1a, U1b, U1c split.
3. **Stop condition for each swap:** the Photoshop 2025 capture differs from the baseline in
   anything but the button face, or a Tab then Enter or Space does not activate the control.

### Grep before each swap, and write the results in the PR

Run each, paste the hit list or "no hits", and say what you did about each hit.

- CSS and `querySelector` calls keyed on the `button` tag, on `button[aria-pressed]`, or on
  `:disabled`. Compact theme rules are often `!important`
  ([CLAUDE.md](../CLAUDE.md), UXP traps).
- `.disabled =` reads and writes. On a `div` they silently do nothing. The app uses
  `setActionDisabled` and ARIA ([audit](ui-audit-ps28.md) §1, item 2); every hit that bypasses it
  needs converting.
- `HTMLButtonElement` checks and `instanceof` tests.
- The 20 `createElement("button")` sites listed in R1. **UNVERIFIED** whether each one goes
  through `setActionDisabled`.
- Agent Bridge selectors and the jsdom tests that look up buttons by tag.
  **UNVERIFIED** which ones exist. `tests/scripts/agentProtocolParity.test.ts` and
  `npm run test:e2e` are the first places to look.
- Keyboard: Enter and Space activate a div button, and audit check S7 (a mouse click does not give
  a div focus on Photoshop 28) still holds. A control that is only reachable by mouse is a
  regression.

### Hosts that are still unchecked (G5 and W1 depend on this)

Div buttons and the `--uxp-host-*` variables are **UNVERIFIED** on Photoshop 2024, on macOS and at
the three lighter Photoshop brightness levels ([audit](ui-audit-ps28.md) §2, "Not checked").

- **Rule:** every `var(--uxp-host-…)` has a fallback colour. A missing variable must give a
  readable button, not a transparent one.
- **Ask:** the G5 and W1 testers send one capture of the hidden UI sheet (PR #183). **UNVERIFIED**
  how a tester opens it: the audit says Settings then Diagnostics. Check the click path on a clean
  build before putting it in a tester ask. If a tester cannot reach it in two clicks, ask for a
  capture of Text to Image instead.
- **Stop condition:** if the sheet on 2024 or macOS shows a div button with no visible face, do not
  merge the swap PR that depends on it. Report to Mehran.

## 1. Post-beta hard items: each gets a go/no-go rule, not a design

These are in [the plan](plan-beta-and-beyond.md) §5, post-beta. Do not start any of them before the
beta is tagged and Mehran says "go".

### Guided custom workflow run (plan item 7, answers issue 179)

- **Rule:** a spike first, in one PR that adds no UI.
- **Check:** a pasted real graph (the plan names a Flux Fill GGUF one) is mapped to prompt, image,
  mask and seed inputs, validated against `/object_info`, run, and the result imported.
- **Go:** the mapping is found automatically for the graph, with no hand-editing.
- **No-go:** it needs a per-graph rule, or it runs a node the registry has never validated. Then
  stop, write what failed, and leave Custom Workflow as validate-only.

### Result-named presets and licence badges

- **Rule:** a preset name is a promise. No name ships without a side-by-side image of the preset
  against its closest alternative, shown to Mehran
  (the NitroFusion2 lesson, [plan](plan-beta-and-beyond.md) §4).
- **Rule:** badges come from the registry's `licenseGate` and an explicit `licenceClass` field,
  never from the model's name.
- **Check:** a test fails if any gated or non-commercial model carries "Free for client work".
- **Stop condition:** a model whose licence could not be read from its Hugging Face card is badged
  "Read the licence", never "free".

### `App.ts` extraction (R8)

- **Rule:** byte-identical moves only, one tool per PR, behind the existing
  `generation.runPipeline` contract. No behaviour change, no renaming, no cleanup in the same PR.
- **Check:** a diff of the moved block against its old location shows only the import and export
  lines changed. The four checks pass, and the smoke block for that tool passes in Photoshop.
- **Stop condition:** a moved function needs an edit to work. Stop and report; do not edit it
  inside the move.

### Qwen selection edit (cut from v0.35)

- **Decision measurement:** the join of an edited region against the untouched ring in a smooth
  sky, on at least three real photos ([roadmap](roadmap.md), "What is being worked on").
- **Go:** matching colour from the untouched ring only makes the join invisible on the sky photo
  and does not worsen the busy photos.
- **No-go:** the join is still visible on the sky. Leave it cut; Qwen 2.1 remains research-only
  anyway, so it is never a client-work path.

### Unflatten background quality

- **Decision measurement:** the fill behind a removed subject, judged against the original, using
  the 640 px x4 setting from the gate findings (never offer 1024; see
  [unflatten gate findings](unflatten-gate-findings.md)).
- **Go:** a masked inpaint pass over the background, using the crop-and-stitch stacks already
  shipped, gives an acceptable fill on a complex scene.
- **No-go:** it only works on flat ground. Then the tool stays experimental and says so.

## 2. Rules that hold for every session

- One task, one branch, one PR, then stop ([CLAUDE.md](../CLAUDE.md)). Feature freeze holds until
  the beta is tagged.
- Never approve a look from a browser mockup. Components are proved in the real panel on
  Photoshop 28 and 2025 ([audit](ui-audit-ps28.md) §1 and §4).
- Never state a test result that was not run. Mark it unverified.
- Never capture the desktop or the Prompt Wallet screen.
