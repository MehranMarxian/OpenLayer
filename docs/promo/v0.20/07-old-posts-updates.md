# What to do with the old announcements

Four existing GitHub Discussions in Announcements, oldest to newest. None of them contain anything
false — they're accurate records of what was true when posted. The problem is only that they're the
most recent thing a search engine or a new visitor sees, and none of them point forward. Recommended
treatment for all four: **a short "Update" line added at the top via edit, not a rewrite.** GitHub
shows an "edited" marker automatically, so this is transparent, and it preserves the original post
(including its two comments on #83) as a real historical record instead of erasing it.

I did not find any Reddit posts, forum posts, or other external announcements to update besides the
r/comfyui v0.12 thread (`1v8c1hc`) — see the open question about it below. If Mehran has posted
anywhere else (Civitai, a Discord, X/Bluesky) I don't have a record of it and can't check without a
link.

---

## #83 — "v0.12.0-alpha: a Flux.2 (GGUF) preset..." (2026-08-03, 1 comment)

Still asks a real, unanswered question (does the `.ccx` installer work on a clean machine). Keep the
ask alive by pointing it at the current release rather than letting it die on an 8-versions-old post.

**Insert at the top of the body:**

```markdown
> **Update, 2026-09:** Eight releases later, the `.ccx` installer and every model-download question
> from this post have moved forward — the installer's now the default download link and there's a
> guided in-panel Setup tab. Full current state: see the [v0.20.0-alpha
> announcement](LINK_TO_NEW_DISCUSSION). The macOS testing ask below is still open and still the
> single most useful report this project could get.

---
```

## #85 — "Video is live: OpenLayer v0.13.0-alpha quick demo" (2026-08-07, 0 comments)

The video itself is still fine to link — README and the landing page already caption both YouTube
videos as recorded from an earlier alpha build, so this isn't introducing a new inconsistency. Just
needs a pointer forward so it doesn't read as the most recent thing that happened.

**Insert at the top of the body:**

```markdown
> **Update, 2026-09:** This demo is still accurate for what it shows (Text to Image → Image to Image
> → import), recorded from an earlier alpha build as noted on the site. Seven releases of new tools
> since, most recently Unflatten in v0.20.0 — see the [latest
> announcement](LINK_TO_NEW_DISCUSSION).

---
```

## #88 — "v0.15.0 — Agent Bridge" (2026-08-17, 0 comments)

The content is still correct, just incomplete — the bridge covered 7 tools then, 10 now
(`style_reference` and `multi_reference` joined in v0.18/v0.19, `unflatten` in v0.20). Worth a factual
update line, not just a pointer.

**Insert at the top of the body:**

```markdown
> **Update, 2026-09:** The Agent Bridge now covers 10 tools, not 7 — `style_reference` and
> `multi_reference` joined in v0.18/v0.19, and `unflatten` in v0.20, on the same boundary described
> below (an agent can set parameters and press the button, never capture a source). See the [v0.20.0
> announcement](LINK_TO_NEW_DISCUSSION) for what's new since.

---
```

## #94 — "Inpaint & Outpaint demo video is up" (2026-08-28, 0 comments)

Most recent of the four and already honestly captioned ("Still alpha, still local-only, still free").
Lightest-touch update — just a forward pointer, nothing to correct.

**Insert at the top of the body:**

```markdown
> **Update, 2026-09:** Still an accurate look at Inpaint/Outpaint. Since this post: Style Reference,
> Multi-Reference composition, and Unflatten (splits a flat layer into real layers with alpha) all
> shipped — see the [v0.20.0 announcement](LINK_TO_NEW_DISCUSSION).

---
```

---

### Sequencing

Do these edits **after** the new v0.20.0 Discussion (draft `01-github-discussion.md`) is actually
posted, so `LINK_TO_NEW_DISCUSSION` has somewhere real to point. Four small edits, five minutes of
work, no risk — these don't need the same one-shot caution as Show HN.

### Open question for Mehran, not resolved here

Per project memory, a reply to u/Far_Estimate7276 in the original r/comfyui thread (about the Flux.2
GGUF fix) was planned to go out before the intro video finished, back in early August. I have no way
to check from here whether that reply was ever sent — reddit.com is blocked to my tools. Worth a
quick look before the new r/comfyui post goes up: if that conversation is still hanging, closing the
loop there costs nothing and is the kind of follow-through that got this project its only real tester
so far.
