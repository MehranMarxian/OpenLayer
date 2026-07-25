import { createObjectUrlRegistry } from "./objectUrlRegistry";
import { createOwnedObjectUrl } from "./previewState";
import { PreviewHub, PreviewPublication, previewHub as sharedPreviewHub } from "./previewHub";

/**
 * The separated `openlayerPreview` panel: a large, resizable surface showing the
 * current generation preview.
 *
 * It mirrors the dashboard's in-panel preview rather than replacing it. Moving
 * the preview out of the dashboard would mean an artist who never opens this
 * panel — or who closes it — loses previews entirely, and the Import buttons sit
 * next to the small preview because that is where the decision gets made.
 *
 * The registry and URL slot are module-level on purpose. UXP can call a panel's
 * create() again after a destroy(), and a per-mount registry would strand one
 * object URL on every remount; one shared slot bounds that to a single URL for
 * the lifetime of the plugin.
 */

const urls = createObjectUrlRegistry();
const ownedUrl = createOwnedObjectUrl(urls);

let unsubscribe: (() => void) | null = null;
let teardownRegistered = false;

const KIND_LABEL: Record<PreviewPublication["kind"], string> = {
  live: "generating",
  result: "result"
};

export function renderPreviewPanel(rootElement: HTMLElement, hub: PreviewHub = sharedPreviewHub) {
  // A remount must not leave the previous subscription feeding a detached node.
  unsubscribe?.();

  rootElement.innerHTML = "";
  rootElement.classList.add("openlayer-preview-panel-root");

  const shell = document.createElement("div");
  shell.className = "openlayer-preview-panel";

  const header = document.createElement("div");
  header.className = "openlayer-preview-panel-header";

  const badge = document.createElement("span");
  badge.className = "openlayer-preview-panel-badge";

  const fitButton = document.createElement("button");
  fitButton.type = "button";
  fitButton.className = "openlayer-preview-panel-fit";

  header.append(badge, fitButton);

  const stage = document.createElement("div");
  stage.className = "openlayer-preview-panel-stage";

  const emptyMessage = document.createElement("span");
  emptyMessage.className = "openlayer-preview-panel-empty";
  emptyMessage.textContent = "Previews appear here while you generate.";

  // One persistent img, reused across live frames. Rebuilding it per frame
  // flickers between sampler steps — the same fix the in-panel preview needed.
  const image = document.createElement("img");
  image.className = "openlayer-preview-panel-image";
  image.alt = "OpenLayer generation preview";
  image.hidden = true;

  stage.append(emptyMessage, image);
  shell.append(header, stage);
  rootElement.append(shell);

  let actualSize = false;

  const applyFitMode = () => {
    stage.classList.toggle("is-actual-size", actualSize);
    fitButton.textContent = actualSize ? "Fit" : "1:1";
    fitButton.title = actualSize ? "Scale the preview to fit the panel" : "Show the preview at full size";
  };

  fitButton.addEventListener("click", () => {
    actualSize = !actualSize;
    applyFitMode();
  });

  applyFitMode();

  const render = (publication: PreviewPublication | null) => {
    if (!publication) {
      ownedUrl.release();
      image.hidden = true;
      image.removeAttribute("src");
      emptyMessage.hidden = false;
      badge.textContent = "";
      fitButton.hidden = true;
      return;
    }

    emptyMessage.hidden = true;
    image.hidden = false;
    fitButton.hidden = false;
    badge.textContent = `${publication.toolLabel} · ${KIND_LABEL[publication.kind]}`;
    badge.classList.toggle("is-live", publication.kind === "live");
    // createFrom revokes the previous URL before returning the new one, so a
    // whole live sequence keeps exactly one alive.
    image.src = ownedUrl.createFrom(publication.blob);
  };

  unsubscribe = hub.subscribe(render);

  if (!teardownRegistered) {
    teardownRegistered = true;
    window.addEventListener(
      "unload",
      () => {
        unsubscribe?.();
        unsubscribe = null;
        urls.revokeAll();
      },
      { once: true }
    );
  }
}
