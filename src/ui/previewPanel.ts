import { createObjectUrlRegistry } from "./objectUrlRegistry";
import { createOwnedObjectUrl } from "./previewState";
import {
  getPreviewToolLabel,
  isPreviewToolId,
  PREVIEW_TOOLS,
  PreviewHub,
  PreviewPublication,
  previewHub as sharedPreviewHub,
  PreviewToolId
} from "./previewHub";
import { loadPreviewPanelPin, savePreviewPanelPin } from "../utils/preferences";
import {
  importBridge as sharedImportBridge,
  ImportBridge,
  IMPORT_TARGETS,
  resolveImportAffordance
} from "./importBridge";

/**
 * The separated `openlayerPreview` panel: a large, resizable surface showing the
 * current generation preview.
 *
 * It mirrors the dashboard's in-panel preview rather than replacing it. Moving
 * the preview out of the dashboard would mean an artist who never opens this
 * panel — or who closes it — loses previews entirely, so both surfaces keep
 * their previews and both can import.
 *
 * The Import buttons are here as well as beside the small preview. This reverses
 * what this comment used to say — that they belonged only next to the small
 * preview "because that is where the decision gets made". Mehran's reasoning is
 * better: the big preview is where you actually judge a result, so making you go
 * back to a thumbnail to act on it is backwards. The buttons do not reimplement
 * anything; they call the dashboard's own handlers through `importBridge`, which
 * is what keeps A1's document binding and the rest of the import contract
 * intact. See that module for why the panel must not import for itself.
 *
 * The button acts on the tool whose image is **on screen**, not the pinned tool.
 * With a pin set they are the same; under "Follow active tool" it is the latest
 * publisher. Either way the button acts on what you are looking at, which is the
 * only rule that never surprises anyone.
 *
 * The registry and URL slot are module-level on purpose. UXP can call a panel's
 * create() again after a destroy(), and a per-mount registry would strand one
 * object URL on every remount; one shared slot bounds that to a single URL for
 * the lifetime of the plugin.
 */

const urls = createObjectUrlRegistry();
const ownedUrl = createOwnedObjectUrl(urls);

let unsubscribe: (() => void) | null = null;
let unsubscribeImports: (() => void) | null = null;
let teardownRegistered = false;

const KIND_LABEL: Record<PreviewPublication["kind"], string> = {
  live: "generating",
  result: "result"
};

const DEFAULT_EMPTY_MESSAGE = "Previews appear here while you generate.";

