# Other channels considered

Carried forward from `docs/promo/v0.20/08-other-channels.md` and re-checked where cheap to do so.
Nothing material has changed since that pass except one item below.

## Worth doing

### Awesome-lists

- **`light-and-ray/awesome-alternative-uis-for-comfyui`** — not re-checked this round; was confirmed
  listed last cycle and there's no reason to expect it fell off.
- **`lucianosb/awesome-comfyui`** — **re-checked today directly, still not listed.** Still worth a PR.

**Suggested PR line**, matching their existing style, updated to lead with Remove Background instead
of Unflatten:

```markdown
[OpenLayer](https://github.com/MehranMarxian/OpenLayer): Free, open-source Photoshop UXP plugin
that connects to a local ComfyUI server — text to image, inpaint, outpaint, sketch to image,
upscale, background removal, live painting. MIT licensed, 100% local.
```

Draft only, per the standing rule against publishing without per-action approval — this is a PR
against someone else's repo. Say the word and I'll open it.

## Considered, not recommended right now

### Product Hunt

Unchanged conclusion from last cycle: OpenLayer's honest install cost (Photoshop + a separately
installed local ComfyUI server + a GPU for most tools) is the opposite of PH's "try it in under a
minute" audience expectation. Remove Background itself is much lighter-weight than the rest of the
plugin, but PH would be judging the whole product, not one tool. Revisit once macOS support is
confirmed and the Setup tab makes zero-to-first-result realistically fast for a stranger.

### Civitai article

Still lower priority, not excluded — same reasoning as last cycle (audience overlaps heavily with
r/comfyui and r/StableDiffusion, and a proper Article is a bigger writing effort than a Reddit post
for a similar audience). A "how I use this" walkthrough would read better once there's more day-to-day
usage evidence, and once the Remove Background screenshot backlog is cleared.

### Banodoco

Same as last cycle: named in general guidance, couldn't independently verify current activity or get
a confident invite link. Not recommending either way; a five-minute check by Mehran settles it if he
already has a link.

## Not a fit

### ComfyUI Manager / ComfyUI Registry

Unchanged: this registry is for custom nodes installed inside ComfyUI itself. OpenLayer is a
Photoshop-side client using only core ComfyUI nodes over HTTP/WebSocket — it doesn't belong there.

## Adobe Exchange / UXP marketplace

Per `docs/exchange-readiness-audit.md` (last full audit 2026-08-23, against v0.16.0 — not re-audited
this cycle, so treat this as unchanged rather than freshly confirmed): one real blocker remains —
the manifest `id` is self-assigned and Adobe requires it come from a Developer Distribution portal
listing, which needs Mehran to create a publisher profile (an account — his to do). Privacy policy
and Terms of Service were resolved in v0.17.4 per that audit. Worth flagging again as "closer than it
looks," same as last cycle — I did not re-verify this claim against the current manifest this round.
