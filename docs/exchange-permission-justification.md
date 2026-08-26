# Manifest Permission Justification (Exchange Submission)

Paste-ready answers for the Developer Distribution portal's per-permission justification
fields. Each is grounded in the actual code path that needs it — see
[docs/exchange-readiness-audit.md](exchange-readiness-audit.md) sections 1.2–1.4 for how these
were verified.

## `network.domains: "all"`

> OpenLayer is a client for a service the user runs themselves, not a service with its own
> backend. It makes two kinds of outbound requests, both user-initiated and both to
> user-chosen or user-confirmed destinations:
>
> 1. **The user's own ComfyUI server**, whose host and port are entered by the user in Settings
>    (`src/comfy/comfyClient.ts`, `src/comfy/managerClient.ts`). This is normally `127.0.0.1` but
>    can be any address on the user's own local network, since ComfyUI is frequently run on a
>    separate machine or GPU box. There is no fixed domain to allowlist.
> 2. **Model and custom-node downloads the user explicitly confirms**
>    (`src/comfy/setupManifest.ts`, `src/comfy/modelDownload.ts`), pointing at whichever host the
>    model registry pins or the user pastes — Hugging Face, Civitai, GitHub, and similar model
>    hosts, with no fixed set. Every download shows file size, destination folder, and source host
>    before it starts.
>
> Because destination #1 is arbitrary by design and destination #2 draws from an open-ended set
> of model-hosting sites, no fixed domain list covers actual use. `"all"` reflects that the plugin
> is a network *client tool*, not that it silently talks to arbitrary services on its own
> initiative — see `SECURITY.md` and the plugin's privacy policy
> (https://mehran-ahmadi.com/OpenLayer/privacy.html) for the no-telemetry commitment.

## `localFileSystem: "fullAccess"`

> OpenLayer needs to locate and inspect the user's ComfyUI `models/` folder tree — which can be
> anywhere on disk, since ComfyUI is a separate application the user installs independently — and
> report install status (present / missing / wrong folder) without a file picker prompt on every
> check. This uses `uxp.storage.localFileSystem.getEntryWithUrl()` on an absolute path
> (`src/photoshop/modelFolderAccess.ts`), which requires `fullAccess`; there is no picker-based
> API that allows silent, repeated status checks against a location the user configured once.
> The same access writes downloaded model files directly into that folder
> (`src/photoshop/modelFileDestination.ts`) rather than requiring a manual move after every
> download.
>
> Two other filesystem paths in the codebase were audited and confirmed **not** to need
> `fullAccess`: saving a result to a user-chosen location uses a genuine OS save dialog
> (`getFileForSaving`, `src/utils/saveFile.ts`), and temporary Photoshop-import files use the
> plugin's own sandboxed temp folder (`getTemporaryFolder`, `src/utils/fileUtils.ts`). Neither
> needed to be narrowed because neither was contributing to the `fullAccess` requirement in the
> first place — the model-folder access is the sole reason for this permission level.

## `clipboard: "readAndWrite"`

> OpenLayer only ever *writes* to the clipboard — "Copy Diagnostics," "Copy Link" on Setup and
> Workflow Health rows, and copying an AI-generated prompt (`navigator.clipboard.writeText`,
> confirmed across all call sites in `src/ui/App.ts`). It never reads existing clipboard content.
> The UXP manifest schema only offers two values for this permission — `"read"` and
> `"readAndWrite"` — with no write-only option, so `readAndWrite` is already the minimum available
> grant that covers actual use.

## `launchProcess.schemes: ["https"]`

> Used by `uxp.shell.openExternal` (`src/ui/appBindings.ts`, `openExternalUrl`) to open
> documentation and download links in the user's default browser — for example, links to model
> licence pages the user must accept before downloading gated weights. Scoped to `https` only, no
> other schemes or extensions requested.
