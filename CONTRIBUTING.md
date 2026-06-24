# Contributing To OpenLayer

OpenLayer is an early alpha Photoshop UXP plugin for local ComfyUI workflows. Contributions should keep the project stable, artist-friendly, and easy to understand.

## Development Setup

1. Install Node.js 18 or newer.
2. Install dependencies:

```bash
npm install
```

3. Run checks before opening a pull request:

```bash
npm run typecheck
npm test
npm run build
```

The browser dev server is useful for layout work, but Photoshop APIs only run inside Photoshop UXP.

## Scope Guidelines

- Keep pull requests focused.
- Preserve existing Text to Image, Image to Image, and Sketch to Image behavior.
- Do not add cloud dependencies.
- Do not guess ComfyUI node APIs. Validate workflows against local `/object_info` where practical.
- Do not copy proprietary plugin UI, code, branding, or workflows.

## Workflow Changes

Runnable ComfyUI API workflows live in `src/workflows/api/`. GUI-editable reference workflows live in `src/workflows/source/`.

When adding or changing a workflow, update `src/comfy/presetRegistry.ts` with exact node IDs and injection targets, then add tests when the behavior is pure TypeScript.

## Reporting Issues

Please include:

- Photoshop version
- OpenLayer version
- ComfyUI URL and port
- Selected workflow preset
- Selected model/checkpoint
- Clear steps to reproduce
- Screenshots or logs when useful
