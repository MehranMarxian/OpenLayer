# Changelog

## v0.20.0-alpha - 2026-08-30

This release adds Unflatten: hand the panel a flat layer and get the picture back as separate layers with real transparency, imported into the open document in stacking order. Nothing else in this space puts a decomposed layer stack into a host application, and that is the whole point of building it here rather than anywhere else.

Before any of the screen existed, eight questions about how the technique actually behaves were answered with live ComfyUI generations — full results in `docs/unflatten-gate-findings.md`. Two of the answers overturned assumptions the plan document was built on, one of them about the plan's own account of the original spike.

### Added

- **Unflatten** (experimental). A captured layer is decomposed by `unflatten-qwen-layered` into `layers + 1` images and imported as N Photoshop layers, back to front, each scaled and aligned to the region the source was captured from, all inside one group named after that source. Every node in the graph is core ComfyUI. Three new model files totalling 28.1 GB, which share nothing with any existing preset — the largest single addition the Setup manifest has taken. About two minutes for four layers on a 12 GB card.

  **Composition decides whether it works, not provenance.** The gate expected v0.19's result to repeat, that the model favours its own output over photographs. It does not. Crossing the two axes on matched pairs — the generated members made locally with the shipped Krea-2 stack — a generated close-up failed exactly as a photographed one did, and a photographed contained subject succeeded exactly as a generated one did. What predicts success is whether the picture has something standing in front of something else. The plan's premise needed correcting on the way: it recorded the original spike's source as one of OpenLayer's own generations, and the run history showed a stock photograph, so the spike was already the case the question was invented to test.

  **640px with four layers is a measured optimum.** Two layers fuses distinct objects into a single plate — which is what the spike used, and why its background looked worse than the model deserved. Six pads the result with blank layers. And 1024 is not a quality/time trade-off worth exposing: on two seeds it separated about half as well as 640, left more layers empty, and cost three and a half times the wall time, so the graph fixes the resolution and the panel does not offer it.

- **Layers in front of the background are built from the artist's own pixels.** The model's plate for such a layer is a 640px re-render of content the document already holds at full resolution, and the only thing it contributes that the document lacks is the matte. So the plate is placed purely to be measured — scaled and aligned, its transparency loaded as a selection, then deleted — and the captured source goes down in its place at native resolution wearing that selection as a layer mask. Non-destructive, full-resolution, and only the cut edge inherits the decomposition's resolution. Loading a layer's transparency as a selection is the one step no other import in the panel performs, so a host that refuses it falls back to the model's own pixels rather than failing a decomposition the artist has already waited two minutes for.

- **A plate that came back empty is left out rather than imported.** The gate deferred this because deciding it needs the image's alpha channel and nothing in a UXP panel can decode a PNG; file size was measured as a proxy and failed outright. Building the layers from masked source pixels turned out to supply the answer for free: loading a plate's transparency as a selection *is* an alpha read, performed by Photoshop rather than by the panel, and a plate with no matte produces no selection. That check now decides it. It catches an empty plate reliably and a merely faint one unreliably, which is the honest limit of the method.

- **`unflatten` joins the MCP Agent Bridge** as the tenth bridged tool, on the same boundary as the other nine: an agent can set parameters and press the button, and cannot capture the source. Everything the gate found that constrains the tool is in the description an agent reads before running it.

### Known limits, stated rather than worked around

- **A close-up that fills the frame cannot be separated**, whatever it was made by, and the panel cannot detect it. Deciding whether a picture separated needs its alpha channel; nothing in a UXP panel can decode a PNG. Two cheap proxies were measured and both failed: file size cannot identify a blank plate (across 63 gate layers, blanks ran 201 KB–845 KB and populated ones 243 KB–2.3 MB, overlapping almost completely, because a blank plate carries RGB noise under a near-zero alpha that does not compress away), and the size ratio between the background layer and the composite does not separate the two outcomes either — an unseparated run sat at 0.972 while genuinely separated ones sat at 0.983 and 0.984. So it is stated in copy in three places instead of being guessed at in code.

- **The background layer is softer than the original.** The decomposition runs at 640px because higher resolution measurably separates worse. Only the background carries that cost: every layer in front of it is rebuilt from the captured layer's own pixels wearing the model's matte, so the subject stays at the resolution it was captured at and only its cut edge is soft. The background cannot be built that way, because it holds content the model invented to fill the hole the subject left — content that by definition is not in the source — so masking the source with it would reveal the subject again instead of the fill.

- **The layer count is a ceiling, not a promise.** A four-layer run can return only two plates carrying anything, varying with the seed. Those are the layers you get: an empty plate is left out and the survivors are renumbered, so asking for four and receiving two is the tool working rather than failing. A plate that is faint rather than truly empty can still slip through, because the test is whether the matte yields a selection at all.

### Fixed

- **The bridge's own smoke test had been asserting a stale tool list since v0.18.** It froze the eight tools by hand, never gained `style_reference` in v0.18 or `multi_reference` in v0.19, and so reported a failure on every run for two releases while still reading as a meaningful check. It now derives the expected list from `MCP_TOOLS` and cannot go stale again.

## v0.19.0-alpha - 2026-08-28

This release adds Multi-Reference Composition: give the panel a list of captured layers instead of one, and it builds a single picture out of all of them. Before any of the screen was built, four questions about how the technique actually behaves were answered with 48 live ComfyUI generations, each run as a control/variant pair — full results in `docs/multi-reference-gate-findings.md`. Two of the four answers shrank the feature that got built; the third is the honest limit stated everywhere the tool is described.

### Added

- **Multi-Reference Composition** (experimental). An ordered list of reference layers — Add Active Layer or Add Canvas to grow it, Up/Down/Remove on each row — composed into one image with `multi-reference-flux2-klein`, which chains a `ReferenceLatent` per reference onto both conditioning branches of FLUX.2 Klein. Every node is core ComfyUI, and it shares the Klein 4B stack already needed for the other Klein presets, so it downloads nothing new.

  Reference order is a real control, not a convenience: the first reference sets the output canvas, and gate testing found a wide, thin object that has to sit behind the other subjects can render duplicated or distorted unless it comes earlier in the chain — moving one item fixed a duplication that reproduced on every seed tried. Testing found no reference count, up to six, at which composition quality fell off, so the eight-reference cap is a sanity bound rather than a measured limit. Positional prompt wording ("the second image") turned out not to matter at all — the model matches a reference to the prompt by what it depicts, not by its position in the list — and masking or cutting a reference out from its own background made no measurable difference, because Klein already isolates the subject on its own. Neither slot numbering nor a masking control made it into the screen as a result.

  What did not survive testing is likeness. Clothing, props, setting and lighting carry across from a reference; a specific person's face does not. Four real photographs — two modern, two archival — all came back as a plausible stranger rather than the person photographed, including a clean, frontal, evenly lit studio portrait, which rules out framing or resolution as the cause. Generated sources fare much better, because the model reproduces its own output far more faithfully than it reproduces a photograph — which is exactly the trap the test was designed to catch. The tool's subtitle, its in-panel info note, and its MCP tool description all say this plainly: it composes a scene, it does not place a recognisable person into one.

- **`multi_reference` joins the MCP Agent Bridge**, alongside the seven tools already reachable there. Same boundary as every other bridged tool — an agent can set the prompt and sampler values and press Compose, but cannot capture layers, add to the list, or reorder it — and the likeness limit is stated directly in the tool description an agent reads before running it.

### Fixed

- **Reordering or removing a reference left the progress bar spinning with nothing running behind it.** `setStatusProgress` reads status tone `"idle"` as work in progress unless the message contains a word from a short completion whitelist (ready, complete, copied, saved, reset, cancel) — right for "Uploading reference 2 of 3...", wrong for "Reference moved to position 2.", a finished action whose wording happened to match none of them. Both list actions now report tone `"ready"`, like every other completed action in the panel already does. Found in a real Photoshop session.

- **Composing from two layers captured together produced the wrong background at the wrong size.** Captures are named to the minute, so two layers added one after another — the ordinary way to build a reference list — arrived at ComfyUI with identical filenames, and the upload's `overwrite=true` meant the second silently replaced the first. Every `LoadImage` in the chain then read one picture: the background became a copy of the last reference, and the output canvas took that reference's size instead of the first one's. Multi-Reference is the first tool to upload more than one image per generation, which is why nothing had hit this before. Each reference now uploads under a name derived from its own list entry rather than its capture filename. Reproduced against live ComfyUI before the fix and confirmed against the original report's screenshot after it.

## v0.18.0-alpha - 2026-08-27

This release opens the Workflow section of the dashboard — three cards that were greyed out since v0.14 are live — and adds Style Reference to the Generate section as an experimental tool.

### Added

- **Style Reference** (experimental). Borrows a reference layer's mood and colour and applies it to a new generation. Pick any layer as the reference source, write your content prompt, adjust the strength dial, and generate — the result uses the reference image's palette and atmosphere without copying its shapes or composition. Built on IPAdapter Plus for SD 1.5 with CLIP-ViT-H-14 image encoding. Requires two one-time downloads that the Setup tab lists: IPAdapter (93.6 MB, Apache-2.0) and CLIP-ViT-H (2.35 GB, Apache-2.0). Marked experimental because the style transfer is real but the effect depends heavily on the reference image — photo-like references transfer clearly, flat cartoon or very abstract references may transfer little. Multi-reference composition, which works differently and is better suited to preserving identity across three source images, is planned for v0.19.

- **Workflow Presets catalogue.** The Workflow Presets card on the dashboard now opens a full list of every preset the panel ships, grouped by tool. Each row shows the preset's name, the node packs it needs, and the models it downloads. Nothing to install: the list is built from the same registry the Setup tab reads, so it is always in sync with what the panel actually knows about.

- **Custom Workflow checker.** The Workflow card opens a text area where you paste any ComfyUI graph — API format, exported via Save (API) from the ComfyUI editor — and the panel checks every node class in it against this server's installed node packs. The result names every class the server does not recognise and every required input that is not wired up, grouped per node, with a one-line summary. If you paste the wrong format (the editor's plain Save rather than Export (API)), it tells you which menu option to use instead. If the server is offline when you check, it says so.

- **Separate icons for Live Painting and Style Reference.** The two tools shared the same icon before this release. Live Painting keeps a variant of the original art; Style Reference has a new icon.

### Fixed

- **The custom workflow checker incorrectly blamed the server when all node classes in a graph were from an uninstalled pack.** When every class in a pasted graph is unknown, querying `/object_info` returns nothing — the same empty response as a server that stopped answering. The guard that distinguished the two was wrong: it threw an offline error for a graph that simply needed node packs installed. It now asks the server whether it is reachable before blaming it, so a missing-nodes result is reported as missing nodes and a genuinely offline server is reported as offline.

- **New model kinds (clip-vision, ip-adapter) always appeared installed.** The function that maps a model kind to its inventory bucket had a `default: return []` fallback that silently returned an empty list — which reads as "no models of this kind to find, therefore satisfied" — for any kind it did not recognise. The new kinds were not recognised. Added explicit cases so the bucket lookup returns the right list instead of an empty one.

### Changed

- **Style Reference wording narrowed after testing.** The subtitle previously implied visual language transfer. A flat cartoon reference was used as a real test, and the result was that the palette and mood transferred while the shapes did not — which is honest about what IPAdapter Plus actually does, but not what "match the style of" suggests. The subtitle now reads "Borrow a reference layer's mood and colour."

## v0.17.4-alpha - 2026-08-27

This release started as three prompt-box fixes and turned up a real bug along the way: past roughly 256 characters, a Photoshop UXP text field silently stops accepting input unless told otherwise, which was quietly truncating every prompt, every caption from Prompt from Layer, and every diagnostics report copied out of the panel. That is fixed everywhere a prompt is typed. Every prompt field also gets its own undo, independent of whatever the host does or doesn't support, and a screen header that could paint over the section below it — worst at the panel's smallest size — is pinned properly instead. The one new feature is the Prompt Wallet: save a favorite prompt from any tool with a small green circle, recall it from any other tool with a purple one.

### Added

