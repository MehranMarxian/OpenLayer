# Adobe Exchange Readiness Audit (v0.16.0-alpha)

Audited against `src/manifest.json`, `scripts/package.mjs`, `SECURITY.md`, `LICENSE`, CI config,
and Adobe's current Developer Distribution / UXP manifest docs (checked live 2026-08-23; sources
linked inline where a claim is load-bearing). Scope: everything that could make an Adobe reviewer
bounce v0.17.0, organized by how much it costs to fix and how likely it is to actually block
approval.

This is an audit + plan, not a task list someone else already agreed to. Items marked
**[decision needed]** are calls only Mehran can make; everything else is scoped work.

## Severity key

- **BLOCKER** — submission will fail validation or certainly get rejected without this.
- **HIGH** — not an automatic rejection, but a strong rejection/friction risk or a real functional gap a reviewer will hit.
- **MODERATE** — should fix before or shortly after submitting; unlikely to sink the review alone.
- **OK** — checked and already fine; listed so it isn't re-audited later.

---

## 1. Manifest & permissions

**File:** [src/manifest.json](../src/manifest.json)

| # | Finding | Severity | Detail |
|---|---|---|---|
| 1.1 | `id: "com.openlayer.photoshop"` is self-assigned, not issued by Adobe | **BLOCKER** | Adobe's Developer Distribution docs state the manifest `id` must match the ID the portal issues when you create the listing, "or the plugin will not pass the validation step." There is currently no publisher profile or listing, so there is no real ID yet — this has to happen before packaging the submission build. |
| 1.2 | `network.domains: "all"` | **HIGH** | Valid syntax (verified against Adobe's manifest v5 docs — `"all"` is a supported literal, distinct from an array of specific domains), so this won't fail *validation*. But it's the broadest possible grant, and a human reviewer will ask why. The honest reason is legitimate but has to be stated explicitly in the submission's permission-justification field, not left implicit: the ComfyUI host is user-configured and can be any LAN IP:port (not a fixed domain OpenLayer controls), and model downloads (`src/comfy/setupManifest.ts`, `src/comfy/modelDownload.ts`) point at whatever URL the registry or the user pastes — Hugging Face, Civitai, GitHub, etc. — with no fixed set. There's no realistic narrowing available; the fix here is documentation, not code. |
| 1.3 | `localFileSystem: fullAccess` | **HIGH** → justified (verified 2026-08-23) | Confirmed against Adobe's docs: `fullAccess` explicitly triggers an extra install/update consent prompt beyond the normal install flow ("the user will be required to consent before installation or update"). Traced the actual need: `modelFolderAccess.ts` calls `getEntryWithUrl()` on an absolute `file:` path to silently locate the user's arbitrary-location ComfyUI `models/` folder — that specific API is what requires `fullAccess`, and there's no picker-based substitute for a silent, repeated background check. Checked the other two filesystem call sites and neither needs `fullAccess`: `saveFile.ts` uses a real OS save dialog (`getFileForSaving`) and `fileUtils.ts` uses the plugin's own sandboxed temp folder (`getTemporaryFolder`) — both already minimal. Nothing to narrow; `fullAccess` stays, now with a specific code-backed justification instead of a general one. |
| 1.4 | `clipboard: readAndWrite` | OK (verified 2026-08-23) | Confirmed: all 4 call sites in `App.ts` are `navigator.clipboard.writeText` — Copy Diagnostics, Copy Link, and copying a generated prompt. No read call exists anywhere. But the UXP manifest schema only offers `"read"` or `"readAndWrite"` for this permission — there is no write-only value — so `readAndWrite` is already the minimum available grant. Nothing to narrow. |
| 1.5 | `launchProcess.schemes: ["https"]` | OK | Live call site: `appBindings.ts` `openExternalUrl()` → `uxp.shell.openExternal`, wired to at least one button (`App.ts:6258` area). Legitimate, in use, don't touch. (Superseding an old project-memory note that this was dead code — it isn't, as of this audit.) |
| 1.6 | `host.minVersion: "25.0.0"` | OK | Checked against Adobe's own manifest-v5 example, which uses the same three-part `"23.3.0"` style. Format is fine as-is. |
| 1.7 | Plugin `name: "OpenLayer"` | OK | Clears the "at least three characters" validation rule. No trademark collision — doesn't claim Adobe affiliation. |

