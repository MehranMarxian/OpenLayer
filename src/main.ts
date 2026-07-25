import { renderApp } from "./ui/App";
import { renderPreviewPanel } from "./ui/previewPanel";
import "./styles.css";

/**
 * Panel bootstrap, bundle half.
 *
 * `panelBootstrap.js` claims the entrypoints before this bundle exists, because
 * `entrypoints.setup()` throws when called too late (PS-57605). This module only
 * supplies the renderers, and retries the registration from here if the early
 * script could not manage it — `require` is guaranteed to work in the bundle,
 * so a retry is worth one attempt even though it is past the ideal window.
 *
 * The main panel renders through `index.html` exactly as it always has. That is
 * deliberate: it is the proven path, and nothing about adding a second panel
 * should put it at risk.
 */

const MAIN_PANEL_ID = "openlayer.panel";
const PREVIEW_PANEL_ID = "openlayerPreview";

type PanelRenderer = (rootNode: HTMLElement) => void;

type OpenLayerBootstrap = {
  mode: string;
  registered: boolean;
  events: string[];
  note: (message: string) => void;
  register: (id: string, render: PanelRenderer) => void;
  trySetup: (label: string, panelIds: string[]) => boolean;
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

/**
 * Renders the app into the `#root` container, moving that container into the
 * node UXP supplied when there is one.
 *
 * `#root` is carried across rather than replaced because `styles.css` sizes the
 * app through an `html, body, #root` chain that the compact theme leans on.
 * Rendering into a bare UXP node would silently change every screen's layout.
 */
function mountMainPanel(rootNode: HTMLElement) {
  if (mainPanelMounted) {
    return;
  }

  let host = document.getElementById("root");

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
  renderPreviewPanel(rootNode);
}

function mountMainPanelFromDocument() {
  if (mainPanelMounted) {
    return;
  }

  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("OpenLayer root element was not found.");
  }

  mountMainPanel(rootElement);
}

if (bootstrap) {
  bootstrap.register(MAIN_PANEL_ID, mountMainPanel);
  bootstrap.register(PREVIEW_PANEL_ID, mountPreviewPanel);

  // Last chance: the early script may have found no usable entrypoints API.
  // `require` definitely resolves here, so this attempt can still succeed even
  // though it is late.
  if (!bootstrap.registered) {
    bootstrap.trySetup("bundle-retry", [PREVIEW_PANEL_ID]);
  }
} else {
  note("early bootstrap script did not run");
}

/*
 * The main panel always renders from the document, whether or not any panel
 * create() callback arrives. `mountMainPanel` is idempotent, so if UXP does call
 * create() for the main panel first, this is a no-op.
 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountMainPanelFromDocument, { once: true });
} else {
  mountMainPanelFromDocument();
}