- **The Prompt Wallet.** A small green circle inline in every tool's "Prompt" label saves the current positive and negative prompt together — they are one thought, and recalling one without the other loses half the work. A purple circle next to it loads one back: press it and the panel takes you straight to a new Prompt Wallet screen (Home → Tools & History) asking "Choose a prompt for `<tool>`", pick a card, and both fields fill in and you're back in the tool you started from. One library shared by every tool, so a prompt saved from Inpaint is just as reachable from Text to Image. The Wallet screen itself supports search, renaming, pinning a favorite to the top, copying to the clipboard, and deleting — deliberately not tags, color labels, or version history, which is how a panel this size stays out of the way rather than growing another control surface to learn.
- **Undo, on every prompt field, independent of the host.** Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y works too) now walk back through a prompt a word at a time, whether or not Photoshop's own UXP textarea happens to support undo — it is not something this panel assumes anymore.
- **Inpaint gets the "Import Automatically" button every other generating tool already had.** Nothing about inpainting made it the exception; it was simply never wired up.
- **A first-run screen that looks for ComfyUI on its own.** A stranger opening the panel for the first time used to discover the ComfyUI connection requirement by trial and error. It now runs the same port scan Settings' "Find ComfyUI Active Port" button always has, reports found or not found, and hands off to Setup for everything else. Shows once, ever.
- **A published privacy policy and terms of service**, linked from the README and both docs pages. Short version: nothing here was collecting anything to begin with — the policy is easy to write honestly because it's true.

### Fixed

- **A prompt longer than about 256 characters silently stopped accepting new text.** This was never a character limit anyone set; it is undocumented default behavior of a Photoshop UXP `<textarea>`, and two earlier theories about it (a rendering/scroll problem, a box that was too small) were both wrong, chased down and reverted before the actual cause was measured directly in the host. Every prompt field, the Prompt from Layer caption box, and the Settings diagnostics report all declare an explicit limit now, so none of them can hit it again.
- **A screen's header could paint over the section directly below it**, worst at the panel's narrowest size. It was pinned in place with `position: sticky`, which this host does not reflow content around the way a browser does; it is pinned with the same plain flex layout the panel's own top-level header and footer already use correctly, which cannot overlap a sibling regardless of what the renderer thinks about sticky.
- **The orange "needs setup" note could let its last line spill past its own border.** Same root cause as the header, in miniature: it was a flex row that didn't measure a wrapped line of text correctly in this host, so the box stayed shorter than the text it held.
- **The round info button that reveals a tool's warning note had its glyph sitting visibly off-center.** Traced through two wrong theories (a flex-centering bug, then an italic-lean bug) before landing on the actual fix: the circle background it sat in is gone, leaving plain colored text with no perfect-symmetry frame for a sub-pixel offset to read as wrong against.
- **"Ask the Agent for a Prompt" and "Show Negative Prompt" sat flush against each other** on Text to Image, with no margin between them.

### Changed

- **Removed Live Painting's "Zoom 2x" button.** It was reported not working, and redundant besides: the panel's own dockable Preview panel is a better answer to "I want to see this bigger," since it resizes freely instead of toggling between two fixed sizes.
- **The dashboard's brand icon** is a cleaner, transparent 152px version instead of the old opaque one.
- **The panel footer** now reads "OpenLayer v0.17.4 © By Mehran Ahmadi 2026".

### Known limitations

- **Prompt text does not persist across closing the panel.** An earlier draft of this release saved drafts to `localStorage` and restored them on the next launch; on testing, a prompt reappearing in a freshly opened panel read as a bug rather than a convenience, so it was removed. Text still survives switching between tools within one session, since those screens are hidden rather than rebuilt.
- **The Prompt Wallet is deliberately minimal** — no tags, color labels, version history, or import/export yet. Search and pinning cover organization at the size this library is expected to reach; the rest is real scope for later if the library outgrows that.

## v0.16.0-alpha - 2026-08-22

This release is mostly about the panel you look at while you work. There is a new dark theme built for artists rather than for matching Photoshop's chrome, the numeric parameters can be sliders now, the seed field has a dice button — and, underneath that button, a fix for a bug that has quietly been failing generations since long before the button existed. The one new generation capability is an inpaint preset for FLUX.2 Klein, so the fast Klein stack you may already have downloaded can now repaint a selection.

### Added

- **Artist-Friendly Dark, a third theme.** Offered in Settings alongside Compact Adobe Dark and Classic v0.4. It is a deeper, softer dark meant to sit behind artwork rather than blend into the Photoshop toolbar, and it is the theme that turns the numeric parameters into sliders. Compact Adobe Dark is deliberately untouched — every existing rule is byte-identical — so switching themes changes nothing about the panel you already know.

  The groundwork under it: the stylesheet's colours were extracted into tokens first, so a theme is now a small set of token overrides rather than a fork of the whole panel. Artist-Friendly Dark is forty overrides and nothing else.
- **Sliders for the numeric parameters, in Artist-Friendly Dark.** Detail (steps), Guidance (CFG), Strength (denoise), sketch influence and Live Painting strength become sliders; Compact Adobe Dark keeps the number boxes it always had. It is one control with two faces — the number input is still the single source of truth, and the slider writes through to it — so nothing about how a value is read or validated changed, and the labels keep the technical word searchable next to the artist one.
- **A dice button on the seed field**, on all five tools that have one. Press it to roll a fresh random seed instead of typing one. The die is drawn from the panel's own primitives rather than an icon font, for the same reason the rest of the panel is: Photoshop's UXP renders almost no embedded icon markup.
- **The Advanced settings disclosure remembers whether you left it open.** Each tool's parameter grid sits behind an "Advanced settings" toggle, and the panel used to re-collapse every one of them on reopen. Your choice is now remembered per screen — Text to Image expanded and Outpaint collapsed, if that is how you work — and stored separately from the generation defaults, so Reset Settings does not silently re-collapse a screen you chose to keep open.
- **FLUX.2 Klein inpainting: `inpaint-flux2-klein`.** The first inpaint preset that is not built on a Flux Fill model. It reuses the FLUX.2 Klein 4B stack you already have for Text to Image and Image to Image — no extra model download — and repaints a selection at four steps. Its only new requirement is the same `comfyui-inpaint-cropandstitch` node pack the crop-and-stitch Flux Fill preset uses, and it works the same way: it crops to your mask plus context, samples that at 1024, and stitches the patch back with a blended seam.

  It is marked experimental. It is strong at *adding* something to a small selection — the case where a naive masked sampler tends to repaint the surroundings and ignore you — and at replacing a large region. As with every inpaint preset, verify the result before relying on it.

### Fixed

- **The seed field mangled any wide seed to `214748.36`, and this failed generations.** A Photoshop UXP `<input type="number">` cannot hold a value above roughly 214748.36, so any seed wider than six digits — including every seed you loaded from session History, which are full-width server-side rolls — came back out as that one mangled string. Because a seed has to be a whole number, the run was then rejected outright with "Seed must be a whole number". This predates the dice button; `214748.36` is visible in the seed field in screenshots from before it existed. All five seed fields are now plain text fields that accept a numeric keypad, and hold the full range.
- **The progress bar glitched and rendered with a jagged edge.** Both are fixed, and a related round of interface tidying went with them — the prompt buttons no longer touch each other.

### Changed

- **The panel's colours now live in one set of tokens.** No visible change on its own; it is what made a real second theme possible without re-implementing the whole panel, and what any future theme will build on.

### Known limitations

- **`inpaint-flux2-klein` is experimental**, like the other inpaint presets. Its Krea2-Turbo sibling was evaluated and deliberately not shipped because it would not match the tone of the surrounding pixels reliably; Klein does. A Klein *outpaint* preset is still not shipped — the technique works in isolated tests but is not yet trusted through the panel.
- The slider faces and Artist-Friendly Dark are new; if a parameter reads differently between the slider and the number box, the number box is the truth. Please report it.

## v0.15.0-alpha - 2026-08-19

OpenLayer's tools can be driven by an AI assistant now, not only by clicking the panel. Ask Claude — or Codex, or anything else that speaks the Model Context Protocol — to generate an image, upscale a layer or caption a selection, and it drives the panel's own buttons in your open Photoshop document. It runs entirely on your machine, and it is off until you turn it on.

The important part is what it *cannot* do. The bridge holds no Photoshop code at all: its only two verbs are "run a tool the panel already has" and "read back what the panel said happened". Nothing in it can touch a layer, build a workflow, or reach `batchPlay`. An agent-driven generation and a clicked one are the same code path, so every safety rule the panel already enforces applies identically to both.

### Added

- **The Agent Bridge, covering all seven tools.** Text to Image, Image to Image, Sketch to Image, Inpaint, Outpaint, Upscale and Prompt from Layer are all reachable, plus a `get_panel_state` call that reports what the panel is doing without touching Photoshop. Only the parameters an agent passes are changed; anything it leaves out keeps whatever is currently in the panel, which is what makes "try that again at 30 steps" work as a sentence.

  Turn it on in **Setup → Agent Bridge**. It is off by default and stored separately from your generation settings, so Reset Settings cannot switch it on.
- **A `bridge/` folder holding two small Node programs.** `npm run hub` is the one you start and leave running, the way you leave ComfyUI running; the other is launched by your AI client and connects to it. They are separate because their lifetimes are: an MCP client starts and kills its own server with each session, while the panel needs something already listening before it can connect. Splitting them also means Claude, Codex and VS Code can all be connected at once, and closing any of them takes nothing down.
- **Ask the Agent for a Prompt**, under the Text to Image prompt box — the panel asking the assistant, rather than the other way round. Whatever is already in the prompt box is passed as context rather than overwritten, so pressing it a second time asks for another angle on the same idea. This one depends on your AI client rather than on OpenLayer; see the limitations below.
- **`npm test` now fails when the version numbers disagree.** The release version lives in eight places, and keeping them in step used to be a checklist item someone read. It is a test now, and it names whichever file is wrong.
- **FLUX.2 Klein 4B, text-to-image and image-to-image.** `txt2img-flux2-klein` and `img2img-flux2-klein` run Black Forest Labs' distilled Klein 4B at **4 steps, CFG 1** (`er_sde` / `simple`, `ModelSamplingAuraFlow` shift 3). That operating point is the whole point: a 1024x1024 generation completed in **11.6 seconds** on a 4070 Ti, against Flux.2 Dev's 20 steps through a 20 GB model. If Flux.2 has felt like a batch job rather than something you iterate with, this is the answer.

  The download is **4.07 GB** (`flux-2-klein-4b-fp8.safetensors`) plus a 336 MB VAE. The 8 GB `qwen_3_4b.safetensors` text encoder is the *same file* the Z_image_Turbo presets already use, and is named identically in the registry so the setup pack downloads it once rather than twice — if you already run Z_image_Turbo, Klein costs you 4.4 GB.

  Every node is core ComfyUI. **No new custom-node packages**, and unlike FLUX.1-dev and FLUX.2-dev, Klein is Apache-2.0 and ungated, so there is no licence click-through before you can download it.
- **`edit-flux2-klein` — instruction editing, which is not image-to-image.** Tell it what to *change* ("make the jacket red", "turn the sky to dusk") instead of describing the whole picture. It appears in the Image to Image tool alongside the other Klein preset.

  The difference is structural, not a settings tweak. Image-to-image encodes your layer as the starting latent and samples at denoise below 1, which is one dial between "keeps your image, ignores you" and "obeys you, discards your image" — measured on this exact model, denoise 0.7 held a photograph faithfully and ignored a plain style instruction outright. This preset starts from an *empty* latent at denoise 1 and supplies your layer as **conditioning**, through `ReferenceLatent` on both the positive and negative branches. The model is free to follow the instruction while still being told what the scene is.

  Asked to turn a wooden table to polished marble, it produced marble with a correct reflection of the teapot standing on it, and left the teapot, window and lighting alone. Denoise is hidden in the panel because it is fixed at 1 — that is the technique, not a default.
- **Context-aware Inpaint: `inpaint-flux-fill-cropstitch`.** A second Flux Fill preset that crops to your mask plus 50% context, samples that at 1024x1024, and stitches the patch back with a 32-pixel blended seam, using lquesada's [ComfyUI-Inpaint-CropAndStitch](https://github.com/lquesada/ComfyUI-Inpaint-CropAndStitch).

  OpenLayer already captured the selection plus padding rather than the whole document, so the win is not "we stopped sending the whole canvas" — it is that the captured context is now sampled at the resolution Flux Fill was trained for instead of at whatever size the selection happened to produce. A small mask on a large document no longer samples a few hundred pixels, and a large one no longer samples several thousand.

  It ships **alongside** `inpaint-flux-fill-basic` rather than replacing it, because it is the only preset whose custom-node dependency is optional: without the pack installed you keep the original preset and lose only the quality option. Both use the same model files, so the choice costs no extra download. The node pack is declared in the setup manifest, so Setup lists it as a requirement and Workflow Health names `comfyui-inpaint-cropandstitch` when it is missing rather than reporting an unexplained absent node.

### Fixed

- **Image to Image results sometimes landed in the wrong place.** The imported layer could arrive offset from the layer it was generated from, leaving you to drag it back by hand.

  The import never positioned the layer at all — it placed the file and let Photoshop decide. Photoshop's `placeEvent` centres on the active **selection** when one exists, and on the canvas otherwise, so a selection left over from Inpaint work silently pulled every subsequent Image to Image result towards it. Neither of those is the captured layer's position.

  Capture now records where in the document it read from, that position is frozen at submission time the way Outpaint already freezes its padding, and the import moves the layer there explicitly. With no captured region to return to, it centres on the canvas deliberately rather than by side effect.
