# Other channels considered

## Worth doing

### Awesome-lists

Checked both directly:

- **`light-and-ray/awesome-alternative-uis-for-comfyui`** — OpenLayer is **already listed**
  (confirmed by fetching the README directly: entry exists, links to
  `github.com/MehranMarxian/OpenLayer`, with a description matching the current repo description).
  No action needed.
- **`lucianosb/awesome-comfyui`** — OpenLayer is **not** listed (confirmed by fetching the README
  directly). Worth a PR. Their entries follow a simple `[Project Name](link): description` format.

**Suggested PR line**, matching their existing style:

```markdown
[OpenLayer](https://github.com/MehranMarxian/OpenLayer): Free, open-source Photoshop UXP plugin
that connects to a local ComfyUI server — text to image, inpaint, outpaint, sketch to image,
upscale, live painting, and Unflatten (splits a flat layer into separate layers with real
transparency). MIT licensed, 100% local.
```

This is a PR against someone else's repository — draft only, per the standing rule against
publishing without per-action approval. If Mehran wants it opened, say so and I'll open it against
the right section of their README.

### ComfyUI-adjacent competitive landscape (found while researching, worth knowing)

A web search for "photoshop comfyui plugin" surfaces at least two other projects in this exact
space: **ComfyPanel** ("professional Photoshop plugin... bridges local ComfyUI computing power with
cloud platforms") and a project literally named **PR-comfyui-photoshop**. Neither claim was verified
beyond the search snippet, but it means "Photoshop + ComfyUI plugin" is no longer an empty search
term — there's real competition to be found there now, which raises the value of ranking well on the
capability keywords (see the main PAM brief's SEO section) rather than assuming first-mover
advantage still holds.

## Considered, not recommended right now

### Product Hunt

Not recommended for this cycle. PH's audience and ranking dynamics reward things a stranger can try
in under a minute with no setup — sign up, click, see result. OpenLayer's honest install cost
(Photoshop + a separately-installed local ComfyUI server + an 8 GB+ GPU) is the opposite of that.
A PH launch here would mostly generate upvotes from people who never install it, which is exactly the
"reach without activation" failure mode already seen once with this project. Revisit if/when macOS
support is confirmed and the Setup tab's guided install experience is polished enough that a stranger
really can get from zero to a first image without help — that's a materially different pitch than
today's.

### Civitai article

Lower priority, not excluded. Civitai's audience already overlaps heavily with r/comfyui and
r/StableDiffusion, so it adds less incremental reach than it would as a first move, and an Article
there is a bigger writing effort (cover image, category, full walkthrough) than a Reddit post for a
similar audience. Worth doing as a follow-up once there are more screenshots of the tool in daily use
(not just the seven hero shots that exist today) — a "how I use this" walkthrough article reads
better after a few weeks of real usage than as a launch-day post. Not drafted this round.

### Banodoco

Named in general guidance as an AI-art tooling community; I could not independently verify it's still
active or find a current invite/link I'm confident in, so I'm not recommending it either way this
round rather than guess. Worth a five-minute check by Mehran if he already has a link to it.

## Not a fit — correcting a wrong assumption

### ComfyUI Manager / ComfyUI Registry (`custom-node-list.json`)

Checked directly against `docs.comfy.org` and the Comfy-Org/ComfyUI-Manager repo: this registry is
for **custom nodes that install inside ComfyUI itself** (cloned into `custom_nodes/`, with a
`requirements.txt` ComfyUI-Manager installs). OpenLayer is not a ComfyUI custom node — it's a
Photoshop-side client that talks to a stock ComfyUI server over HTTP/WebSocket using only core nodes.
It doesn't belong in that registry and submitting it there would be listed incorrectly (and likely
rejected). This was worth checking rather than assuming, since the earlier brief specifically raised
it as an option — the honest answer is that it doesn't apply here.

## Adobe Exchange / UXP marketplace

Real distribution channel, not just advertising, but not ready this cycle. Per
`docs/exchange-readiness-audit.md` (last audited 2026-08-23 against v0.16.0), there were three
blockers:

1. Manifest `id` (`com.openlayer.photoshop` at the time) is self-assigned; Adobe requires the ID
   come from a Developer Distribution portal listing.
2. No published privacy policy.
3. No published terms of service.

**Blockers 2 and 3 are now resolved** — `docs/privacy.html` and `docs/terms.html` exist and are
linked from the README (shipped in v0.17.4, per the CHANGELOG). Only blocker 1 remains: Mehran needs
to create a Developer Distribution publisher profile (an account, so his to do, not something I can
do on his behalf) and get an assigned ID before the manifest can be corrected and a listing
submitted. Worth flagging as "closer than it looks" rather than a distant task.
