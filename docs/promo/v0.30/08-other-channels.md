# Other channels considered

Carried forward from `docs/promo/v0.25/08-other-channels.md`, re-checked where cheap to do so. No
material change except the suggested awesome-list line, which now leads with Layer Maps.

## Worth doing

### Awesome-lists

- **`light-and-ray/awesome-alternative-uis-for-comfyui`** — not re-checked this round; confirmed
  listed two cycles ago, no reason to expect it fell off.
- **`lucianosb/awesome-comfyui`** — not re-checked this round either (was re-checked and confirmed
  still absent last cycle). Still worth a PR whenever Mehran wants to send one.

**Suggested PR line**, matching their existing style:

```markdown
[OpenLayer](https://github.com/MehranMarxian/OpenLayer): Free, open-source Photoshop UXP plugin
that connects to a local ComfyUI server — text to image, inpaint, outpaint, sketch to image,
upscale, background removal, depth/line-art/normal map export, live painting. MIT licensed,
100% local.
```

Draft only, per the standing rule against publishing without per-action approval — this is a PR
against someone else's repo. Say the word and I'll open it.

## Considered, not recommended right now

### Product Hunt

Unchanged conclusion, two cycles running: the honest install cost (Photoshop + a separately installed
local ComfyUI + a GPU for most tools) is the opposite of PH's "try it in under a minute" expectation.
Layer Maps and Remove Background are both lighter-weight than the rest of the plugin, but PH judges
the whole product. Revisit once macOS support is confirmed and Setup makes zero-to-first-result fast
for a stranger.

### Civitai article

Still lower priority, not excluded — audience overlaps heavily with r/comfyui and r/StableDiffusion,
and a proper Article is more writing effort than a Reddit post for a similar audience. Better once
there's more day-to-day usage evidence and the video/screenshot backlog is actually cleared (this
cycle is the first time that backlog has a real answer — see `layer-maps-video-script.md`).

### Banodoco

Same as both prior cycles: named in general guidance, couldn't independently verify current activity
or get a confident invite link. Not recommending either way; a five-minute check by Mehran settles it
if he already has a link.

## Not a fit

### ComfyUI Manager / ComfyUI Registry

Unchanged: that registry is for custom nodes installed inside ComfyUI itself. OpenLayer is a
Photoshop-side client using only core ComfyUI nodes over HTTP/WebSocket — it doesn't belong there.

## Adobe Exchange / UXP marketplace

Per `docs/exchange-readiness-audit.md` (last full audit 2026-08-23, against v0.16.0 — not re-audited
this cycle either, so treat as unchanged rather than freshly confirmed): one real blocker remains, the
manifest `id` needs to come from a Developer Distribution portal listing, which needs Mehran to create
a publisher profile himself. Privacy policy and ToS were resolved in v0.17.4 per that audit. There is
also an untracked `docs/exchange-listing-copy.md` sitting in the working tree per the current git
status — I did not open or use it for this campaign (out of scope for a promo drafting pass unless
Mehran asks), but it's worth him knowing it's there uncommitted.