- **v0.14.0-alpha displayed the wrong version in the panel.** It reported `v0.13.0` in the footer, in both diagnostics lines, and in the version stamped onto every entry in session history — so every tester report from that release named the wrong build. The constant had moved to a different file and the bump list quietly stopped including it. `package-lock.json` had been stale for two releases for the same kind of reason. Both are fixed, and the test above exists so this class of mistake cannot ship again.

### Known limitations

- **The bridge is not inside the download.** The `.ccx` and `.zip` contain the Photoshop panel only — a plugin package has no way to install or start a Node program. To use the Agent Bridge you need the repository: clone or download it, then `cd bridge && npm install && npm run hub`. `bridge/README.md` has the whole setup, including the one line to register it with Claude Code or Codex.
- **Ask the Agent for a Prompt only works with an AI client that supports MCP *sampling*.** That is the sole mechanism the protocol offers for a server to ask its client a question, and it is optional — a client that does not offer it has nowhere to send the request. When none of your connected clients can answer, the button refuses immediately and says so rather than hanging. Whether it works is a property of Claude Code, Codex or whatever you have connected, not a setting in OpenLayer. `get_panel_state` reports `answeringAgents`, which is how to tell.
- **An agent cannot capture a source for you.** Image to Image, Sketch to Image, Inpaint, Outpaint and Upscale all need a Photoshop layer or selection captured in the panel first, and there is no way for an assistant to do that — it has no hands in your document. Asking for one of these with nothing captured returns the same clear refusal a person gets for clicking Generate too early.
- **Everything is loopback-only and local.** The bridge binds `127.0.0.1` and nothing else. There is no cloud relay, by design and by omission.
- **One panel at a time.** If a second Photoshop panel connects, it replaces the first, and the first is told why. Several AI clients driving one panel is supported; one client driving two documents is not.

## v0.14.0-alpha - 2026-08-16

Sketch to Image finally has a preset that is not SD 1.x. Two, in fact: both load Alibaba-PAI's Z-Image Fun ControlNet Union patch on top of the Z_image_Turbo stack that Text to Image and Image to Image have used since v0.9.0, and neither needs a ControlNet in the sense the older presets do — the patch modifies the model itself rather than steering conditioning.

Getting there took four separate corrections, every one of them found by drawing in Photoshop rather than by a test passing, and the notes in `presetRegistry.ts` record each in detail because every one of them failed silently and would otherwise be rediscovered from scratch.

### Added

- **Two Z_image_Turbo Sketch to Image presets.** `sketch2img-zimage-fun-controlnet` uses the 2.0 GB lite weights, `sketch2img-zimage-fun-controlnet-full` the 6.7 GB full ones. They ship as siblings rather than one replacing the other because they measured as complementary rather than ranked: the full weights render shaded or densely drawn work far more photographically, while the lite weights hold bold sparse line art that the full weights flatten into a filled shape at any control strength. Their control-strength defaults differ for the same reason — 1.0 for lite, 0.6 for full, which patches fifteen layer blocks against lite's three, so an identical number is roughly five times the control.

  Both run through `ModelPatchLoader` and `ZImageFunControlnet`, which are core ComfyUI nodes rather than a new package, and both reuse the Z_image_Turbo model, CLIP and VAE already on disk for the existing presets. The only new download is the patch itself.
- **`model_patches` is a mapped model folder.** `ModelPatchLoader` reads `models/model_patches/`, which nothing in the registry described before, so the Setup and Workflow Health screens can now report a missing or misplaced patch the same way they already do for checkpoints, VAEs and ControlNets.
- **A preset can declare a minimum generation size.** Z_image_Turbo is a 1024-native model and does not degrade gracefully below it: on a 447px document the same seed produced the ControlNet's own line map over a maze-like texture at 448, bare glowing lines on black at 768, and a clean portrait at 1024. Presets that declare a floor are now generated at it, keeping the source aspect, and the finished image is scaled back down to the captured canvas so the imported layer still matches the document. Generating small and upscaling afterwards does not help, because the artefact is in what the model samples rather than in the pixels it is resized to.
- **A preset can override the panel's control-strength default**, which is what lets the two new presets ship the different defaults they need without touching the three SD 1.x sketch presets.
- **Setup and Workflow Health rows can open the page they are talking about.** An **Open** button sits beside Copy Link and opens the model card or the node package's repository in your own browser, through `uxp.shell.openExternal`. Copy Link stays exactly where it was: a panel that hands you a URL is still the only thing that works when the host refuses to open one, and Copy Folder Path was never a link at all. Open appears only where there is a human-readable page to open — never built from a model's direct download URL, because handing that to a browser starts fetching the file, and several of these are tens of gigabytes. A Workflow Health row for a node that ships with ComfyUI itself gets no button either, since there is nothing to install and therefore nothing to open. A missing model that is really just sitting in the wrong folder gets no button for the same kind of reason: it needs moving, not fetching.

### Fixed

- **The Sketch to Image model dropdown never refreshed for the selected preset.** Every other tool re-queries ComfyUI when its Workflow dropdown changes; Sketch to Image never had that, because until now all three of its presets read the same `CheckpointLoaderSimple` list and nobody noticed. Choosing a preset built on a diffusion-model stack left the old checkpoint list in place, so the model it actually needs was not selectable.

### Known limitations

- **Neither new preset takes a LoRA yet.** The eleven presets that gained one in v0.13.0 still have it; these two do not.
- **The three SD 1.x sketch presets are unchanged and still installed**, and `sketch2img-linecn-basic` is still the default Sketch to Image preset. Choosing a Z_image_Turbo preset is a deliberate act for now.
- **Both new presets depend on `comfyui_controlnet_aux`**, for the same line-art detector the LineArt preset uses. The graph would otherwise need no custom node package at all, but feeding these weights a photograph of a drawing rather than a real control map does not work — see below.
- **Sketches must be dark lines on a lighter ground.** Light-on-dark art needs inverting in Photoshop first.

### Notes on what failed, for anyone reading the workflow later

- Feeding the captured layer to the ControlNet unchanged renders the drawn strokes as an object embossed over an unrelated image. These weights expect the Canny/HED convention of light lines on a dark field.
- Simply inverting the layer is not enough either. Inversion only yields a black field when the paper is near-white, so a pencil drawing on toned paper inverts to a mid-grey field across the whole canvas, which the ControlNet reads as content — the sketch then comes back as glowing lines on a dark ground at every strength that controls anything at all.
- Plain Canny fails the other way, finding almost no edges in faint pencil at its default thresholds and double-tracing thick brush strokes into ribbons.

## v0.13.0-alpha - 2026-08-07

LoRAs, at last: every preset that loads a model and a text encoder — eleven of them, across Text to Image, Image to Image and Sketch to Image — now takes an optional LoRA. The panel has been able to list the LoRAs on your disk since long before it could use one.

Two presets that were quietly broken are fixed. Sketch to Image fed ControlNet a blank control image for light-on-dark art, so the sketch was ignored with no error at all. The Flux.2 dev (GGUF) preset that headlined v0.12.0 could not actually be run: its model dropdown never listed a `.gguf` file, and choosing it and pressing Generate failed outright. Both were reported by a tester using the release, which is what the alpha is for.

The Setup screen also downloads models now, which ends the withholding that ran through v0.12.0. It does not go through ComfyUI-Manager's catalogue — the thing that made the original design impossible — it downloads from the registry's own pinned URLs itself.

### Added

- **The Setup screen downloads missing models itself.** A missing model's row offers **Download** beside Copy Link, and OpenLayer fetches the file directly from the URL the registry pins, not from a third-party catalogue. The transfer is a sequence of 8 MiB ranged chunks appended straight to disk, so memory never holds more than one chunk and an 18.7 GiB model is no harder than a 700 MiB one — and an interrupted download resumes from where it stopped rather than starting over. One model at a time, only the one that was confirmed, and nothing starts until a confirmation names the file size, the destination folder, and the host it comes from. The host is on that confirmation deliberately: it is the only part of a long Hugging Face URL that says who is being trusted, and it is the part the path hides. When the bytes have landed, the claim that it worked is made by re-reading ComfyUI's own inventory rather than by the download reporting success, because a file on disk and a model ComfyUI can load are not the same fact.

  Every refusal written during the withholding is still in force, and each one is decided before the button is offered rather than discovered mid-download. Licence-gated weights are never fetched anonymously, because an unauthenticated request saves an HTML sign-in page under the model's filename and that is indistinguishable from a corrupt model until ComfyUI tries to load it. A model already on disk in a different folder asks you to move it instead of downloading a second copy. An entry published as a repository folder rather than a single file is refused and points at the model page. So is anything the registry has no direct URL for. A server that ignores the Range header and starts sending the whole file is refused too, rather than tolerated.

  **Still not automated:** custom node packages, licence-gated files, ComfyUI itself, and its Python dependencies.
- **An optional LoRA on eleven presets.** One dropdown and one strength control per tool. Choosing nothing leaves the workflow byte-identical to the one that ships, because a LoRA cannot be a permanently wired node whose value is merely set: ComfyUI's `LoraLoader` has no "none" entry, so a wired-in loader would force everyone to own and load a LoRA they may not want. The loader is spliced into the graph only when a LoRA is actually chosen, and the model and text-encode inputs downstream are rewired to it. This is the first time building a workflow changes its shape rather than its values, so each preset declares its own wiring rather than having it guessed — three genuinely different shapes turned up among the eleven, including one where the LoRA must be applied before a sampling-mode wrapper rather than at the sampler.
- **A Depth ControlNet Sketch to Image preset.** LineArt and Scribble both hold the drawn stroke; neither carries depth. This one conditions on estimated scene depth, so it holds perspective and the relative distance of forms — the preset to reach for when a generated element has to sit inside an existing composite at the right camera angle. It works from any shaded image, not only a line drawing, and needs one new ControlNet model. No new custom node package: the depth estimator comes from `comfyui_controlnet_aux`, which the sketch presets already required.
- **A Scribble Sketch to Image preset**, on the PiDiNet edge detector and the Scribble ControlNet, for loose gestural strokes where LineArt holds the drawn line too tightly. Its ControlNet model was already installed for most users and it needs no new node package.

### Fixed

- **Sketch to Image ignored the sketch entirely for a whole class of drawing.** `LineartStandardPreprocessor` assumes dark strokes on white paper, so light-on-dark art and solid filled shapes produced a pure-black control image — measured at 0% ink on a 1024px filled silhouette. ControlNet had no signal, the preset degraded to plain text-to-image, and nothing anywhere reported a problem. It now uses a learned, polarity-robust detector (`AnyLineArtPreprocessor_aux`, 1.14% ink on the same source). Both sketch preprocessors also run at 1024 rather than a hardcoded 512, which had been discarding line detail before ControlNet ever saw it.
- **The Flux.2 dev (GGUF) preset could not be selected or run.** Its Model dropdown asked ComfyUI's core `UNETLoader` for the file list, and that loader does not enumerate `.gguf` files at all — so a correctly installed quantised model was invisible no matter where it was placed. Pressing Generate then failed regardless, because the builder required a negative-prompt target on a preset that deliberately has none, Flux.2 being guidance-distilled with no negative conditioning node in its reference graph.

### Changed

- The Flux.2 GGUF workflow is now bundled with the panel like every other preset's, instead of being fetched at runtime — it was the only runnable preset left out of that map.

### Known limitations

