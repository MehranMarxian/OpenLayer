# Adobe Developer Distribution — Publisher Profile & Listing

Walkthrough for the one step in [docs/exchange-readiness-audit.md](exchange-readiness-audit.md)
that can't be done from this repo: it needs your Adobe account. This doesn't commit you to
submitting — creating a profile and a draft listing is reversible, and unblocks the manifest `id`
that every subsequent build needs.

Start at
[developer.adobe.com/developer-distribution/creative-cloud/docs/guides/submission/overview](https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/submission/overview)
— verified live 2026-08-23, this is the current, correct entry point. It's documentation, not the
portal itself; it links you into the Adobe Developer Console once you sign in with your Adobe ID.

## Step 1 — Publisher profile

You'll be asked for:

- Public publisher name (shown on your listing — doesn't have to be a company name)
- Marketing website — use `https://mehran-ahmadi.com/OpenLayer/`
- Description
- Logo

**Decide individual vs. business, and EU vs. non-EU, when you hit this step.** If the entity is
EU-based, Adobe's docs (per their Feb 2025 policy update) require additional information beyond
the individual path:

- Business email
- Phone number (with country code)
- Street address or P.O. box, city, region, postal code, country
- D-U-N-S number — **optional** (re-checked 2026-09-10; earlier versions of this doc said required)

If you're registering as an individual outside the EU, none of that extra info applies — just the
four items above.

Adobe's own docs warn that publisher-profile changes historically weren't trivial to make after
the fact, so get the public name and marketing site right the first time rather than treating them
as placeholders.

> **Status (2026-09-24): Steps 1–2 are done.** The listing exists and its ID, `1e827d3d`, has been
> in `src/manifest.json` since commit `8a0b2c4` (2026-08-23). Still worth confirming in the portal
> that the publisher profile was *submitted*, not just saved — Adobe requires it before, or with,
> the first listing submission.

## Step 2 — Create the Photoshop plugin listing

Inside your project in the Developer Console: **Distribute → Create Photoshop plugin listing**.

This generates the real plugin `id` — the one `src/manifest.json` currently has a self-assigned
placeholder for (`com.openlayer.photoshop`). **Once you have it:**

1. Tell me the new ID (or paste it directly).
2. I'll update `src/manifest.json`'s `id` field, run `npm test` to confirm the version-consistency
   test and everything else still pass, and commit.

You do not need to fill in every listing field (name, subtitle, description, screenshots, pricing,
privacy policy, terms) in this same session. The ID is what unblocks the codebase; the rest of the
listing content is tracked separately in the audit doc's "D — Listing content" section and can be
filled in over time before you actually hit Submit.

## What to paste into the listing's own fields, once you get there

- **Privacy policy URL:** `https://mehran-ahmadi.com/OpenLayer/privacy.html`
- **Terms of service URL:** `https://mehran-ahmadi.com/OpenLayer/terms.html`
- **Permission justifications:** [docs/exchange-permission-justification.md](exchange-permission-justification.md)
- **Reviewer/test notes:** [docs/exchange-reviewer-notes.md](exchange-reviewer-notes.md)
- **Minimum host version:** already correct — `src/manifest.json` has Photoshop 25.0.0, which
  clears every minimum Adobe's docs mention (13.0+ generally, 21.0+ recommended, 22.0 for
  manifest V4 — this project is on manifest V5).

## Package format

Upload the **`.ccx`** `npm run package` produces (in `packages/`). Adobe's current submission docs
(re-checked 2026-09-10) take a `.ccx` by drag-and-drop — it is a plain zip with the manifest at the
root and no wrapping folder, which is exactly what this repo builds — and Adobe signs it
server-side. One package per version, 300 MB max. An earlier version of this doc said to upload the
bare zip; that was wrong.

## Screenshots, when you get to that field

Confirmed against Adobe's current submission checklist: **1–5 images, 1360×800px, PNG or JPG,
under 5MB each.**
