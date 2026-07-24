import { renderApp } from "./ui/App";
import { renderPreviewPanelPlaceholder } from "./ui/previewPanelPlaceholder";
import "./styles.css";

/**
 * Panel bootstrap.
 *
 * The entrypoints themselves are claimed by the inline script in `index.html`,
 * because Adobe's `entrypoints.setup()` throws when called more than ~20ms
 * after plugin start (PS-57605) and this bundle is deferred — far too late.
 * See the comment there for the failure it fixes.
 *
 * This module supplies the renderers. The inline script calls them as soon as
 * both a root node and a renderer exist for a panel, in whichever order those
 * two arrive, so no assumption is made about whether UXP's `create()` fires
 * before or after the bundle finishes loading.
 */

const MAIN_PANEL_ID = "openlayer.panel";
const PREVIEW_PANEL_ID = "openlayer.preview";

/**
 * How long to wait for a panel `create()` callback before rendering the main
 * panel into the plain `#root` div. Only reachable when `setup()` registered
 * without throwing but the host never called back — an older Photoshop, or a
 * regression in the entrypoints API.
 */
const LEGACY_FALLBACK_DELAY_MS = 1500;

type PanelRenderer = (rootNode: HTMLElement) => void;

type OpenLayerBootstrap = {
  mode: string;
  events: string[];
  note: (message: string) => void;
  register: (id: string, render: PanelRenderer) => void;
};

const bootstrap = (window as unknown as { __openlayerBootstrap?: OpenLayerBootstrap }).__openlayerBootstrap;

let mainPanelMounted = false;

function note(message: string) {
  if (bootstrap) {
    bootstrap.note(message);
    return;
  }

  console.log(`[OpenLayer bootstrap] ${message}`);
}

const diagnostics = {
  mode: () => bootstrap?.mode ?? "no inline bootstrap",
  events: () => bootstrap?.events ?? []
};

/**
 * Renders the main panel into the `#root` container, moving that container
 * into the panel node UXP supplied when there is one.
 *
 * `#root` is carried across rather than replaced because `styles.css` sizes the
 * app through an `html, body, #root` chain, and the compact theme leans on it.
 * Rendering into a bare UXP node instead would silently change the layout the
 * whole panel depends on.
 */
function mountMainPanel(rootNode: HTMLElement) {
  if (mainPanelMounted) {
    note("ignored duplicate main panel mount");
    return;
  }

  const legacyRoot = document.getElementById("root");
  let host = legacyRoot;

  if (host && !rootNode.contains(host)) {
    rootNode.appendChild(host);
  }

  if (!host) {
    host = document.createElement("div");
    host.id = "root";
    rootNode.appendChild(host);
  }

  mainPanelMounted = true;
  renderApp(host);
}

function mountPreviewPanel(rootNode: HTMLElement) {
  renderPreviewPanelPlaceholder(rootNode, diagnostics);
}

function mountLegacyRoot() {
  if (mainPanelMounted) {
    return;
  }

  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("OpenLayer root element was not found.");
  }

  note("falling back to the plain #root render");
  mountMainPanel(rootElement);
}

function scheduleLegacyFallback() {
  const run = () => {
    if (mainPanelMounted) {
      return;
    }

    note("no panel create() callback arrived");
    mountLegacyRoot();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.setTimeout(run, LEGACY_FALLBACK_DELAY_MS), {
      once: true
    });
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

if (bootstrap && bootstrap.mode === "entrypoints.setup") {
  bootstrap.register(MAIN_PANEL_ID, mountMainPanel);
  bootstrap.register(PREVIEW_PANEL_ID, mountPreviewPanel);
  scheduleLegacyFallback();
} else {
  note(`inline bootstrap did not claim the panels (${bootstrap?.mode ?? "missing"})`);
  startLegacyOnly();
}