export function renderPreviewPanel(
  rootElement: HTMLElement,
  hub: PreviewHub = sharedPreviewHub,
  bridge: ImportBridge = sharedImportBridge
) {
  // A remount must not leave the previous subscription feeding a detached node.
  unsubscribe?.();
  unsubscribeImports?.();

  rootElement.innerHTML = "";
  rootElement.classList.add("openlayer-preview-panel-root");

  const shell = document.createElement("div");
  shell.className = "openlayer-preview-panel";

  const header = document.createElement("div");
  header.className = "openlayer-preview-panel-header";

  const badge = document.createElement("span");
  badge.className = "openlayer-preview-panel-badge";

  // Pin control. "Follow active tool" is the default and the v0.7 behaviour;
  // choosing a tool freezes the panel on that tool's output, which is the point
  // — an artist iterating on an Inpaint should not lose the panel to a Text to
  // Image run started to compare against.
  const pinSelect = document.createElement("select");
  pinSelect.className = "openlayer-preview-panel-pin";
  pinSelect.title = "Choose which tool this panel shows";

  const followOption = document.createElement("option");
  followOption.value = "";
  followOption.textContent = "Follow active tool";
  pinSelect.append(followOption);

  for (const tool of PREVIEW_TOOLS) {
    const option = document.createElement("option");
    option.value = tool.id;
    option.textContent = tool.label;
    pinSelect.append(option);
  }

  const fitButton = document.createElement("button");
  fitButton.type = "button";
  fitButton.className = "openlayer-preview-panel-fit";

  header.append(badge, pinSelect, fitButton);

  const stage = document.createElement("div");
  stage.className = "openlayer-preview-panel-stage";

  const emptyMessage = document.createElement("span");
  emptyMessage.className = "openlayer-preview-panel-empty";
  emptyMessage.textContent = DEFAULT_EMPTY_MESSAGE;

  // One persistent img, reused across live frames. Rebuilding it per frame
  // flickers between sampler steps — the same fix the in-panel preview needed.
  const image = document.createElement("img");
  image.className = "openlayer-preview-panel-image";
  image.alt = "OpenLayer generation preview";
  image.hidden = true;

  // Import row. Built once and shown or hidden per publication rather than
  // rebuilt, so clicking through a live sequence cannot swap the button out from
  // under the pointer.
  const actions = document.createElement("div");
  actions.className = "openlayer-preview-panel-actions";

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "openlayer-preview-panel-import";

  const autoImportButton = document.createElement("button");
  autoImportButton.type = "button";
  autoImportButton.className = "openlayer-preview-panel-auto-import";

  // Import feedback belongs here, not only in the dashboard's status bar: the
  // artist who clicked is looking at this panel, and the dashboard may be docked
  // out of sight or parked on another screen. The text is whatever the tool's own
  // status bar says, so the two surfaces cannot contradict each other.
  const importStatus = document.createElement("span");
  importStatus.className = "openlayer-preview-panel-import-status";

  actions.append(importButton, autoImportButton, importStatus);

  stage.append(emptyMessage, image);
  shell.append(header, stage, actions);
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

  // Restored from the last session, but only if it still names a tool that
  // exists — a stale id from an older build must not leave the panel pinned to
  // something that can never publish again.
  const storedPin = loadPreviewPanelPin();
  let pinnedToolId: PreviewToolId | null = isPreviewToolId(storedPin) ? storedPin : null;
  pinSelect.value = pinnedToolId ?? "";

  const resolve = (): PreviewPublication | null =>
    pinnedToolId ? hub.latestForTool(pinnedToolId) : hub.latest();

  /**
   * The tool the buttons currently act on: whoever published what is on screen.
   * Held so the click listeners do not have to re-resolve and risk acting on a
   * different tool than the one the label named.
   */
  let actionToolId: PreviewToolId | null = null;

  const renderImportControls = (publication: PreviewPublication | null) => {
    actionToolId = publication?.toolId ?? null;

    const capability = publication ? bridge.capabilityFor(publication.toolId) : null;
    const affordance = resolveImportAffordance(capability, publication);

    actions.hidden = !affordance.visible;

    if (!publication || !affordance.visible) {
      importStatus.textContent = "";
      importStatus.classList.remove("is-error");
      return;
    }

    const target = IMPORT_TARGETS[publication.toolId];

    importButton.textContent = target.label;
    importButton.disabled = !affordance.enabled;
    importButton.title = affordance.reason;

    // A tool with no auto-import flag gets no toggle at all, rather than a
    // disabled one. The dashboard has no such control for Sketch, Inpaint or
    // Outpaint, and offering a dead button here would imply the app can do
    // something it cannot.
    const auto = target.hasAutoImport ? capability?.auto ?? null : null;

    autoImportButton.hidden = !auto;

    if (auto) {
      autoImportButton.textContent = auto.isEnabled ? "Auto Import On" : "Import Automatically";
      autoImportButton.setAttribute("aria-pressed", String(auto.isEnabled));
      autoImportButton.classList.toggle("is-active", auto.isEnabled);
    }

    const outcome = bridge.outcomeFor(publication.toolId);

    importStatus.textContent = affordance.enabled || outcome ? outcome?.message ?? "" : affordance.reason;
    importStatus.classList.toggle("is-error", outcome?.status === "failed");
  };

  importButton.addEventListener("click", () => {
    if (actionToolId) {
      bridge.requestImport(actionToolId);
    }
  });

  autoImportButton.addEventListener("click", () => {
    if (actionToolId) {
      bridge.toggleAutoImport(actionToolId);
    }
  });

  const render = () => {
    const publication = resolve();

    renderImportControls(publication);

    if (!publication) {
      ownedUrl.release();
      image.hidden = true;
      image.removeAttribute("src");
      emptyMessage.textContent = pinnedToolId
        ? `No ${getPreviewToolLabel(pinnedToolId)} preview yet this session.`
        : DEFAULT_EMPTY_MESSAGE;
      emptyMessage.hidden = false;
      badge.textContent = pinnedToolId ? `${getPreviewToolLabel(pinnedToolId)} · pinned` : "";
      badge.classList.remove("is-live");
      fitButton.hidden = true;
      return;
    }

    emptyMessage.hidden = true;
    image.hidden = false;
    fitButton.hidden = false;
    badge.textContent = `${getPreviewToolLabel(publication.toolId)} · ${KIND_LABEL[publication.kind]}`;
    badge.classList.toggle("is-live", publication.kind === "live");
    // createFrom revokes the previous URL before returning the new one, so a
    // whole live sequence keeps exactly one alive.
    image.src = ownedUrl.createFrom(publication.blob);
  };

  pinSelect.addEventListener("change", () => {
    const value = pinSelect.value;
    pinnedToolId = isPreviewToolId(value) ? value : null;
    savePreviewPanelPin(pinnedToolId ?? "");
    // Re-resolve immediately rather than waiting for the next publication: the
    // artist expects the panel to answer the moment they choose.
    render();
  });

  // Every publication re-renders, whoever sent it; a pinned panel simply
  // re-resolves and finds nothing new for its tool.
  unsubscribe = hub.subscribe(render);

  // Capability and outcome changes do not go through the hub — no new image has
  // arrived — so the buttons are refreshed on their own channel. Only the import
  // row re-renders, which keeps a busy-state change from touching the <img>.
  unsubscribeImports = bridge.subscribe(() => renderImportControls(resolve()));

  if (!teardownRegistered) {
    teardownRegistered = true;
    window.addEventListener(
      "unload",
      () => {
        unsubscribe?.();
        unsubscribe = null;
        unsubscribeImports?.();
        unsubscribeImports = null;
        urls.revokeAll();
      },
      { once: true }
    );
  }
}