**Action for v0.17.0:** write a short, submission-ready justification for 1.2–1.4 (a paragraph each is enough) and keep it in this repo as `docs/exchange-permission-justification.md` so the same text can be pasted into the portal form and reused on every future permission-scope question from a reviewer.

---

## 2. `.ccx` packaging

**Files:** [scripts/package.mjs](../scripts/package.mjs), [scripts/lib/ccxManifest.mjs](../scripts/lib/ccxManifest.mjs), [docs/DISTRIBUTION_SPIKE.md](DISTRIBUTION_SPIKE.md)

| # | Finding | Severity | Detail |
|---|---|---|---|
| 2.1 | Zip structure is already correct | OK | `collectEntries()` walks `dist/` and writes archive paths with no wrapping folder; `manifest.json` sits at the archive root and packaging throws if it doesn't. This is exactly Adobe's stated requirement ("compress the contents of the parent folder... not the parent folder itself") and was already fixed for a real macOS bug in v0.10.0. Nothing to do here. |
| 2.2 | The `.ccx` files in `packages/` are hand-built, unsigned, and built for **sideloading**, not for the Exchange submission itself | **HIGH — clarify workflow** | For an actual Exchange listing, you don't hand-upload a `.ccx`: the Developer Distribution portal takes your plugin **zip** and does its own packaging/signing against the registered listing ID. The `.ccx` this repo builds is for direct/manual distribution (UDT sideload, GitHub release asset) — valuable and should keep existing, but it is not the submission artifact. Don't confuse "we have a working `.ccx`" with "we're ready to submit" — the submission input is the `npm run package` **zip**, built *after* the manifest `id` from 1.1 is real. |
| 2.3 | The open question from `DISTRIBUTION_SPIKE.md` — "does an unsigned third-party `.ccx` even install on a machine that never had UDT" — is still unanswered | MODERATE | Irrelevant to Exchange submission (Adobe signs what you submit), but still relevant to the direct-distribution path this project also uses. Not a submission blocker; don't let it block v0.17.0. |

---

## 3. External-service (ComfyUI) dependency

| # | Finding | Severity | Detail |
|---|---|---|---|
| 3.1 | The plugin does nothing without a separately installed, separately run ComfyUI instance plus multi-GB model downloads the user must fetch themselves | **HIGH** | A reviewer will install the plugin from the submitted package and open it in Photoshop with none of that in place. If the panel's cold state (ComfyUI stopped, zero models installed) is anything less than a clean, well-labeled "here's what to install and why" screen, that reads as a broken plugin. Per `README.md` / `docs/release-checklist.md`, the Setup tab already "works with ComfyUI stopped" and reports install status — that's the right design. What's missing is *verifying it holds up* as the very first thing a stranger sees, and giving the reviewer a fast path to see one real generation without downloading everything the registry lists. |
| 3.2 | No reviewer-facing test instructions exist | **HIGH** | Adobe's submission flow has a notes-to-reviewer / test-instructions field. Right now the only onboarding docs are for actual users (`docs/setup-windows.md`, `docs/setup-development.md`), which assume goodwill and time a reviewer won't have. Needs a short, purpose-written doc: smallest possible model to install, exact ComfyUI startup command, expected time-to-first-generation, and ideally a demo video/GIF link so a reviewer who *doesn't* do the local setup can still see the feature working. |

---

## 4. Onboarding / first-run

