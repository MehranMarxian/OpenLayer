/**
 * Placeholder content for the second (`openlayer.preview`) panel entrypoint.
 *
 * This exists only to answer the host-dependent unknown in docs/PREVIEW_PANEL.md:
 * can a second UXP panel coexist with the current plain `index.html` bootstrap,
 * or does the main panel have to migrate to `entrypoints.setup()`? The panel
 * therefore renders the bootstrap diagnostics rather than a preview — whatever
 * Photoshop actually did is written on the panel, so the spike reports itself
 * instead of relying on someone reading a developer console.
 *
 * Nothing here is the real preview surface. Step 2 of the PREVIEW_PANEL plan
 * replaces this module with the preview hub subscriber.
 */

export type BootstrapDiagnostics = {
  /** Which bootstrap path actually mounted the main panel. */
  mode: () => string;
  /** Ordered log of bootstrap milestones, newest last. */
  events: () => readonly string[];
};

export function renderPreviewPanelPlaceholder(rootElement: HTMLElement, diagnostics: BootstrapDiagnostics) {
  rootElement.innerHTML = "";

  const container = document.createElement("div");
  container.className = "openlayer-preview-panel-placeholder";

  const heading = document.createElement("h1");
  heading.textContent = "OpenLayer Preview";
  container.appendChild(heading);

  const blurb = document.createElement("p");
  blurb.textContent =
    "Placeholder panel. Previews will appear here once the preview hub lands. " +
    "For now this panel reports how the plugin booted.";
  container.appendChild(blurb);

  const modeLine = document.createElement("p");
  modeLine.className = "openlayer-preview-panel-placeholder-mode";
  modeLine.textContent = `Bootstrap mode: ${diagnostics.mode()}`;
  container.appendChild(modeLine);

  const log = document.createElement("ul");
  log.className = "openlayer-preview-panel-placeholder-log";

  for (const event of diagnostics.events()) {
    const item = document.createElement("li");
    item.textContent = event;
    log.appendChild(item);
  }

  container.appendChild(log);
  rootElement.appendChild(container);
}
