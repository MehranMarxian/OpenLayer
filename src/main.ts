import { renderApp } from "./ui/App";
import { renderPreviewPanelPlaceholder } from "./ui/previewPanelPlaceholder";
import "./styles.css";

/**
 * Adaptive bootstrap for the second-panel spike (docs/PREVIEW_PANEL.md, unknown #1).
 *
 * The plugin has always booted the plain way: `index.html` loads this module and we
 * render into `#root`. Declaring a second panel entrypoint may require the documented
 * multi-panel style instead (`entrypoints.setup({ panels: { ... } })`), and Adobe's
 * manifest v5 docs do not say which style wins when both are present. Rather than
 * guess and risk the shipping panel, we register `entrypoints.setup()` and keep the
 * legacy path as a timed fallback: whichever mechanism Photoshop actually honours
 * mounts the main panel exactly once, and the preview panel prints what happened.
 *
 * Once the host answers the question, the losing branch gets deleted.
 */

const MAIN_PANEL_ID = "openlayer.panel";
const PREVIEW_PANEL_ID = "openlayer.preview";

/** How long to wait for a panel `create()` callback before falling back to `#root`. */
const LEGACY_FALLBACK_DELAY_MS = 1500;

const bootStartedAt = Date.now();
const bootstrapEvents: string[] = [];
let bootstrapMode = "pending";
let mainPanelMounted = false;

function note(event: string) {
  const entry = `+${Date.now() - bootStartedAt}ms ${event}`;
  bootstrapEvents.push(entry);
  console.log(`[OpenLayer bootstrap] ${entry}`);
}

const diagnostics = {
  mode: () => bootstrapMode,
  events: () => bootstrapEvents
};

function mountMainPanel(container: HTMLElement, mode: string) {
  if (mainPanelMounted) {
    note(`ignored duplicate main panel mount via ${mode}`);
    return;
  }

  mainPanelMounted = true;
  bootstrapMode = mode;
  note(`mounting main panel via ${mode}`);
  renderApp(container);
}

function mountPreviewPanel(container: HTMLElement) {
  note("preview panel create() fired");
  renderPreviewPanelPlaceholder(container, diagnostics);
}

function getLegacyRoot(): HTMLElement | null {
  return document.getElementById("root");
}

function registerEntrypoints(): boolean {
  let uxp;

  try {
    uxp = require("uxp");
  } catch (error) {
    note(`require("uxp") failed: ${String(error)}`);
    return false;
  }

  const setup = uxp?.entrypoints?.setup;

  if (typeof setup !== "function") {
    note("uxp.entrypoints.setup is unavailable");
    return false;
  }

  try {
    setup({
      panels: {
        [MAIN_PANEL_ID]: {
          create: (rootNode: HTMLElement) => {
            // The legacy `#root` div stays in the document; drop it so the main
            // panel cannot end up rendered twice if the host also shows <body>.
            const legacyRoot = getLegacyRoot();

            if (legacyRoot && !mainPanelMounted) {
              legacyRoot.remove();
            }

            mountMainPanel(rootNode, "entrypoints.setup");
          }
        },
        [PREVIEW_PANEL_ID]: {
          create: mountPreviewPanel
        }
      }
    });
  } catch (error) {
    note(`entrypoints.setup threw: ${String(error)}`);
    return false;
  }

  note("entrypoints.setup registered both panels");
  return true;
}

function mountLegacyRoot() {
  const rootElement = getLegacyRoot();

  if (!rootElement) {
    if (mainPanelMounted) {
      return;
    }

    throw new Error("OpenLayer root element was not found.");
  }

  mountMainPanel(rootElement, "index.html #root");
}

function scheduleLegacyFallback() {
  const run = () => {
    if (mainPanelMounted) {
      return;
    }

    note("no panel create() callback arrived; falling back to #root");
    mountLegacyRoot();
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => window.setTimeout(run, LEGACY_FALLBACK_DELAY_MS),
      { once: true }
    );
  } else {
    window.setTimeout(run, LEGACY_FALLBACK_DELAY_MS);
  }
}

function startLegacyOnly() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountLegacyRoot, { once: true });
  } else {
    mountLegacyRoot();
  }
}

// entrypoints.setup() must be called as early as possible, before DOM ready.
if (registerEntrypoints()) {
  scheduleLegacyFallback();
} else {
  startLegacyOnly();
}