- **The LoRA list cannot be filtered by which model a LoRA suits, and a mismatched one fails silently.** ComfyUI reports only a LoRA's name, size and timestamps; nothing reachable over the wire says what it was trained against. The metadata that would say is not served, and is not reliable even when read directly — two LoRAs on the reference machine declare `ss_base_model_version: sd_1.5` while their tensor keys are plainly Flux. So the panel lists every LoRA, labels the entries whose *filenames* suggest a match or a mismatch, sorts likely matches first, and warns. Picking a LoRA meant for another model loads without any error and then does nothing: an unchanged image is the symptom to expect.
- **A LoRA roughly doubles Flux.2's inference time**, which is already minutes per image on a 12 GB card.
- **Whether a Krea-2 LoRA trained on Raw behaves correctly on the Turbo checkpoint is unverified.** Krea's own guidance is to train on Raw and marks Turbo as not recommended for training, but no source addresses applying the result at Turbo's 8 steps.
- **The Depth preset downloads its depth estimator on first use.** The ControlNet weight is a normal setup download, but `DepthAnythingV2Preprocessor` fetches its own estimator the first time it runs, so the first generation is much slower than later ones. Depth estimation also needs tonal variation — a flat line drawing gives it little to read.
- Batch generation is designed but not built; the design note is in `docs/BATCH_GENERATION.md`. Image to Image cannot batch at all without further work, because it builds its latent from the captured layer.
- **Custom node packages still cannot be installed from the panel — only models.** Node rows keep Copy Link and go through ComfyUI-Manager: the git-URL route needs its non-default `allow_git_url_install` flag, and the queue route needs registry id, channel and mode fields OpenLayer does not carry.
- **The Flux.2 GGUF preset is slow on a 12 GB card, by a wide margin** — an 18.7 GB quantised model plus a 16.8 GB text encoder means ComfyUI streams most of it from system RAM. It also needs `mistral_3_small_flux2_fp8.safetensors`, which is licence-gated: accept the licence in a browser and download it by hand.
- **Live Painting is experimental.** The live tier needs an SD 1.5 LCM LoRA in `models/loras/`; the Refine tier additionally needs the three Krea-2 Turbo files.
- Setup and Workflow Health overlap on purpose for now. Setup answers "what do I need and where does it go"; Health answers "can I run this preset right now".
- "What will run well" reads the VRAM ComfyUI reports for its primary device. With ComfyUI stopped, every preset falls back to "Not known".
- **The `.ccx` one-click install is verified on one configuration only** — Windows 11, Photoshop 2025 (26.1.0). macOS and every other Photoshop version remain untested.
- The Layer Tools card on Home does not dim when ComfyUI is unreachable, unlike the generation tools.
- Layer, canvas, selection, and mask capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- The Preview panel offers each tool's primary import only.
- The setup pack contains no model weights — it ships the list and the downloader instead, so an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.12.0-alpha - 2026-08-01

Two things for people running Flux: a Text to Image preset for the GGUF-quantised FLUX.2-dev, and the end of a long-standing embarrassment — every preset the panel lists is now one you can actually run, because the two that never could have been are gone rather than still promising a workflow that was never coming.

Assisted install was meant to be the headline here and is **withheld from this release**. It was built against an assumption about ComfyUI-Manager that turned out to be wrong, the defect was found in testing rather than by a user, and the honest fix is a different download path rather than a patch. The reasoning is under Known limitations, in full, because a feature that quietly disappears between releases is worse than one that explains itself.

### Added

- **A Flux.2 dev (GGUF) Text to Image preset**, for `flux2-dev-Q4_K_M.gguf` through ComfyUI-GGUF's `UnetLoaderGGUF`. The graph is the Flux.2 template ComfyUI itself ships, read directly rather than reconstructed from documentation. It is the first OpenLayer preset built on the advanced sampler chain — `RandomNoise`, `KSamplerSelect`, `Flux2Scheduler` and `BasicGuider` feeding `SamplerCustomAdvanced` — instead of a plain `KSampler`, and it has no negative prompt because the reference graph has no negative conditioning node, so that control is hidden rather than wired to something that would quietly do nothing. Marked experimental; see the boundaries below for what it costs to run.
- **Setup knows about ComfyUI-GGUF**, which fails in a way that looks like nothing at all: it needs a `gguf` Python package its install does not always pull in, and without it the package imports silently, registers no classes, and every `.gguf` file becomes invisible to every loader. Naming the package means the panel can say which install is missing instead of reporting an unexplained absent node.

### Changed

- **Flux.2 is its own model family now.** Checkpoint detection used to match the substring "flux", so a Flux.2 filename read as Flux.1 and the panel called a preset compatible when its graph could not run the file at all. The two are not interchangeable — Flux.1 runs through a plain `KSampler`, Flux.2 needs the advanced sampler chain and a 128-channel latent at a 16× downscale where Flux.1 uses 16 channels at 8×, which is also why the Flux.1 VAE cannot decode these latents.
- **The two unfinished Flux1-dev presets are removed rather than completed.** They had advertised themselves in the panel as awaiting a workflow JSON since v0.2.2. Full-precision Flux1-dev is a 23.8 GB diffusion weight before its T5, CLIP and VAE, which does not fit the 12 GB cards this project targets, and `txt2img-flux1-dev-fp8` already ships stable and covers the same need. There was also no partial work to preserve: their model stack held one entry, the diffusion weight, with no CLIP, T5 or VAE, so finishing them meant building the stack from scratch. **Every preset the panel lists is now one you can actually run** — a first.

### Known limitations

- **Assisted install is withheld, and the Setup screen still only reports and copies.** It was built on the belief that ComfyUI-Manager's `install_model` endpoint would fetch a given URL on request. It will not. Before doing anything it checks the request against its own curated catalogue, matching `save_path`, `base` and `filename` exactly, and rejects everything else — so every request OpenLayer could build failed with HTTP 400 and nothing installed at all.

  Mapping the fields across would not have rescued it, which is why the feature is switched off rather than patched. **Only 7 of the 16 model files this project pins are in that catalogue** — Flux Fill, Krea-2 Turbo, Z_image_Turbo, Florence-2 and the whole Flux.2 stack are absent. And for several of the 7, the catalogue's download URL is not the one the registry pins: ComfyUI-Manager fetches `ae.safetensors` from the Black Forest Labs repository, where OpenLayer deliberately uses a public mirror **because that repository answers 401 without a token**. Delegating that download would save an authentication page under the model's filename — precisely the failure the licence-gate refusal exists to prevent, reintroduced by the mechanism that was supposed to be the safe path.

  What survives is the part that was right: the install plan, the refusals and the reason each one carries. A working version needs a download path that honours the registry's own verified URLs, and that is the next thing to build rather than a retry of this one.
- **The Flux.2 GGUF preset is slow on a 12 GB card, by a wide margin.** An 18.7 GB quantised model plus a 16.8 GB text encoder means ComfyUI streams most of it from system RAM: minutes per image, not seconds. It also needs `mistral_3_small_flux2_fp8.safetensors`, which is licence-gated: accept the licence in a browser and download it by hand.
- **Live Painting is experimental.** The live tier needs an SD 1.5 LCM LoRA in `models/loras/`, and Start Live Session reports an error naming it if none is found. The Refine tier additionally needs the three Krea-2 Turbo files; without them the live tier still works and Refine reports what is missing. Auto-import fires when you stop the session, by design.
- Setup and Workflow Health overlap on purpose for now. Setup answers "what do I need and where does it go"; Health answers "can I run this preset right now".
- "What will run well" reads the VRAM ComfyUI reports for its primary device. With ComfyUI stopped, every preset falls back to "Not known" and only the sizes are shown.
- The panel still cannot open a browser — `uxp.shell.openExternal` has never been called in this project — which is why rows offer Copy Link rather than a button that opens the page.
- **The `.ccx` one-click install works, and it is only verified on one configuration.** The file was not part of the tagged code: the tooling that generates it landed in `ec1f2f5` the day after the tag, and it was attached to this release on 2026-08-02 rather than reissued as its own version, because it changes no plugin behaviour. Double-clicking it installs the panel through Creative Cloud with no UXP Developer Tool and no developer mode — confirmed 2026-08-03 on Windows 11 with Photoshop 2025 (26.1.0), panel opening and running. **macOS and every Photoshop version other than 2025 remain untested.** Creative Cloud shows a "not verified by Adobe" prompt because the package is unsigned and not from Exchange, and the file must sit on the same drive as Photoshop or the installer will not find it.
- The Layer Tools card on Home does not dim when ComfyUI is unreachable, unlike the generation tools.
- Layer, canvas, selection, and mask capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- The Preview panel offers each tool's primary import only.
- The setup pack contains no model weights. They are roughly 120 GB now and four are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.11.0-alpha - 2026-08-01

Everything here is about the distance between installing OpenLayer and being able to generate anything with it. The panel has always known exactly which model files and custom nodes its presets need, and where each one goes, but it only said so one preset at a time, in the middle of a health report, using names like `txt2img-krea2-turbo`. This release turns that knowledge into a screen you can work from: what you still need, where it goes, how big it is, what it unlocks — and, once ComfyUI reports its VRAM, which of the presets your card will actually run well.

### Added

- **A Setup screen**, on Home under Preferences. It lists every model file and custom node package the presets need, each with the folder it belongs in, its download size, which tools it unlocks, and its live status: Installed, Wrong folder, Missing, or Not checked. Rows for things you already have collapse into a one-line summary, so what is left on screen is what you still have to do.
- **Models are the list, not presets.** The 13 runnable presets share 13 model files with heavy overlap — a preset-first list prints `ae.safetensors` four times and reads as roughly 18 GB of downloads that do not exist. The remaining-download figure is therefore the sum of what is actually missing, counted once each, and it says "Nothing" when you are done rather than a number.
- **The screen is useful with ComfyUI stopped.** The requirement list is static and the status is an overlay on top of it, so every name, folder, size and link is still there when nothing can be checked — which is the state most people are in when they go looking for what to download. The tallies show a dash rather than 0 in that case, because "0 missing" against a server that never answered reads as good news.
- **A file in the wrong folder is not a download.** `CheckpointLoaderSimple` reads `models/checkpoints/` and `UNETLoader` reads `models/diffusion_models/`; a file in the wrong one of those is invisible to the workflow and looks exactly like a file you never downloaded. Those rows say you already have the file, name the folder it is sitting in, and contribute zero to the remaining download.
- **Copy Link, Copy Folder Path and Copy Page on each row**, plus notes for the cases that trip people up: licence-gated files that need the licence accepted first, Florence-2's repo-folder layout where the loader opens a directory rather than a file, alternative filenames that also work, and the fact that a newly installed custom node needs a ComfyUI restart rather than a refresh.
- **Filter chips** narrow the list to one tool — the models Inpaint needs, say — while the tallies and the download total keep describing the whole report.
- **"What will run well" ranks the presets against your card**, at the bottom of the Setup screen next to the requirements it describes. Each preset is rated Comfortable, Tight, Will offload, or Not known, best first, using the VRAM ComfyUI reports for the primary device. The rating is based on the **largest single file** in a preset's stack rather than the sum, because ComfyUI loads and offloads components at different stages of a run, so the biggest resident chunk predicts speed better than the total does. The screen says plainly that these are weight sizes and not measured VRAM use, and that a stack too big for the card runs slower rather than failing.

### Changed

- **Presets have artist-facing names now.** Every preset gained a display name, so Workflow Health shows "Krea-2 Turbo" and "Flux Fill" with the tool named alongside, instead of the internal ids `txt2img-krea2-turbo` and `inpaint-flux-fill-basic` that had been on those cards for several releases.
- **The status badge is a squared label in small caps** rather than a rounded pill in sentence case, on both the Setup screen and Workflow Health. It was changed on the shared badge itself so the two screens keep one badge language rather than rendering the same idea two ways.
- Workflow Health's "Missing workflow JSON" is now "Needs workflow JSON" — it describes the two presets whose workflows have not been authored yet, not a file that went missing from your install.

### Fixed

- **A preset with an unpublished model size was ranked as the most comfortable thing on the list.** Florence-2 is one repo-folder model that publishes no size, so its stack measured zero bytes and sorted to the top. An unknown size is not a small size: it now blocks a "Comfortable" rating, while "Tight" and "Will offload" still stand, because the part that *is* known already reaches that much on its own. A stack whose sizes are all unpublished says "Size not published" instead of "At least 0 MB".
- **A fully set up machine was told the remaining download was "unknown".** The formatter that renders model sizes treats zero as "nobody published this size", which is right for a model and exactly backwards for a total that hits zero when everything is installed — the best possible outcome, showing only on machines where setup is complete, which is the one state least likely to be caught by hand.
- Fixed the Setup filter chips rendering as gold rectangles. They are buttons carrying `aria-pressed`, which is correct for them and also opted them into the compact theme's toggle-switch styling, so a chip saying which slice of a list you were looking at was drawn like a switch that was turned on.
- Fixed the same chips then rendering as tall ovals: a 999px radius is only a pill if you control the height, and theirs came out around 28px. Their height is now stated and the radius is half of it.

### Known limitations

