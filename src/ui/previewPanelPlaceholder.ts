/**
 * Placeholder content for the second (`openlayer.preview`) panel entrypoint.
 *
 * This is still a spike surface, not the preview itself. It answers the two
 * host questions docs/PREVIEW_PANEL.md is blocked on — which bootstrap path
 * ran, and whether a second panel resizes — by reporting both on the panel,
 * so neither answer depends on someone reading a developer console.
 *
 * The size readout is the point of the fill area: a panel that reports
 * changing dimensions as it is dragged is demonstrably resizable, which
 * "it looked the same size" is not.
 *
 * Step 2 of the PREVIEW_PANEL plan replaces this module with the preview hub
 * subscriber that renders actual generated images.
 */

export type BootstrapDiagnostics = {
  /** Which bootstrap path claimed the panels. */
  mode: () => string;
  /** Ordered log of bootstrap milestones, newest last. */
  events: () => readonly string[];
};

type ResizeObserverLike = {
  observe: (target: Element) => void;
};

type ResizeObserverConstructor = new (callback: () => void) => ResizeObserverLike;

export function renderPreviewPanelPlaceholder(rootElement: HTMLElement, diagnostics: BootstrapDiagnostics) {
  rootElement.innerHTML = "";
  rootElement.classList.add("openlayer-preview-panel-root");

  const container = document.createElement("div");
  container.className = "openlayer-preview-panel-placeholder";

  const heading = document.createElement("h1");
  heading.textContent = "OpenLayer Preview";
  container.appendChild(heading);

  const blurb = document.createElement("p");
  blurb.textContent = "Placeholder panel. Generated previews will appear here once the preview hub lands.";
  container.appendChild(blurb);

  const modeLine = document.createElement("p");
  modeLine.className = "openlayer-preview-panel-placeholder-mode";
  modeLine.textContent = `Bootstrap mode: ${diagnostics.mode()}`;
  container.appendChild(modeLine);

  const fill = document.createElement("div");
  fill.className = "openlayer-preview-panel-placeholder-fill";

  const sizeLabel = document.createElement("span");
  sizeLabel.className = "openlayer-preview-panel-placeholder-size";
  fill.appendChild(sizeLabel);
  container.appendChild(fill);

  const log = document.createElement("ul");
  log.className = "openlayer-preview-panel-placeholder-log";

  for (const event of diagnostics.events()) {
    const item = document.createElement("li");
    item.textContent = event;
    log.appendChild(item);
  }

  container.appendChild(log);
  rootElement.appendChild(container);

  let lastReported = "";

  const updateSize = () => {
    const width = Math.round(rootElement.clientWidth || container.clientWidth);
    const height = Math.round(rootElement.clientHeight || container.clientHeight);
    const reported = `${width} x ${height}`;

    if (reported === lastReported) {
      return;
    }

    lastReported = reported;
    sizeLabel.textContent = `Panel size: ${reported}`;
  };

  updateSize();

  // ResizeObserver is the honest signal here — a window resize event does not
  // fire when a docked Photoshop panel is dragged. Where UXP does not provide
  // it the panel still shows its size at render time, just not live.
  const observerConstructor = (window as unknown as { ResizeObserver?: ResizeObserverConstructor }).ResizeObserver;

  if (typeof observerConstructor === "function") {
    new observerConstructor(updateSize).observe(rootElement);
  } else {
    window.addEventListener("resize", updateSize);
  }
}