| # | Finding | Severity | Detail |
|---|---|---|---|
| 4.1 | Entry-point registration timing hack | **HIGH** | Per project memory (`openlayer-uxp-entrypoints-timing`): `setup()` throws `_isSet` if called more than ~20ms after panel start (Adobe bug PS-57605), worked around by registering from an inline head script. This is exactly the kind of fragile, timing-dependent code that behaves differently on a slower or colder review machine than on a fast dev box that's run the panel a hundred times. Before v0.17.0 ships, do several genuinely cold launches (close Photoshop fully between runs, not just the panel) and confirm it never trips. |
| 4.2 | No platform diversity in testing | **HIGH** | Project memory confirms macOS has never been tested — only Windows + one 4070 Ti Windows box. Photoshop and this manifest (`host.app: "PS"`, no platform restriction) both target Mac and Windows. If Adobe's reviewer is on a Mac (a real possibility) and something in panel layout, file paths, or the entrypoints timing issue behaves differently, that's a functional rejection that has nothing to do with permissions or paperwork. **[decision needed]**: get real Mac hands-on-keyboard testing before submitting, or explicitly scope v0.17.0's submission to Windows-verified-only and flag the Mac gap in reviewer notes so it isn't a surprise. |
| 4.3 | Setup tab quality | OK | Model/node install status, folder-location detection, GPU-aware "what will run well," and in-panel downloads (v0.11–v0.13) are a genuinely strong onboarding story once someone gets there. No changes needed to the feature itself — this item is about verifying the *very first* screen a stranger sees (4.1, 3.1), not the Setup tab's content. |

---

## 5. Privacy / legal

| # | Finding | Severity | Detail |
|---|---|---|---|
| 5.1 | No privacy policy | **BLOCKER** | Confirmed directly against Adobe's Developer Distribution submission docs: a listing requires both a **privacy policy** and **terms of service**. Neither exists in this repo. `SECURITY.md`'s "Local Network Guidance" section is a solid factual seed (no telemetry, no cloud calls, local-only diagnostics) but is not a published, linkable policy page. |
| 5.2 | No terms of service | **BLOCKER** | Same requirement, separate document. MIT `LICENSE` covers the *code*; Exchange wants a ToS covering the *listing/usage relationship* (support expectations, no-warranty language, etc. — much of this can be adapted from the MIT disclaimer plus SECURITY.md). |
| 5.3 | Publisher profile — EU seller info | **[decision needed]** | Adobe's docs note EU-based publishers must supply business address, phone, and D-U-N-S number as of Feb 16 2025 — this is a live requirement, not a future one. Need to know whether Mehran is submitting as an individual/EU entity, since it changes what the publisher profile needs before a listing can even be created. |
| 5.4 | No data-collection surprises found in code | OK | Grep across `src/` for network calls turned up only: the user's configured ComfyUI host, ComfyUI's own `/system_stats` and Manager API, and model-download URLs the registry/user supplies. Nothing phones home. This makes the privacy policy easy to write honestly — "we don't collect anything" is true, not aspirational. |

---

## 6. UI / listing content