- Setup and Workflow Health overlap on purpose for now. Setup answers "what do I need and where does it go"; Health answers "can I run this preset right now". If that turns out to be one screen too many, Health folds into Setup rather than the reverse.
- Nothing on the Setup screen downloads anything. It copies links and folder paths for you to use elsewhere; assisted install through ComfyUI-Manager is the next item on the roadmap. The panel cannot open a browser either — `uxp.shell.openExternal` has never been called in this project — which is why every row offers Copy Link rather than a button that opens the page.
- "What will run well" reads the VRAM ComfyUI reports for its primary device. With ComfyUI stopped, or on a setup it reports oddly, every preset falls back to "Not known" and only the sizes are shown.
- **Live Painting is experimental.** The live tier needs an SD 1.5 LCM LoRA in `models/loras/`, and Start Live Session reports an error naming it if none is found. The Refine tier additionally needs the three Krea-2 Turbo files; without them the live tier still works and Refine reports what is missing. Auto-import fires when you stop the session, by design.
- Installation still requires the UXP Developer Tool. Whether a `.ccx` double-click install works on a machine that has never had developer mode enabled is documented as an open question in `docs/DISTRIBUTION_SPIKE.md` and needs a clean second machine to answer.
- The Layer Tools card on Home does not dim when ComfyUI is unreachable, unlike the generation tools. Saving to a file works with ComfyUI stopped; Send to ComfyUI will fail and report the connection error on the Layer Tools status line.
- Layer, canvas, selection, and mask capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- The Preview panel offers each tool's primary import only.
- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.10.0-alpha - 2026-07-31

The first OpenLayer release whose plugin zip is built to the ZIP specification, which matters more than a packaging note usually would: every release from v0.1.0 to v0.9.0-alpha wrote its entry paths with backslashes, and macOS refuses to unpack those into folders. Everything else here follows from the same question — what happens to somebody setting this up without anyone to ask. Workflow health now tells you which folder your "missing" model is actually sitting in, missing nodes name the package that provides them, and Live Painting stops looking half-finished.

### Added

- **Check Workflow Health now answers "the file is missing, or is it just in the wrong folder?"** When a preset's model is absent from the folder its loader reads, the report searches the other model folders and names where it found it: "Found <model> in models/diffusion_models/, but this workflow reads it from models/checkpoints/. Move the file, then refresh ComfyUI." `CheckpointLoaderSimple` reads `models/checkpoints/` and `UNETLoader` reads `models/diffusion_models/`, and a file in the wrong one of those is invisible to the workflow while looking exactly like a file that was never downloaded. This has already been the real cause of several reported "bugs".
- **A missing custom node now names the repository that provides it**, and where to put it, instead of only naming the class that was absent. Nodes that ship with ComfyUI itself say so instead, because for those the answer is an outdated or partially broken install rather than a download.
- **Live Painting has a negative prompt**, collapsed behind a disclosure button like the one on Text to Image. Both live tiers already had a CLIP text encoder wired into the sampler as its negative conditioning with the text hardcoded to empty; this makes it an input. Left blank, it produces exactly the workflow earlier releases submitted.

### Fixed

- **Release zips now store entry paths with forward slashes, as the ZIP specification requires.** Packaging used to shell out to PowerShell's `Compress-Archive`, which writes backslashes. Windows Explorer and the UXP Developer Tool tolerate that, which is how it survived nine releases unnoticed; macOS `unzip` does not, and treats the whole string as a single filename, unpacking a flat directory with no `assets/` folder so the panel cannot render. Both archives now come from the same spec-correct writer the setup pack already used, and neither depends on a platform binary being installed. **If you are on macOS and an earlier release gave you a blank panel, this was why — use this release.**
- Fixed Start Live Session and Stop Live Session rendering flush against each other, at different heights. They were the only button pair in the panel with no container, and the compact theme gives a top margin to primary buttons and nothing to plain ones.
- Fixed both of Live Painting's explanatory hints being cut off after their first clause. The shared status-line style truncates to one line with an ellipsis, which is correct for the eight status bars it was written for and wrong for a paragraph, so the two hints now opt out on their own class rather than the shared style being loosened.
- Fixed the gap above "Import Refined as Layer", which had the same cause as the Start/Stop pair one section further down.

### Changed

- Live Painting's dependency hint now says which model the live tier will use and what to do when none is chosen, instead of implying the dependency. It runs whatever is selected in the Model dropdown on Text to Image, and until this release the sentence explaining that was one of the ones being truncated.

### Known limitations

- **Live Painting is experimental.** The live tier needs an SD 1.5 LCM LoRA in `models/loras/`, and Start Live Session reports an error naming it if none is found. The Refine tier additionally needs the three Krea-2 Turbo files (diffusion model, text encoder, VAE); without them the live tier still works and Refine reports what is missing. Auto-import fires when you stop the session, by design.
- Installation still requires the UXP Developer Tool. Whether a `.ccx` double-click install works on a machine that has never had developer mode enabled is documented as an open question in `docs/DISTRIBUTION_SPIKE.md` and needs a clean second machine to answer.
- The Layer Tools card on Home does not dim when ComfyUI is unreachable, unlike the generation tools. Saving to a file works with ComfyUI stopped; Send to ComfyUI will fail and report the connection error on the Layer Tools status line.
- Layer, canvas, selection, and mask capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- The Preview panel offers each tool's primary import only. Live Painting's second action, "Import Refined as Layer", is not on the panel, because the refined result is a separate image and the panel shows one at a time.
- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.9.0-alpha - 2026-07-27

Adds the eighth tool, and finishes the status cleanup the 0.8 releases started. Layer Tools is the first thing OpenLayer does that is not a generation: it moves pixels *out* of Photoshop, into a file or into ComfyUI's input folder, which is the step that has until now meant leaving the panel.

### Added

- Added **Layer Tools**, the Home card that has said "coming soon" since it was written. Three exports — the active layer, the current selection, the selection mask — each to two destinations: a file you pick with a real Photoshop save dialog, or straight into ComfyUI's input folder where a workflow can reference it by name. Photoshop can already export a layer as PNG; what it cannot do is put one where ComfyUI can see it, and the selection mask — the export that is genuinely awkward to produce by hand — is exactly what an inpainting workflow wants.
- The selection export uses the selection's own bounds, not the padded and snapped context bounds Inpaint uses. Inpaint pads because the model needs surrounding context; an artist exporting a selection wants what they selected.
- Send to ComfyUI reuses the same `/upload/image` call every generation already makes, rather than new plumbing.

### Changed

- `exportSelectionMask` in the Photoshop adapter had been fully implemented, working, and completely unreachable for several releases — no caller anywhere in the source. Layer Tools is its first caller. The two neighbouring functions, `exportActiveLayerAsPNG` and `exportSelectionAsPNG`, were stubs that threw, carrying TODOs that named v0.4 and v0.5; both are now implemented on the existing capture path.
- Layer Tools is the first tool written to the per-tool module shape the project has been moving toward: `src/ui/tools/layerTools.ts` takes its capture, save, upload, and message-formatting collaborators as parameters, so it contains no Photoshop, no `fetch`, and no DOM. The decisions worth arguing about — which capture runs, what the artist is told, what happens when they cancel — are unit-tested instead of being unreachable inside `renderApp`. A cancelled save is treated as neither success nor error, because colouring a change of mind red is how red stops meaning anything.
- `readActiveSelectionInfo` now takes a label for the caller, so its no-selection message names what the artist was actually doing. It used to tell every caller to make a selection "before using Inpaint", including callers that had nothing to do with Inpaint.

### Fixed

- Fixed one tool's diagnostics and error text appearing on the other tools' screens, the last part of the v0.7 status bleed. `setDiagnostics` wrote all eight diagnostics lines and `setError` wrote both the Text to Image and the Settings error line, because Text to Image owns the unprefixed elements from when it was the only tool in the panel — so "Generate pressed at 09:14:22.", "Seed used: 12345." and "Enter a prompt before generating." were broadcast to Inpaint, Upscale, Outpaint, Sketch to Image, Image to Image and Prompt from Layer. Each tool now writes its own diagnostics line plus the Settings line, which stays the panel-wide log, and keeps its errors to its own screen. Panel-wide diagnostics — the port scan, the GPU report, workflow health — report on Settings, where they are actionable. One visible consequence: each tool screen now keeps its opening hint ("Capture a Photoshop selection to prepare inpainting.") until that tool is actually used, instead of losing it to the first unrelated message.

### Known limitations

- The Layer Tools card on Home does not dim when ComfyUI is unreachable, unlike the generation tools. Saving to a file works with ComfyUI stopped; Send to ComfyUI will fail and report the connection error on the Layer Tools status line.
- Layer, canvas, selection, and mask capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- The Preview panel offers each tool's primary import only. Live Painting's second action, "Import Refined as Layer", is not on the panel, because the refined result is a separate image and the panel shows one at a time.
- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.8.1-alpha - 2026-07-27

A small follow-up to v0.8.0 carrying two changes that missed that tag. The reason it exists as its own release rather than waiting for v0.9 is the first entry below: the separated Preview panel gained its Import buttons the day after v0.8.0 shipped, and handing testers a build without them would spend a round of feedback on the panel's least finished state.

### Added

- Added the Import buttons to the separated Preview panel, so a result can be placed into the document from the large preview where it is actually being judged, instead of only from the thumbnail on the dashboard. The panel does not import anything itself — it forwards the request to the same seven import handlers the dashboard uses, because those handlers own the document-identity binding, the mask-ordering assertion, the transactional cleanup, and Inpaint's readiness contract. A preview image on its own carries no record of which document it came from, so importing it directly would place pixels into whichever document happened to be active.
- The panel's buttons follow the image on screen rather than the pinned tool, stay disabled during a run and on mid-generation live frames, and report the outcome on their own status line so the result is visible when the dashboard is docked out of sight. The auto-import toggle appears only for the three tools that have that setting — Text to Image, Image to Image, and Live Painting.

### Fixed

- Re-exported `img2img-z-image-turbo`'s editable source workflow, which held the vendor's Z-Image *text-to-image* demo graph rather than the image-to-image graph OpenLayer submits — no `LoadImage` or `VAEEncode`, an `EmptySD3LatentImage` generating a blank latent, one prompt encoder instead of two, and a bypassed LoRA loader. Nothing failed at runtime, because OpenLayer submits the API workflow and never the source; the cost was that anyone opening the file to learn the workflow got a graph that cannot do image to image. This was the last entry in the equivalence checker's known-mismatch list, so the list is now empty and the setup pack advertises an editable source for all eleven presets that claim one.

### Known limitations

- The Preview panel offers each tool's primary import only. Live Painting's second action, "Import Refined as Layer", is not on the panel, because the refined result is a separate image and the panel shows one at a time.
- The status fix from v0.8.0 still covers the status bars only. The diagnostics line and the error text continue to mirror across tools: `setDiagnostics` writes all eight diagnostics lines, and `setError` writes both the Text to Image and the Settings error line. Same shape of fix, still deferred.
- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.8.0-alpha - 2026-07-27

Correctness-and-maintainability release with no new generation capability: it stops one tool's status appearing in another's status bar, fixes the error-details crash and the progress bar painting over the form, closes the preview-pinning and missing-source-workflow limitations from v0.7, and continues breaking up `App.ts`.

### Added

- Added a tool selector to the separated Preview panel so it can stay pinned to one tool instead of always following the latest publisher. The selection has its own `localStorage` key and survives restarts.
- Added a workflow-pair checker that compares every editable GUI source workflow with its API-format twin. The previous checks could catch a missing file or a mismatch with the preset registry, but could not detect source/API drift.
- Exported the four editable GUI source workflows that registered presets named but the repository did not contain: `txt2img-basic`, `img2img-basic`, `sketch2img-linecn-basic`, and `inpaint-basic`. Ten of the eleven presets that claim an editable source now ship one.
- Added ESLint to CI, including a rule that rejects `TextEncoder` and `TextDecoder` in `src/`. Node provides those globals, so TypeScript and Vitest could accept code that would fail in Photoshop UXP.
- Added `npm run audit-css` and `docs/css-audit.md` to measure the current stylesheet before consolidation. This release records the duplication but deliberately changes no CSS.

### Changed

- Continued decomposing `App.ts` by extracting tool error messages, status-bar handling, and the DOM event wiring into `toolErrorMessages.ts` (296 lines), `statusBars.ts` (383), and `appBindings.ts` (631). `App.ts` has fallen from 6,112 lines at v0.7.0 to 4,922, and from a peak of 8,149, making these behaviors easier to test and change in isolation.
- Wrote down how the two assistants working on this project divide the work, in `docs/ORCHESTRATION.md`: one implements, the other reviews, and each contribution is a separate commit so a pull request shows who did what.
- Bumped plugin, package, visible UI, and landing page metadata to `0.8.0` / `v0.8.0-alpha`.

### Fixed

- Fixed `getTechnicalErrorDetails` crashing while trying to explain another failure. Extracting the error-message helpers exposed the bad path and allowed it to be covered directly.
- Fixed Text to Image progress appearing in Inpaint, Upscale, and the other tool status bars. The old `setStatus` wrote the global bar and all seven tool and Settings bars on every call; global and Text to Image status now have separate update paths.
- Fixed the home-screen status row rendering on every tool screen and colliding with the sticky header during generation. It now stays on Home because each tool already shows the same message in its own status bar.
- Fixed the progress bar painting over the first section of the form during a run. Since v0.6 the bar had been moved up into the sticky screen header, which made the header change height the moment a run started, and Photoshop UXP does not reflow the panels below a sticky element that resizes. The bar now stays where the markup puts it, in the generation status panel under the status text it describes, and the sticky header holds the navigation and nothing else, at a constant height on every screen. The trade-off is that progress no longer stays pinned while the form is scrolled.
- Removed the hairline below the screen navigation, which Photoshop UXP drew as a stray part-width line rather than the full-width rule a browser draws. The header's own opaque background already separates it from the form.

