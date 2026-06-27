# OpenLayer Technical Decisions

This page records current project direction so contributors can make compatible changes without over-expanding the alpha.

## Capture Quality

- PNG/lossless capture should be the default for Photoshop source images.
- JPEG should be explicit opt-in or a clearly labeled fallback only.
- Capture metadata should tell the UI whether a source is PNG/lossless or fallback.

## ComfyUI Progress

- WebSocket progress should be the primary progress path when practical.
- `/history` polling remains the fallback path for compatibility.
- Status messages should stay friendly and concise, with raw ComfyUI details kept out of normal tester flow.

## UI Architecture

- Keep the UI lightweight and UXP-friendly.
- Do not add React, Vue, Svelte, or another framework unless the project has a clear reason later.
- Prefer artist-facing labels by default.
- Keep technical model, node, and workflow names available through future Advanced Mode rather than placing them everywhere.

## Workflow Architecture

- OpenLayer should use a workflow intelligence layer instead of exposing ComfyUI complexity directly in the Photoshop panel.
- Each workflow preset should describe its tool type, loader type, Photoshop inputs, supported controls, output kind, required nodes, required model files, and UI hints.
- Compatibility checks should be pure and testable: selected model family, local ComfyUI node availability, required model files, Photoshop input state, and experimental/setup-required status should produce friendly artist-facing messages.
- The UI should eventually adapt from workflow capability metadata, but current generation behavior should remain stable while this internal layer matures.
- Custom ComfyUI workflow import is future work.
- Future workflow import should remove or reduce hardcoded node IDs by mapping source workflows to OpenLayer API workflow injection targets.
- Keep source workflows and runnable API workflows separate.
- API workflow validation should explain which preset failed and which node/input mapping needs attention.

## Inpainting

- Inpaint/Repaint Selection remains experimental until confirmed by real Photoshop testing.
- Current debugging should focus on source PNG, mask PNG, mask polarity, workflow expectations, context area, and import alignment.
- The next stable inpaint direction should decide whether OpenLayer imports a full context image, a cropped patch, transparent outside-mask pixels, or a layer with a Photoshop mask.

## Long-Term Product Direction

The future killer feature is that Photoshop layers become intelligent AI layers with prompt, seed, model, workflow, source, mask, and generation metadata attached clearly enough that artists can iterate without losing control.