| # | Finding | Severity | Detail |
|---|---|---|---|
| 6.1 | No Exchange **listing** assets exist | **HIGH** | Distinct from the manifest's panel icons (`src/icons/`, already present and correctly sized for UXP). A Marketplace listing separately requires: 3 plugin icon sizes for the store listing, screenshots/video, a public name + subtitle + description (localized if targeting non-English locales), a help URL, and a support email. None of this is built yet — it's pure content/design work, not code, but it's real scope for v0.17.0. |
| 6.2 | Public framing says "alpha," "experimental," "not for production work yet" throughout README, CHANGELOG, and in-panel copy | **[decision needed]** | This is honest and, per project memory, deliberately enforced (`docs/release-checklist.md`'s "Public Alpha Truth Check" section exists specifically to keep this honest). The open question is only about the **listing copy Adobe sees**, not the repo's own voice: does v0.17.0 go to Exchange still self-described as alpha (risking a reviewer asking "is this ready?"), or does the *listing* specifically reposition as "public beta" while the in-app/README language stays exactly as candid as it is now? This is a product call, not an engineering one — flagging it rather than deciding it. |
| 6.3 | Panel UI/theme quality | OK | v0.16.0's token-based theming, slider work, and general polish (per project memory, `openlayer-v-0-16-ui-plan`) already moved this in the right direction for a store listing. No new scope identified here beyond normal design QA. |

---

## 7. Tests / CI

**Files:** [.github/workflows/ci.yml](../.github/workflows/ci.yml), [vitest.config.ts](../vitest.config.ts)

| # | Finding | Severity | Detail |
|---|---|---|---|
| 7.1 | 84 unit/logic test files, typecheck + lint + build gated in CI on Node 22 | OK | Solid coverage for what's testable outside Photoshop. Nothing to add here for Exchange purposes specifically — Adobe does its own functional review, it doesn't inspect your test suite. |
| 7.2 | No automated Photoshop/UXP integration coverage | OK, expected | Can't be automated (UXP has no headless test harness); this is exactly why `docs/release-checklist.md`'s "Manual Smoke Test" section exists. The fix for Exchange readiness isn't more automation, it's making sure that manual checklist explicitly includes a cold-start / no-ComfyUI pass (see 3.1, 4.1) before every submission-track release, not just before every alpha. |
| 7.3 | `test:e2e` (bridge/MCP tests) not run in CI | OK | The bridge ships outside the plugin package entirely, so this has zero bearing on the submitted artifact. Not in scope for this audit. |

---

## Summary: what actually blocks submission today

1. No registered manifest `id` (1.1) — need a Developer Distribution publisher profile + listing first. **Still open — requires Mehran's Adobe account.**
2. ~~No privacy policy (5.1).~~ **Resolved 2026-08-23** — [docs/privacy.html](privacy.html).
3. ~~No terms of service (5.2).~~ **Resolved 2026-08-23** — [docs/terms.html](terms.html).

So exactly one hard blocker remains, and it can only be cleared by Mehran creating the publisher
profile and listing in the Developer Distribution portal (A1/A2 below) — that step needs an Adobe
account and can't be done from this repo.

Everything else is either a strong risk-reduction item (cold-start reliability, Mac testing) or
listing content that has to exist but isn't a validation-time blocker. Of the risk-reduction items,
the permissions justification and reviewer notes are now written (C1/C2); what's left needs hands
on real hardware, not more code.

---

## Plan: v0.17.0 → Exchange submission

Scoped as discrete tasks in the project's usual one-task-at-a-time flow. Ordered by dependency, not by severity — some HIGH items (like Mac testing) can run in parallel with paperwork.

### A. Paperwork (do first — nothing else can complete without these)

- [ ] **A1.** Create the Adobe publisher profile (public name, marketing site, description, logo). **[decision needed from Mehran]**: individual vs. business entity, and EU seller info (5.3) if applicable. Walkthrough: [docs/exchange-portal-registration.md](exchange-portal-registration.md).
- [ ] **A2.** Create the plugin listing in Developer Distribution to obtain the real manifest `id`. Update `src/manifest.json` (`id` field) and re-run the version-consistency test to confirm nothing else needs to change. Same walkthrough covers this step.
- [x] **A3.** Privacy policy published: [docs/privacy.html](privacy.html), linked from `docs/index.html`, `docs/become-a-tester.html`, and README footers.
- [x] **A4.** Terms of service published: [docs/terms.html](terms.html), same linking.
- [ ] **A5.** **[decision needed]** Confirm listing framing: alpha/beta language for the *Exchange listing copy* specifically (6.2).

### B. Code / reliability

- [ ] **B1.** Do 5+ genuinely cold Photoshop launches (full quit between each) and confirm the entrypoints timing workaround (4.1) never trips `_isSet`. This is now folded into a broader **Photoshop 27.9 UI backend compatibility pass** — Adobe's UI backend change already shipped publicly July 26, 2026, and Adobe explicitly asked UXP developers to test against it. Full checklist, including the specific fragile-code areas found by grepping this codebase (1,107 `!important` CSS rules, the entrypoints timing hack, the new welcome overlay): [docs/photoshop-27-9-compatibility.md](photoshop-27-9-compatibility.md). **Needs Mehran on real Photoshop — can't be done from this repo.**
- [ ] **B2.** Verify the panel's cold state — ComfyUI stopped, zero models installed, fresh Photoshop — is a clean, non-broken first screen. **Partially addressed**: a first-run welcome overlay now exists (see new section 8 below) that explicitly handles "ComfyUI not found" as a labeled state rather than a silent/broken one. Still needs real-Photoshop verification per B1.
- [x] **B3.** Audited `saveFile.ts` / `fileUtils.ts` — neither needs `fullAccess` (picker + temp-folder APIs only), and neither was contributing to the requirement. `fullAccess` stays, justified solely by `modelFolderAccess.ts`. See finding 1.3.
- [x] **B4.** Confirmed clipboard is write-only in practice, but the UXP schema has no write-only value — `readAndWrite` is already minimal. No manifest change. See finding 1.4.
- [ ] **B5. [decision needed / needs a Mac]** Run a real smoke test on macOS. This project has never been tested on Mac; either get that done before submitting or explicitly scope the submission's reviewer notes to flag it.

### C. Documentation for the submission itself

- [x] **C1.** [docs/exchange-permission-justification.md](exchange-permission-justification.md) — paste-ready justification for all four requested permissions.
- [x] **C2.** [docs/exchange-reviewer-notes.md](exchange-reviewer-notes.md) — fastest path to one working generation (SD 1.5, ungated, ~2 GB, `txt2img-basic`), what the cold/no-ComfyUI state should look like, and links to the permission justification and privacy policy. Demo video shooting script written: [docs/exchange-demo-shooting-script.md](exchange-demo-shooting-script.md). **Still needed:** actually recording it — that's Mehran, not something written from the code.

### D. Listing content (can run in parallel with B/C)

- [ ] **D1.** 3 required listing icon sizes (separate from the in-panel UXP icons already in `src/icons/`).
- [ ] **D2.** Screenshots (4–6) and a short demo video.
- [ ] **D3.** Listing copy: public name, subtitle, description, help URL, support email.

### E. Submission

- [ ] **E1.** Bump to v0.17.0 through the normal release process (memory: `release/vX.Y.Z` branch, version bump ×4 sites, CHANGELOG/README/landing page).
- [ ] **E2.** `npm run package` to produce the submission zip — confirm it's the zip (not the `.ccx`) that gets uploaded to the portal (2.2).
- [ ] **E3.** Run the existing `docs/release-checklist.md` in full, plus the new cold-start pass from B2.
- [ ] **E4.** Submit via Developer Distribution with the justification (C1) and reviewer notes (C2) attached.
- [ ] **E5.** Be ready to turn around review feedback quickly — first Exchange submissions often bounce once on something minor.

---

## 8. First-run welcome overlay (built 2026-08-23)

Addresses the onboarding/complexity problem this audit and an independent business-strategy review
both converged on: a stranger opening the panel for the first time now sees an explicit "OpenLayer
needs ComfyUI" screen rather than discovering the connection requirement through trial and error.

- **Scope, by design**: connect-only. It auto-runs the same port scan Settings' "Find ComfyUI
  Active Port" button already used (now shared via `src/comfy/comfyPortDiscovery.ts`, extracted
  from `App.ts` so there's one implementation, not two), reports found/not-found, and hands off to
  the existing Setup tab for models/GPU/everything else rather than duplicating that screen.
- **Shows once, ever**: a `localStorage` flag (`openlayer.welcomeSeen.v1`, in
  `src/utils/preferences.ts`) persists dismissal via either **Skip** or **Continue** — never
  reappears once seen, matching the "don't re-annoy a returning user whose ComfyUI is just
  temporarily off" requirement.
- **New files**: `src/comfy/comfyPortDiscovery.ts` (extracted detection logic),
  `tests/utils/welcomeSeen.test.ts` (storage persistence), `tests/ui/welcomeOverlay.test.ts` (DOM
  interaction — mounts the real panel markup, stubs `fetch`, exercises detect/skip/continue/no-repeat).
  Markup in `src/ui/appMarkup.ts`, binding logic in `src/ui/appBindings.ts` (`bindWelcomeOverlay`),
  styles appended to `src/styles.css`.
- **Verified**: `npm run typecheck`, `npm run lint`, `npm test` (877/877), `npm run build` all
  pass. **Not verified**: actual rendering inside Photoshop/UXP — this is new UI that has never
  been seen in the real host, and `position: fixed` inside a UXP panel is an unverified assumption
  worth specific attention during the 27.9 pass (B1) rather than assumed safe by analogy to browser
  behavior. See `docs/photoshop-27-9-compatibility.md` Priority 3.

## Sources checked live for this audit

- [Submission and Review — Overview](https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/submission/overview) — listing assets, privacy policy + ToS requirement, packaging (no wrapping folder), manifest `id` must match the portal.
- [Developer Distribution FAQ](https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/faq) — publisher profile, EU seller info requirement (Feb 16 2025).
- [UXP manifest v5 guide](https://developer.adobe.com/photoshop/uxp/2022/guides/uxp-guide/uxp-misc/manifest-v5/) — `localFileSystem` values and the `fullAccess` install-consent behavior, `host.minVersion` format.