### Known limitations

- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.
- `img2img-z-image-turbo` is the one preset whose editable source workflow does not match its API twin — the new checker reports the differing nodes and omits that source from the setup pack's `REQUIREMENTS.md` until it is re-exported. The preset itself still runs, because the API workflow is what OpenLayer submits.
- The status fix covers the status bars only. The diagnostics line and the error text still mirror across tools: `setDiagnostics` writes all eight diagnostics lines, and `setError` writes both the Text to Image and the Settings error line. Same shape of fix, deferred to a later release.
- Progress is no longer visible while a tool's form is scrolled past the status panel, which is the accepted cost of taking the bar out of the sticky header.

## v0.7.0-alpha - 2026-07-25

Release focused on getting previews out of the cramped side panel and getting a new machine to a working ComfyUI without guesswork.

### Added

- Added a second dockable Photoshop panel, **OpenLayer Preview**, showing the current generation at whatever size you drag it to. It mirrors every preview surface — Text to Image, Image to Image, Sketch to Image, Inpaint, Outpaint, Upscale, and Live Painting — with a tool badge that marks frames still arriving, a 1:1 / Fit toggle, and a checkerboard backdrop so transparent results read correctly.
- Added a generated ComfyUI setup pack, `npm run setup-pack`, producing `packages/openlayer-comfyui-setup-<version>.zip`: the workflows, an exact per-model requirements list, and a PowerShell downloader that fetches each model into the folder ComfyUI actually reads it from. Generated from the preset registry, so it cannot drift from the presets it describes.
- Added download URLs, verified sizes, and derived install folders for all 13 models the runnable presets need. Every URL was checked with a live request, and where the model was already installed locally the served size matched the working file byte for byte.
- Added licence gating for the two Flux weights. The downloader refuses to fetch them without an explicit acknowledgement and prints the non-commercial terms first.

### Changed

- Prompt from Layer no longer needs the `comfyui-custom-scripts` custom-node pack. Its caption is now published by core ComfyUI's `PreviewAny`, leaving `comfyui-florence2` as the only requirement for that tool.
- Moved UXP panel-entrypoint registration into a small standalone script loaded ahead of the application bundle. Adobe's `entrypoints.setup()` throws when called more than about 20ms after plugin start (their PS-57605), which a deferred bundle can never satisfy.
- The build now asserts that early script is present, undeferred, and ahead of the bundle, because a missing one fails as a silently blank panel in Photoshop rather than a build error.
- Bumped plugin, package, visible UI, and landing page metadata to `0.7.0` / `v0.7.0-alpha`.

### Fixed

- Fixed the separated preview panel opening blank and refusing to resize. It was never being initialised, so Photoshop collapsed it to its minimum size.
- Fixed a preview listener that threw on its first render being able to break whatever attached it.

### Known limitations

- The setup pack contains no model weights. They are roughly 85 GB and two are licence-restricted, so it ships the list and the downloader instead — an internet connection is required.
- The preview panel always follows whichever tool published most recently. Pinning it to one tool is designed but not built.
- Four presets name an editable GUI workflow that was never exported. The setup pack reports them and omits them rather than advertising files it does not contain.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.6.0-alpha - 2026-07-13

UXP interface release focused on a denser Photoshop-native workflow, dependable progress feedback, and final real-panel rendering fixes.

### Added

- Added a compact Adobe-style dashboard with grouped tool rows, richer icons, clearer availability states, and a restored Workflow disclosure.
- Added sticky tool headers and determinate ComfyUI progress driven by the dedicated numeric WebSocket progress channel.
- Added collapsible Advanced settings, status-pill tones, toggle chips, import success feedback, and compact experimental-info controls.

### Changed

- Standardized form gutters, panel spacing, tool-screen headers, preview zoom behavior, and progress placement across the compact theme.
- Enlarged prompt editors for Photoshop UXP, including a three-times-taller Prompt from Layer generated-text field, while retaining normal scrolling and manual resize behavior.
- Dimmed unavailable dashboard tools more clearly and switched compact controls to UXP-safe typography and explicit pixel spacing.
- Removed obsolete `control_after_generate` fields from bundled workflow JSON files.
- Bumped plugin, package, visible UI, landing page, and archive metadata to `0.6.0` / `v0.6.0-alpha`.

### Fixed

- Fixed panel actions firing twice from overlapping UXP click and pointer events.
- Fixed UXP header icons, titles, and Back to Tools controls touching or collapsing together.
- Fixed the header progress bar rendering as a short or malformed strip in Photoshop.
- Removed unreliable textarea auto-grow behavior that could make long prompt entry appear to stop accepting text in UXP.

### Known limitations

- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- Prompt from Layer still requires the local Florence-2 PromptGen workflow, custom nodes, and model files.
- CI covers pure TypeScript behavior but does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## v0.5.5-alpha - 2026-07-11

Correctness and trust release: working inpaint uploads, safe cancel, aligned inpaint context, and honest status copy.

### Fixed

- Fixed ComfyUI uploads losing their filenames in Photoshop UXP. UXP's FormData saved every upload as a file named `blob`, so the Inpaint mask upload overwrote the source upload and both LoadImage nodes read the mask. Uploads now build the multipart body manually with an explicit filename per file, and inpaint-basic composites over the real captured source again.
- Fixed the Photoshop "Make is not currently available" alert during Inpaint Import to Layers. Photoshop's place command clears the active selection, so the layer mask import now restores a selection from the captured Inpaint bounds and falls back to aligned context import cleanly when no selection can be restored.
- Fixed inpaint misalignment caused by ComfyUI VAE rounding: the captured inpaint context now snaps to multiples of 8 so the generated result matches the captured context size exactly.
- Fixed multipart encoding to work without TextEncoder, which Photoshop UXP does not expose.

### Added

- Added per-preset recommended generation defaults. `txt2img-basic` now starts at 20 steps, and switching workflow presets applies that preset's recommended steps and CFG/guidance values.
- Added queue-aware Cancel Generation: prompts still waiting in the ComfyUI queue are removed with a queue delete instead of interrupting whatever job is currently running, and diagnostics report whether the prompt was dequeued or interrupted.
- Added a 16-megapixel capture guard so very large layer/canvas/mask captures fail fast with a friendly message instead of risking UXP memory failures.
- Added the `clipboard` and `launchProcess` manifest permissions used by Copy Diagnostics, Copy Prompt, and the footer links.

### Changed

- ComfyUI WebSocket preview frames are now received as arraybuffer for UXP reliability. Live KSampler step previews appear in the result preview when ComfyUI is started with `--preview-method auto`.
- The Outpaint and Sketch to Image tool cards now show the Experimental badge to match their preset status, and Z_image_Turbo warnings plus the hardware advisor no longer claim those presets are disabled.
- Bumped plugin/package metadata to `0.5.5`.

### Known limitations

- Live sampler previews require ComfyUI to be started with `--preview-method auto`, and the preview panel may flicker between steps until the planned UI polish pass.
- Capture is limited to 16 megapixels (4096 x 4096) until a downscale option is added.
- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.

## v0.5.3-alpha - 2026-07-05

Release checkpoint for the current public alpha package and landing page.

### Release status

- Verified package and manifest metadata are aligned at `0.5.3`.
- Synced README, landing page copy, release checklist, and release notes around `v0.5.3-alpha`.
- Confirmed the current tester focus: Text to Image, Image to Image, Z_image_Turbo, experimental Flux1-dev fp8 Text to Image, Prompt from Layer, Upscale, Workflow Health, Cancel Generation, session History metadata, and experimental Flux Fill Inpaint.
- Kept Outpaint clearly marked Experimental.

### Known limitations

- Inpaint and Outpaint remain experimental and should be tested on duplicate layers or disposable documents.
- `inpaint-basic` may not match the source as reliably as the experimental Flux Fill path.
- Prompt from Layer requires the local Florence-2 PromptGen workflow, custom nodes, and model files.
- Upscale is pixel/model upscale only. It does not include latent upscale, tiled diffusion, prompt-based enhancement, or creative upscale yet.
- Custom workflow import, LoRA browser, batch variants, ControlNet panels, and true persistent Photoshop layer metadata remain future work.
- CI does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

### Not changed

- No generation logic, workflow JSON, ComfyUI client behavior, model loading, Photoshop import behavior, Inpaint/Outpaint behavior, or UI redesign changes are included in this checkpoint.

## v0.5.1-alpha - 2026-07-02

Technical stabilization for AI layer metadata and setup diagnostics.

### Added

- Added a typed OpenLayer AI layer metadata model for prompt, negative prompt, workflow preset, model, seed, dimensions, source mode, source/context bounds, import timestamp, experimental status, and diagnostics summary.
- Added pure metadata helpers for creating, sanitizing, serializing, and summarizing generated/imported result metadata.
- Added a best-effort Photoshop layer metadata writer that reports a clear unsupported fallback when safe UXP layer persistence is not exposed.
- Added inpaint/outpaint debug contract helpers for source mode, source dimensions, mask dimensions, mask polarity, context bounds, output kind, and import mode.
- Added unit coverage for layer metadata helpers, inpaint/outpaint debug contracts, and the layer metadata fallback writer.

### Changed

- Reused the new metadata helper for session history entries so current history and future persistent AI layer metadata share one data shape.
- Improved Workflow Health wording with beginner-friendly next checks for missing model files, missing ComfyUI nodes, missing workflow JSON, setup-required presets, and missing Photoshop inputs.
- Bumped plugin/package metadata to `0.5.1`.

### Not Changed

- No workflow JSON, generation behavior, ComfyUI client behavior, import behavior, Inpaint/Outpaint quality, or UI redesign changes are included in this checkpoint.
- Photoshop layer metadata persistence remains fallback-only until a safe host-supported route is verified.

## Unreleased / v0.5.0-alpha draft - 2026-07-02

Compact Adobe-style UI stabilization pass.

### Added

- Added a Settings theme selector with `Compact Adobe Dark` as the default and `Classic v0.4` as an optional legacy visual style.
- Added persisted theme preferences so the selected panel theme survives reloads.

### Changed

- Redesigned the Home screen into a compact single-column tool launcher with smaller icons, clearer tool rows, status badges, and navigation affordances.
- Applied shared spacing, typography, button height, input height, preview, panel, footer, and diagnostic polish across existing tool screens.
- Bumped plugin/package metadata to `0.5.0`.

### Not Changed

- No generation logic, workflow JSON, ComfyUI client logic, model detection, import behavior, Inpaint behavior, Outpaint behavior, History behavior, or Settings diagnostics behavior changed in this checkpoint.

## Unreleased / v0.4.10-alpha draft - 2026-07-01

Image to Image auto-import and experimental pixel Upscale foundation.

### Added

- Added an Image to Image `Import Automatically` toggle so successful Image to Image results can be imported into Photoshop as a new layer without a second click.
- Added an experimental Upscale dashboard card and Upscale screen.
- Added the experimental `upscale-basic` preset using ComfyUI `LoadImage`, `UpscaleModelLoader`, `ImageUpscaleWithModel`, and `SaveImage`.
- Added source capture, source preview, upscale model selection, result preview, import, optional auto-import, cancel support, and history metadata for Upscale.
- Added ComfyUI model inventory support for `UpscaleModelLoader` model lists.
- Added unit coverage for `upscale-basic` preset registration and workflow injection.

### Changed

- Bumped plugin/package metadata to `0.4.10`.
- Kept Inpaint and Outpaint marked Experimental and unchanged.

### Known Limitations

- Upscale is pixel/model upscale only. It does not use prompts, latent upscale, tiled diffusion, or creative enhancement yet.
- Upscale needs a local model such as `4x-UltraSharp.pth` or `RealESRGAN_x4plus.pth`.
- No Inpaint, Outpaint, Prompt from Layer, Z_image_Turbo, or Flux workflow behavior changed in this checkpoint.

## Unreleased / v0.4.9-alpha draft - 2026-06-30

Global generation safety and richer session history checkpoint.

### Added

- Extended Cancel Generation from Text to Image to the other active tools: Image to Image, Sketch to Image, Inpaint, Outpaint, and Prompt from Layer.
- Added shared ComfyUI interrupt handling for active generation tools, including watcher/polling cleanup and a clear `Generation cancelled.` status.
- Expanded session history metadata with tool type, workflow preset, model, prompt, seed, dimensions, source mode, timestamp, and import status.
- Added a safe History `Reuse Settings` action for generated-image entries.
- Added unit coverage for History metadata formatting helpers.

### Changed

- Bumped plugin/package metadata to `0.4.9`.
- Kept Inpaint and Outpaint marked Experimental; no inpaint/outpaint workflow behavior changed in this checkpoint.

### Known Limitations

- Cancel Generation uses ComfyUI's local interrupt endpoint, but it cannot undo work ComfyUI has already completed.
- History remains session-local and does not persist generation metadata into Photoshop layers yet.

## Unreleased / v0.4.8-alpha draft - 2026-06-30

Build hygiene and Outpaint availability checkpoint.

### Changed

- Bumped plugin/package metadata to `0.4.8`.
- Rebuilt the production bundle so the experimental Outpaint screen and workflow assets are included in `dist`.
- Confirmed pnpm cache/workspace artifacts are ignored and removed the local `.pnpm-store` cache from the workspace.

### Known Limitations

- Outpaint remains experimental and should be tested carefully with the local Flux Fill stack.
- No generation behavior, ComfyUI workflow behavior, or UI redesign changes are included in this checkpoint.

## Unreleased / v0.4.7-alpha draft - 2026-06-29

Flux1-dev fp8 Text to Image preset and safe generation cancellation foundation.

### Added

- Added experimental `txt2img-flux1-dev-fp8` as a runnable Text to Image preset based on the attached checkpoint-style ComfyUI workflow.
- Added `src/workflows/api/txt2img-flux1-dev-fp8.json` and preserved the GUI source workflow as `src/workflows/source/txt2img-flux1-dev-fp8.workflow.json`.
- Added experimental `prompt-from-layer-florence2` as a runnable Prompt from Layer text workflow based on the attached Florence-2 PromptGen graph.
- Added `src/workflows/api/prompt-from-layer-florence2.json` and preserved the GUI source workflow as `src/workflows/source/prompt-from-layer-florence2.workflow.json`.
- Added ComfyUI text-output polling and history parsing so OpenLayer can read `ShowText`/Florence caption output.
- Added Prompt from Layer controls for task selection and `num_beams`, defaulting to `detailed_caption` and `12`.
- Added experimental `outpaint-flux-fill-basic` as a runnable Outpaint preset based on the attached Flux Fill outpaint workflow.
- Added `src/workflows/api/outpaint-flux-fill-basic.json` and preserved the GUI source workflow as `src/workflows/source/outpaint-flux-fill-basic.workflow.json`.
- Added Outpaint controls for source capture, Flux Fill model selection, padding sides, feathering, prompt, seed, guidance, denoise, preview, and import.
- Added Workflow Health metadata for `flux1-dev-fp8.safetensors`, `CheckpointLoaderSimple`, `EmptySD3LatentImage`, `FluxGuidance`, `KSampler`, `VAEDecode`, and `SaveImage`.
- Added a Text to Image `Cancel Generation` button that appears only while generation is active.
- Added ComfyUI `/interrupt` support plus local watcher/poll cancellation handling.
- Added unit coverage for Flux1-dev fp8 and Prompt from Layer preset registration, workflow injection, workflow health, text-output parsing, and cancel request helpers.

### Changed

- Bumped plugin/package metadata to `0.4.7`.
- Kept `txt2img-basic`, `txt2img-z-image-turbo`, Image to Image, Sketch to Image, Inpaint, Settings, and imports unchanged.
- Flux1-dev fp8 maps the UI CFG control to `FluxGuidance.guidance`; the sampler CFG stays at `1` to match the attached ComfyUI workflow.

### Known Limitations

- Flux1-dev fp8 Text to Image is experimental and should be tested against the user's local ComfyUI setup.
- Prompt from Layer is experimental and requires `comfyui-florence2`, `comfyui-custom-scripts`, and `Florence-2-base-PromptGen-v2.0`.
- Outpaint is experimental and requires the Flux Fill stack: `flux1-fill-dev.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors` or the accepted T5 fp8 fallback, and `ae.safetensors`.
- Cancel Generation asks ComfyUI to interrupt and stops OpenLayer polling, but it cannot undo a job ComfyUI already completed.
- Inpaint and Flux Fill remain experimental and were not redesigned or fixed in this run.

## Unreleased / v0.4.6-alpha Flux Fill follow-up - 2026-06-29

Experimental Flux Fill inpaint workflow alignment with a tested ComfyUI reference graph.

### Added

- Added `src/workflows/source/inpaint-flux-fill-basic.workflow.json` as the GUI-editable source reference for the Flux Fill preset.
- Added a pure TypeScript Flux Fill source/mask bridge that embeds OpenLayer's white repaint mask into the uploaded PNG alpha channel for ComfyUI `LoadImage`.
- Added unit coverage for the Flux Fill alpha-mask bridge and the ported reference graph mapping.
- Added separate Inpaint source capture modes for Visible Canvas and Active Layer, plus diagnostics for accidental visible OpenLayer result layers.
- Added an experimental Photoshop-native layer-mask import attempt for Inpaint with aligned context fallback if Photoshop rejects the mask command.

### Changed

- Replaced the guessed `inpaint-flux-fill-basic` API workflow with the reference-style graph using `UNETLoader`, `DifferentialDiffusion`, `DualCLIPLoader`, `FluxGuidance`, `ConditioningZeroOut`, `InpaintModelConditioning`, regular `KSampler`, `VAEDecode`, and `SaveImage`.
- Corrected Flux Fill `DualCLIPLoader` mapping to use `clip_l.safetensors` on `clip_name1` and `t5xxl_fp16.safetensors` on `clip_name2`, while keeping `t5xxl_fp8_e4m3fn.safetensors` as an accepted T5 fallback.
- Removed the Flux Fill `ImageCompositeMasked` output path from the experimental API workflow so the saved result comes directly from the decoded inpaint result.

### Known Limitations

- Inpaint and Flux Fill remain experimental.
- Flux Fill still needs manual Photoshop + ComfyUI testing for final output quality, mask polarity, and aligned import behavior.
- OpenLayer still imports the Flux Fill result as an aligned context layer; Photoshop-native layer-mask import remains future work.
- Photoshop-native layer-mask import is experimental and must be verified in real Photoshop documents before it can replace fallback behavior.

## Unreleased / v0.4.6-alpha draft - 2026-06-28

Settings diagnostics readability and public alpha release-readiness pass.

### Added

- Added Workflow Health summary cards for Ready, Experimental, Missing setup, and Needs workflow counts.
- Added collapsed technical details for workflow health cards so artists see short readable messages first.
- Added a public alpha release checklist in `docs/release-checklist.md`.
- Added clearer local permission notes for filesystem, local ComfyUI network access, and local-only diagnostics.
- Added Flux Fill preflight validation for source/mask presence, matching dimensions, and selection context before submitting the experimental inpaint workflow.
- Added Flux Fill debug diagnostics showing preset, source size, mask size, model stack, and the current white-mask-means-repaint assumption.
- Added Inpaint output diagnostics for source, mask, raw result dimensions, output kind, mask polarity, and import mode.
- Added temporary local debug copies for Inpaint source PNG, mask PNG, and raw generated result PNG.
- Added Inpaint output selection by expected `SaveImage` node so uploaded source/mask images are not mistaken for final ComfyUI results.

### Changed

- Bumped plugin/package metadata to `0.4.6`.
- Rebuilt the Settings diagnostic layout with UXP-safe block and flex rules so panels and buttons stack cleanly in narrow Photoshop panels.
- Moved Settings actions into one full-width action stack: Check ComfyUI, Find ComfyUI Active Port, Detect GPU, Check Workflow Health, Copy Diagnostics, Save Settings, and Reset Defaults.
- Simplified Hardware Advisor rows and shortened the Z_image_Turbo / Flux explanation in Settings.
- Updated the experimental Flux Fill model-stack metadata to prefer `t5xxl_fp16.safetensors` while accepting `t5xxl_fp8_e4m3fn.safetensors` as a local T5 fallback.
- Updated `inpaint-flux-fill-basic.json` to use the wiki-style DualCLIPLoader mapping with T5 on `clip_name1` and CLIP-L on `clip_name2`.
- Disabled the active transparent mask compositing import path for now so Photoshop UXP cannot get stuck on `Preparing transparent inpaint patch...`.
- Kept Inpaint import fallback explicit: generated Inpaint results now import with aligned context fallback until a Photoshop-native layer mask strategy is implemented.
- Synced the GitHub Pages landing page with the v0.4.6-alpha release story, including PNG/lossless capture, GPU/VRAM diagnostics, Workflow Health, Copy Diagnostics, Z_image_Turbo experiments, Prompt from Layer foundation, and experimental Inpaint/Repaint Selection.
- Kept Inpaint, Flux Fill, Prompt from Layer, and custom workflow import messaging honest for public alpha testing.

### Known Limitations

- This release-readiness pass does not change generation behavior, workflow JSON files, model loading, ComfyUI requests, or import behavior.
- Workflow Health remains advisory and technical details are still meant for setup/debugging, not everyday artist controls.
- Inpaint/Repaint Selection remains experimental and output quality/alignment are not confirmed stable.
- Flux Fill remains experimental and still needs real Photoshop + ComfyUI testing for quality, mask polarity, and aligned import behavior.
- Transparent outside-mask import is disabled in the active Photoshop path because UXP canvas/blob compositing is not trusted yet. OpenLayer uses aligned context fallback and reports that in diagnostics.
- CI does not run Photoshop, UXP Developer Tool, or ComfyUI integration tests.

## Unreleased / v0.4.5-alpha draft - 2026-06-28

Settings diagnostics stabilization for readable workflow health testing.

### Added

- Added a Copy Diagnostics action in Settings that prepares a compact local setup report for tester feedback.
- Added clearer Settings guidance explaining that `Z_image_Turbo` is a diffusion model stack, not a checkpoint, and that Flux presets still need matching workflow JSON.

### Changed

- Bumped plugin/package metadata to `0.4.5`.
- Reworked the Settings diagnostics layout so panels, buttons, hardware rows, and workflow health cards remain readable in narrow Photoshop panels.
- Grouped Workflow Health results into readable preset cards with artist-facing summaries and secondary technical detail.
- Improved workflow health summary wording, including missing workflow JSON counts.
- README tester notes now include Copy Diagnostics and Settings readability checks.

### Known Limitations

- This is a diagnostics polish release. It does not change generation behavior, workflow JSON files, model loading, or import behavior.
- Workflow Health remains advisory and does not auto-install models, remap workflow node IDs, or enable future Flux presets.

## Unreleased / v0.4.4-alpha draft - 2026-06-28

Workflow health diagnostics foundation for safer local setup testing.

### Added

- Added a Settings workflow health checker that evaluates every registered preset against local ComfyUI node classes and installed model files.
- Added compact readiness states for Ready, Experimental, Missing model, Missing ComfyUI node, Missing workflow JSON, and Setup required.
- Added ComfyUI node-availability inspection through `/object_info` without changing any generation paths.
- Added unit coverage for workflow health states, including Z_image_Turbo stack readiness and future Flux missing-workflow behavior.

### Changed

- Bumped plugin/package metadata to `0.4.4`.
- README tester notes now include the Settings workflow health check.

### Known Limitations

- Workflow health is diagnostic only. It does not auto-install missing models, remap node IDs, or enable future Flux presets.
- Existing generation behavior, workflow JSON files, imports, and panel design are unchanged.

## Unreleased / v0.4.3-alpha draft - 2026-06-28

Workflow compatibility checkpoint for Z_image_Turbo and future layer captioning.

### Added

- Added experimental `txt2img-z-image-turbo` and `img2img-z-image-turbo` API workflows using `UNETLoader`, `CLIPLoader`, `VAELoader`, `ModelSamplingAuraFlow`, and `KSampler`.
- Added diffusion-model-stack model selector refresh so Z_image_Turbo presets can list `UNETLoader` models such as `z_image_turbo_bf16.safetensors` instead of checkpoint files.
- Preserved the attached ComfyUI GUI workflow exports under `src/workflows/source/` as editable source references.
- Added a new Prompt from Layer dashboard card and foundation screen with PNG source capture, generated-prompt text area, Copy Prompt, and Send to Text to Image controls.

### Changed

- Z_image_Turbo presets are now experimental runnable presets instead of disabled future metadata when required local nodes/models are available.
- Documentation now explains why Z_image_Turbo does not appear in checkpoint-only selectors.

### Known Limitations

- Z_image_Turbo support is experimental and should be tested with the user's local ComfyUI setup before release.
- Prompt from Layer does not run Florence-2 PromptGen yet; it is a foundation screen until a validated API workflow and text-output reader are added.
- Flux Text to Image and Image to Image remain setup-required future presets.

## Unreleased / v0.4.2-alpha draft - 2026-06-27

End-of-week stabilization checkpoint for honest inpaint testing.

### Changed

- Marked Inpaint/Repaint Selection as experimental in the Home dashboard while keeping it available for testing.
- Added a small Inpaint screen warning explaining that output quality and Photoshop alignment are still being tested.
- Added a clearer Flux Fill warning for workflow tuning around guidance, denoise, mask blur, and context size.
- Documented the current Inpaint limitations and next debugging checklist.
- Began using the workflow intelligence layer for UI diagnostics in Text to Image, Image to Image, Sketch to Image, Inpaint, and Settings.
- Added artist-facing workflow readiness messages for model-family mismatch, setup-required presets, missing source/selection inputs, and experimental workflows without changing generation behavior.

### Known Limitations

- No major inpaint algorithm, alignment, or workflow rewrite was attempted in this checkpoint.
- Inpaint output may still appear incorrect, gray, partial, or not artist-usable until the source/mask/workflow behavior is verified more deeply.
- Flux Fill remains experimental and may require dedicated workflow tuning before it becomes a dependable OpenLayer preset.

## v0.4.1-alpha - 2026-06-25

Real experimental mask-based Inpaint path for SD 1.x testing.

### Added

- Photoshop selection mask export using a temporary white-filled selection layer inside `executeAsModal`, captured back as a PNG/lossless grayscale mask.
- Runnable `inpaint-basic` ComfyUI API workflow using `LoadImage`, `ImageToMask`, `InpaintModelConditioning`, `KSampler`, `VAEDecode`, `ImageCompositeMasked`, and `SaveImage`.
- Experimental `inpaint-flux-fill-basic` workflow preset for local Flux Fill stacks using `UNETLoader`, `DualCLIPLoader`, `VAELoader`, Flux sampler nodes, and `flux1-fill-dev.safetensors` when available.
- Inpaint generation path that uploads both selected-region source PNG and mask PNG to ComfyUI.
- Aligned Inpaint import path that places the generated context patch back over the captured Photoshop selection context.
- Inpaint mask preview, live progress preview, final result preview, history entry, and existing `Import to Layers` support.
- Unit coverage for `inpaint-basic` preset registration and workflow injection.

### Changed

- Bumped plugin/package metadata to `0.4.1`.
- `inpaint-basic` is now an experimental runnable SD 1.x preset instead of a disabled placeholder.
- `inpaint-basic` now uses `InpaintModelConditioning` so SD inpaint checkpoints receive source and mask context more directly.
- Inpaint errors now explain missing mask export, missing ComfyUI inpaint nodes, or checkpoint/workflow mismatches without flooding the panel with raw logs.

### Known Limitations

- Inpaint is currently safest with SD 1.x checkpoints such as `epicrealism_naturalSinRC1VAE.safetensors`.
- Flux Fill inpainting is experimental and requires `flux1-fill-dev.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors` or accepted fallback `t5xxl_fp8_e4m3fn.safetensors`, and `ae.safetensors` in the matching ComfyUI model folders.
- Selection mask export uses a temporary-layer fallback path. If Photoshop rejects that path, OpenLayer keeps source capture available and shows a friendly mask error.
- Selection preservation remains future work.
- CI does not run Photoshop, UXP, or ComfyUI integration tests.

## v0.4.0-alpha - 2026-06-25

Selection-aware inpainting foundation for safe Photoshop alpha testing.

### Added

- Available Inpaint launcher card and a new Inpaint tool screen using the existing OpenLayer design language.
- Safe Photoshop selection detection with friendly no-selection errors.
- Selected-region PNG/lossless capture using Photoshop Imaging API source bounds when available.
- Source preview, mask preview placeholder, prompt, negative prompt, workflow selector, checkpoint selector, denoise, steps, CFG, seed, status, errors, result preview, and guarded `Import to Layers` action for Inpaint.
- Placeholder experimental `inpaint-basic` workflow preset registered in the preset system.
- Unit tests for pure selection bounds normalization and status-friendly formatting.

### Changed

- Bumped plugin/package metadata to `0.4.0`.
- README and docs now explain the current Inpaint foundation and its mask/export limitations.
- Photoshop adapter TODO paths now describe selection mask export, aligned regional import, and selection preservation more clearly.

### Known Limitations

- `inpaint-basic` is intentionally disabled until a validated ComfyUI API workflow JSON and mask mapping exist.
- True grayscale selection mask export is not available yet.
- Selection preservation and aligned regional import remain future work.
- CI does not run Photoshop, UXP, or ComfyUI integration tests.

## v0.3.0-alpha - 2026-06-25

Stabilization release focused on reliability, testability, source capture quality, and repo maturity.

### Added

- GitHub Actions CI for pull requests and pushes to `main`.
- `npm test` using Vitest for pure TypeScript unit tests.
- Unit tests for workflow building, preset registry behavior, settings validation, model compatibility, and error helpers.
- PNG/lossless Photoshop source capture path for Image to Image and Sketch to Image using raw Imaging API pixels.
- Explicit source capture metadata for format, filename, MIME type, dimensions, and source name.
- Internal PNG encoder with unit coverage for lossless source-image upload.
- Contributor, security, issue template, roadmap, and custom workflow docs.
- Future inpainting architecture types for selection bounds, mask export, aligned regional import, and preserved selection operations.

### Changed

- Image to Image and Sketch to Image source previews now report PNG/lossless source capture.
- Workflow validation errors now include clearer preset remapping guidance for custom ComfyUI API workflows.
- README release notes now describe the v0.3.0-alpha stabilization focus and test commands.
- Bumped plugin/package metadata to `0.3.0`.

### Known Limitations

- PNG/lossless capture depends on Photoshop UXP exposing raw `imageData.getData()` pixels. If that API is unavailable, capture now fails clearly instead of falling back to JPEG.
- Dedicated selected-layer PNG export, mask export, selection preservation, and aligned regional import remain future inpainting work.
- Flux, SD3/SD3.5, and Z_image_Turbo dedicated workflows remain disabled until validated API workflow JSON files exist.
- CI does not run Photoshop, UXP, or ComfyUI integration tests.

## v0.2.1-alpha - 2026-06-23

Sketch to Image LINECN foundation for pre-release testing.

### Added

- Available Sketch to Image launcher card and tool screen.
- Photoshop active-layer and canvas capture reuse for Sketch to Image source input.
- `sketch2img-linecn-basic` workflow preset for a simple SD 1.x LineArt ControlNet path.
- Candidate ComfyUI API workflow at `src/workflows/sketch2img-linecn-basic.json`.
- Required ComfyUI setup validation for the LINECN preset before generation.
- Source preview, prompt, negative prompt, checkpoint selector, ControlNet strength, denoise, result preview, and `Import to Layers` action for Sketch to Image.
- Friendly setup errors for missing LineArt preprocessor nodes or the SD 1.5 LineArt ControlNet model.
- Workflow compatibility docs for SD/SDXL defaults, experimental model families, and the LINECN starter preset.

### Changed

- Bumped plugin/package metadata to `0.2.1`.
- Updated alpha docs and landing page copy for Text to Image, Image to Image, Sketch to Image, Settings, History, and current limitations.
- Added the current Home dashboard screenshot to release documentation.

### Required For Sketch To Image LINECN

- Recommended checkpoint: `epicrealism_naturalSinRC1VAE.safetensors`
- Required ControlNet model: `control_v11p_sd15_lineart_fp16.safetensors`
- Required ComfyUI node classes: `CheckpointLoaderSimple`, `LoadImage`, `CLIPTextEncode`, `LineArtPreprocessor`, `ControlNetLoader`, `ControlNetApplyAdvanced`, `VAEEncode`, `KSampler`, `VAEDecode`, and `SaveImage`.

### Known Limitations

- Sketch to Image currently targets one known-good SD 1.x LINECN workflow.
- SDXL, SD3, Flux, and Z-Image Sketch to Image workflows need dedicated future presets.
- The Sketch source capture uses the same JPEG Imaging API path as Image to Image.
- Advanced sketch controls, separate guide previews, inpainting, masks, and selection-aware workflows remain future work.

## v0.2.0-alpha - 2026-06-22

Image-to-image foundation for the next OpenLayer workflow family.

### Added

- Photoshop-dark Home dashboard with tool cards for active tools, history, settings, and future workflow areas.
- Available Image to Image launcher card and tool screen.
- Experimental active Photoshop layer capture using Photoshop UXP Imaging API.
- Source image preview before upload so users can confirm what will be sent to ComfyUI.
- Canvas capture option for using the visible document as the Image to Image source.
- ComfyUI `/upload/image` support for local source images.
- `img2img-basic` workflow preset using built-in ComfyUI nodes.
- Workflow registry and validation coverage for `img2img-basic`.
- Image to Image generation status, result preview, and import as a new Photoshop layer.
- Full checkpoint visibility on Image to Image, with SD 1.x, SDXL, SD3, and Flux compatibility guidance.
- Experimental checkpoint mode for trying SD3/Flux-style checkpoints without hiding them from the selector.
- Short pre-release tester checklist for Photoshop and ComfyUI on port `8190`.

### Changed

- Refined shared header, status row, footer, and Home dashboard card spacing.
- Improved responsive behavior for Home, Text to Image, Image to Image, Settings, and History in narrow and wide Photoshop panels.
- Reduced long technical ComfyUI errors in the Image to Image panel while keeping details in logs.

### Known Limitations

- Active-layer capture is currently encoded as JPEG through Photoshop's Imaging API.
- True PNG selected-layer export, mask export, selection preservation, and aligned regional workflows remain planned future work.
- The Image to Image workflow is a starter preset and may need node ID/checkpoint adjustments for custom ComfyUI setups.
- `img2img-basic` is still the default SD 1.x/SDXL preset. Flux, SD3, and SD3.5 checkpoints usually need dedicated future workflow presets.
- The panel design was not redesigned in this release.

## v0.1.10-alpha - 2026-06-22

Text-to-image usability and pre-release polish.

### Added

- Settings persistence for ComfyUI URL, workflow, checkpoint, and generation defaults.
- Passive local ComfyUI port finder for common local ports, including `8190` and `8188`.
- Session History view for the last five generated images with preview and import actions.
- Optional auto-import toggle after generation completes.
- Collapsible negative prompt section on the Text to Image screen.

### Changed

- Text to Image screen now uses the new launcher flow more consistently.
- Generate and import actions use the OpenLayer orange action color.
- Settings page now includes clearer diagnostics for server URL, checkpoint count, selected checkpoint, and Photoshop document state.
- Panel spacing and scrolling were refined for Photoshop UXP, with remaining narrow-panel polish planned for a later UI pass.

## v0.1.9-alpha - 2026-06-22

Reliability sprint for the MVP engine.

### Added

- Workflow preset registry for `txt2img-basic`.
- Workflow validation before submitting to ComfyUI.
- Generation settings validation and safe clamping.
- Clearer generation state messages for connection, queue, execution, retrieval, and completion.
- Optional ComfyUI WebSocket progress monitoring with best-effort live preview frames.
- Centralized friendly OpenLayer errors.
- Beginner testing checklist in `docs/testing-v0.1-alpha.md`.
- Photoshop-dark tool launcher home screen with an enabled Text to Image card and Coming Soon cards for future tools.
- UXP-safe launcher rendering using flex cards and text icon badges.
- Available Settings page with ComfyUI URL, Check ComfyUI, status, diagnostics, and MVP defaults.
- Tool cards now use block-level rows for icon/title, subtitle, and status to avoid Photoshop UXP flattening text into one line.
- Launcher cards now use div-based controls instead of native button elements to avoid UXP button text flattening.

### Changed

- Package output now follows the current package version and alpha label.
- The generated seed is shown after generation and written back into the seed field.

## v0.1.8-alpha - 2026-06-22

First public MVP preview of OpenLayer.

### Added

- Photoshop UXP panel for OpenLayer.
- Local ComfyUI server URL input and connection check.
- Checkpoint selector loaded from the local ComfyUI server.
- `txt2img-basic` workflow preset.
- Prompt, negative prompt, width, height, steps, CFG, and seed controls.
- ComfyUI prompt submission, history polling, and generated image retrieval.
- Result preview inside the panel.
- Import generated result into the active Photoshop document as a new named layer.
- Official OpenLayer icon assets.
- Static GitHub Pages landing page in `docs/index.html`.

### Known Limitations

- Only text-to-image generation is supported.
- Custom ComfyUI workflows may require node ID changes in `src/comfy/workflowBuilder.ts`.
- Selected layer export, image-to-image, inpainting, masks, upscaling, and ControlNet-style workflows are planned for later versions.
- The UI is functional and UXP-safe, but still early.
