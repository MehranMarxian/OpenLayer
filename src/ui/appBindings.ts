import { AppView, DEFAULT_SERVER_URL } from "./appConstants";
import { AppElements } from "./appMarkup";
import {
  loadHasSeenWelcome,
  loadOpenAdvancedSections,
  saveHasSeenWelcome,
  saveOpenAdvancedSections,
  saveServerUrlPreference
} from "../utils/preferences";
import { findActiveComfyUrl } from "../comfy/comfyPortDiscovery";
import { setGlobalDiagnostics } from "./statusBars";

/**
 * Every DOM event binding in the panel: direct control bindings, delegated
 * click/keydown handlers on the root and document, the section, info, and
 * advanced disclosure toggles, the tool-card view switcher, history action
 * buttons, the external-link opener, and the small data-openlayer-* attribute
 * lookups they share.
 *
 * They are grouped here because they are pure DOM wiring over an already
 * rendered tree -- no generation state, no Photoshop calls, and no renderApp
 * closure variables -- so the whole group moves as a unit.
 *
 * Each binder carries its own debounce timestamp (the 220-350 ms lastRunAt
 * guards) because UXP fires duplicate pointer/click events. Those guards are
 * per-binder state and must stay with the binder.
 */

export type ActionName =
  | "check"
  | "findPort"
  | "detectHardware"
  | "checkWorkflowHealth"
  | "checkSetup"
  | "copyDiagnostics"
  // SPIKE: delete with src/ui/spikeModelDownload.ts.
  | "spikeModelDownload"
  | "saveSettings"
  | "resetSettings"
  | "toggleNegativePrompt"
  | "toggleAutoImport"
  | "generate"
  | "cancelGeneration"
  | "import"
  | "captureImageSource"
  | "captureCanvasSource"
  | "toggleExperimentalCheckpoints"
  | "generateImg2Img"
  | "importImg2Img"
  | "toggleImg2ImgAutoImport"
  | "captureSketchSource"
  | "captureSketchCanvasSource"
  | "generateSketch"
  | "importSketch"
  | "captureInpaintSelection"
  | "captureInpaintActiveLayer"
  | "generateInpaint"
  | "importInpaint"
  | "toggleInpaintAutoImport"
  | "captureOutpaintSource"
  | "captureOutpaintCanvasSource"
  | "generateOutpaint"
  | "importOutpaint"
  | "capturePromptLayerSource"
  | "capturePromptCanvasSource"
  | "generatePromptFromLayer"
  | "copyPromptFromLayer"
  | "sendPromptToTextToImage"
  | "captureUpscaleSource"
  | "captureUpscaleCanvasSource"
  | "generateUpscale"
  | "importUpscale"
  | "toggleUpscaleAutoImport"
  | "exportLayerToFile"
  | "exportLayerToComfyUI"
  | "exportSelectionToFile"
  | "exportSelectionToComfyUI"
  | "exportMaskToFile"
  | "exportMaskToComfyUI"
  | "clearHistory"
  | "toggleLiveNegativePrompt"
  | "startLivePainting"
  | "stopLivePainting"
  | "refineLivePainting"
  | "importLiveResult"
  | "importLiveRefined"
  | "toggleLiveAutoImport"
  | "toggleLiveAutoRefine"
  | "toggleAgentBridge"
  | "suggestPrompt"
  | "captureStyleReferenceSource"
  | "captureStyleReferenceCanvasSource"
  | "generateStyleReference"
  | "importStyleReference"
  | "checkCustomWorkflow";
export type HistoryActionName = "preview" | "import" | "reuse";
export type ActionRunner = (eventName: string) => void;
export type ActionHandlers = Record<ActionName, ActionRunner>;

export function createActionRunner(
  elements: AppElements,
  actionName: ActionName,
  handler: () => void | Promise<void>
): ActionRunner {
  let lastRunAt = 0;

  return (eventName: string) => {
    const now = Date.now();

    if (now - lastRunAt < 350) {
      return;
    }

    lastRunAt = now;
    console.log(`[OpenLayer] action ${actionName} from ${eventName}`);
    setGlobalDiagnostics(elements, `Event received: ${actionName} (${eventName}).`);
    void handler();
  };
}

export function bindActionControl(element: HTMLElement, run: ActionRunner) {
  const runFromEvent = (eventName: string, event: Event) => {
    if (isActionDisabled(element)) {
      return;
    }

    event.preventDefault();
    run(eventName);
  };

  // A single "click" binding avoids the old pointerup+click double-fire.
  element.addEventListener("click", (event) => runFromEvent("click", event));

  element.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if ((key === "Enter" || key === " ") && !isActionDisabled(element)) {
      event.preventDefault();
      run(`keyboard:${key === " " ? "space" : key}`);
    }
  });
}

export function bindDelegatedActions(rootElement: HTMLElement, actionHandlers: ActionHandlers) {
  rootElement.addEventListener(
    "click",
    (event) => {
      const actionElement = findActionElement(event.target, rootElement);

      if (!actionElement || isActionDisabled(actionElement)) {
        return;
      }

      const actionName = actionElement.getAttribute("data-openlayer-action") as ActionName | null;

      if (!actionName || !(actionName in actionHandlers)) {
        return;
      }

      event.preventDefault();
      actionHandlers[actionName]("click");
    },
    true
  );
}

export function bindDocumentActions(rootElement: HTMLElement, actionHandlers: ActionHandlers) {
  document.addEventListener(
    "click",
    (event) => {
      const actionElement = findActionElement(event.target, rootElement);

      if (!actionElement || isActionDisabled(actionElement)) {
        return;
      }

      const actionName = actionElement.getAttribute("data-openlayer-action") as ActionName | null;

      if (!actionName || !(actionName in actionHandlers)) {
        return;
      }

      event.preventDefault();
      actionHandlers[actionName]("document:click");
    },
    true
  );
}

export function bindHomeSectionToggles(rootElement: HTMLElement) {
  let lastRunAt = 0;

  const runFromEvent = (event: Event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const header = target.closest("[data-openlayer-section-toggle]") as HTMLElement | null;

    if (!header || !rootElement.contains(header)) {
      return;
    }

    const section = header.closest(".home-section") as HTMLElement | null;
    const body = section?.querySelector<HTMLElement>(".ol-section-body");

    if (!section || !body) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 220) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    event.stopPropagation();
    const isOpen = section.classList.toggle("is-open");
    header.setAttribute("aria-expanded", isOpen ? "true" : "false");
    body.hidden = !isOpen;
  };

  rootElement.addEventListener("click", runFromEvent, true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(event);
    }
  });
}

export function bindDetailSectionToggles(rootElement: HTMLElement) {
  let lastRunAt = 0;

  rootElement.querySelectorAll<HTMLElement>(".panel-section > .section-heading").forEach((header) => {
    const section = header.parentElement;

    if (!section || section.classList.contains("home-section")) {
      return;
    }

    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "true");
    header.setAttribute("data-openlayer-detail-toggle", "true");
    section.classList.add("is-open");
  });

  const runFromEvent = (event: Event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const header = target.closest("[data-openlayer-detail-toggle]") as HTMLElement | null;

    if (!header || !rootElement.contains(header)) {
      return;
    }

    const section = header.parentElement as HTMLElement | null;

    if (!section) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 250) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    const isOpen = section.classList.toggle("is-open");
    section.classList.toggle("is-collapsed", !isOpen);
    header.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  rootElement.addEventListener("click", runFromEvent, true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(event);
    }
  });
}

export function bindInfoToggles(rootElement: HTMLElement) {
  let lastRunAt = 0;

  const runFromEvent = (event: Event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const toggle = target.closest("[data-openlayer-info-toggle]") as HTMLElement | null;

    if (!toggle || !rootElement.contains(toggle)) {
      return;
    }

    const targetId = toggle.getAttribute("data-openlayer-info-toggle");
    const panel = targetId ? rootElement.querySelector<HTMLElement>(`#${targetId}`) : null;

    if (!panel) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 250) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    const shouldShow = panel.hidden;
    panel.hidden = !shouldShow;
    toggle.classList.toggle("is-active", shouldShow);
    toggle.setAttribute("aria-expanded", shouldShow ? "true" : "false");
  };

  rootElement.addEventListener("click", runFromEvent, true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(event);
    }
  });
}

export function bindToolCards(rootElement: HTMLElement, setView: (view: AppView) => void) {
  let lastRunAt = 0;

  const runFromEvent = (eventName: string, event: Event) => {
    const viewElement = findViewElement(event.target, rootElement);

    if (!viewElement || viewElement.getAttribute("aria-disabled") === "true") {
      return;
    }

    const nextView = viewElement.getAttribute("data-openlayer-view") as AppView | null;

    if (!nextView) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 350) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    setView(nextView);
  };

  rootElement.addEventListener("click", (event) => runFromEvent("click", event), true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(`keyboard:${key === " " ? "space" : key}`, event);
    }
  });
}

export function bindHistoryActions(
  rootElement: HTMLElement,
  handleHistoryAction: (action: HistoryActionName, historyId: string) => void
) {
  let lastRunAt = 0;

  const runFromEvent = (eventName: string, event: Event) => {
    const historyElement = findHistoryActionElement(event.target, rootElement);

    if (!historyElement) {
      return;
    }

    const action = historyElement.getAttribute("data-openlayer-history-action") as HistoryActionName | null;
    const historyId = historyElement.getAttribute("data-openlayer-history-id") ?? "";

    if (!action || !historyId) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 350) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    handleHistoryAction(action, historyId);
  };

  rootElement.addEventListener("click", (event) => runFromEvent("click", event), true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(`keyboard:${key === " " ? "space" : key}`, event);
    }
  });
}

export function bindToolWarnings(rootElement: HTMLElement) {
  // Replace the always-on orange experimental banner with a small orange info
  // button in the screen header that reveals the note only when clicked.
  const warnings = Array.from(rootElement.querySelectorAll<HTMLElement>(".tool-warning"));

  for (const warning of warnings) {
    const view = warning.closest("section");
    const titleBlock = view?.querySelector<HTMLElement>(".screen-title-block");

    if (!titleBlock) {
      continue;
    }

    warning.hidden = true;

    const info = document.createElement("button");
    info.type = "button";
    info.className = "tool-info-button";
    // "!" rather than "i": the round warning badge elsewhere in the panel
    // (compatibility-note.info-panel.is-warning) already uses "!" as its
    // glyph, and it is upright where an italic "i" is not -- an italic
    // single character leans visibly off the geometric center of an 18px
    // circle even when the box itself centers it correctly with flex.
    info.textContent = "!";
    info.setAttribute("aria-label", "Show experimental notes");
    info.setAttribute("aria-expanded", "false");
    titleBlock.appendChild(info);

    info.addEventListener("click", () => {
      const show = warning.hidden;
      warning.hidden = !show;
      info.setAttribute("aria-expanded", String(show));
      info.classList.toggle("is-active", show);
    });
  }
}

export function bindStickyProgress(rootElement: HTMLElement) {
  // Wrap each screen's back/title nav in one sticky header, so the tool name
  // and the way back stay visible while scrolling the form.
  //
  // The progress bar deliberately does NOT move up here. It used to, and in
  // Photoshop that produced a header whose height changed the moment a run
  // started - UXP does not reflow the panels below a sticky element that
  // resizes, so the bar painted over the first section. Reserving its box and
  // hiding it by colour both failed in the host for their own reasons. The bar
  // now simply stays where the markup puts it, in the generation status panel
  // next to the status text it belongs with, in ordinary flow where no renderer
  // has to agree about anything.
  const navs = Array.from(rootElement.querySelectorAll<HTMLElement>(".screen-nav"));

  for (const nav of navs) {
    const view = nav.parentElement;

    if (!view) {
      continue;
    }

    const head = document.createElement("div");
    head.className = "screen-head";
    nav.before(head);
    head.appendChild(nav);

    // Everything below the header becomes one scrolling body, so the header
    // can pin as a flex child instead of as a sticky element.
    //
    // `position: sticky` was the obvious way to keep the header visible and it
    // is the wrong one here: UXP does not reflow content around a sticky
    // element, so the header painted straight over the section beneath it. The
    // shell already pins .app-header and .app-footer correctly, and it does it
    // with flex -- a flex item cannot overlap its siblings, whatever the host
    // thinks about sticky. This gives each screen the same two-part shape the
    // shell has: a fixed head, a scrolling body.
    const body = document.createElement("div");
    body.className = "screen-body";

    while (head.nextSibling) {
      body.appendChild(head.nextSibling);
    }

    view.appendChild(body);
    // Marks the views that actually got this treatment. Home has no back/title
    // nav, so it never gets a head or a body and must keep scrolling itself --
    // without this class the CSS would hand its scrolling to a body element
    // that does not exist and the whole screen would be unreachable.
    view.classList.add("has-screen-head");
  }
}

/**
 * The first-run welcome overlay: shows once, ever, tries to detect ComfyUI on
 * its own, and lets the artist skip straight into the panel at any point.
 *
 * Deliberately connect-only (no GPU detection, no model recommendations) —
 * that already lives in the Setup screen, which this hands off to rather
 * than duplicating. Reuses the exact scan `handleFindComfyPort` (App.ts) runs
 * from Settings, so there is one answer to "is ComfyUI running", not two.
 *
 * Persists the detected URL through `saveServerUrlPreference` rather than a
 * full-preferences write: this binder runs before the rest of the panel has
 * necessarily loaded saved generation defaults into their fields, and a
 * full-object save at that point would write those fields' static markup
 * defaults over whatever the user had actually saved.
 */
export function bindWelcomeOverlay(elements: AppElements) {
  const overlay = elements.welcomeOverlay;

  if (loadHasSeenWelcome()) {
    overlay.hidden = true;
    return;
  }

  overlay.hidden = false;

  const dismiss = () => {
    saveHasSeenWelcome();
    overlay.hidden = true;
  };

  const runDetection = async () => {
    elements.welcomeStatusText.textContent = "Looking for ComfyUI...";
    elements.welcomeManualRow.hidden = true;
    elements.welcomeRetryButton.hidden = true;
    elements.welcomeContinueButton.hidden = true;

    const startUrl =
      elements.welcomeServerUrlInput.value.trim() || elements.serverUrl.value.trim() || DEFAULT_SERVER_URL;

    const foundUrl = await findActiveComfyUrl(startUrl, (message) => {
      elements.welcomeStatusText.textContent = message;
    });

    if (!foundUrl) {
      elements.welcomeStatusText.textContent =
        "No active ComfyUI port found. Start ComfyUI, or enter its address below.";
      elements.welcomeManualRow.hidden = false;
      elements.welcomeRetryButton.hidden = false;
      return;
    }

    elements.serverUrl.value = foundUrl;
    elements.welcomeServerUrlInput.value = foundUrl;
    saveServerUrlPreference(foundUrl);
    elements.welcomeStatusText.textContent = `Connected to ${foundUrl}.`;
    elements.welcomeContinueButton.hidden = false;
  };

  elements.welcomeRetryButton.addEventListener("click", () => {
    void runDetection();
  });
  elements.welcomeContinueButton.addEventListener("click", dismiss);
  elements.welcomeSkipButton.addEventListener("click", dismiss);

  void runDetection();
}

export function bindAdvancedToggles(rootElement: HTMLElement) {
  // Hide the sampler-tuning grid (steps/CFG/seed and friends) behind an
  // "Advanced settings" disclosure so each screen leads with prompt + model.
  const grids = Array.from(rootElement.querySelectorAll<HTMLElement>(".settings-grid")).filter((grid) =>
    grid.querySelector('input[id$="steps"], input[id$="cfg"], input[id$="seed"], input[id$="guidance"]')
  );

  // Remembers which screens the user chose to leave expanded, so switching
  // views or reopening the panel does not silently re-collapse them. Keyed by
  // each grid's own aria-label, which is already unique per screen.
  const openKeys = new Set(loadOpenAdvancedSections());

  for (const grid of grids) {
    const parent = grid.parentElement;
    const key = grid.getAttribute("aria-label");

    if (!parent) {
      continue;
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "advanced-toggle";
    // Plain-text caret (UXP does not render triangle/emoji glyphs reliably).

    const body = document.createElement("div");
    body.className = "advanced-body";

    const isOpen = key !== null && openKeys.has(key);
    body.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.classList.toggle("is-open", isOpen);
    toggle.textContent = isOpen ? "− Advanced settings" : "+ Advanced settings";

    parent.insertBefore(toggle, grid);
    parent.insertBefore(body, grid);
    body.appendChild(grid);

    // A sibling expansion grid (Outpaint padding stays visible) is left in place.
    toggle.addEventListener("click", () => {
      const shouldOpen = body.hidden;
      body.hidden = !shouldOpen;
      toggle.setAttribute("aria-expanded", String(shouldOpen));
      toggle.classList.toggle("is-open", shouldOpen);
      toggle.textContent = shouldOpen ? "− Advanced settings" : "+ Advanced settings";

      if (key !== null) {
        if (shouldOpen) {
          openKeys.add(key);
        } else {
          openKeys.delete(key);
        }
        saveOpenAdvancedSections(Array.from(openKeys));
      }
    });
  }
}

export function bindExternalLinks(rootElement: HTMLElement) {
  let lastRunAt = 0;

  const runFromEvent = (eventName: string, event: Event) => {
    const externalElement = findExternalLinkElement(event.target, rootElement);

    if (!externalElement) {
      return;
    }

    const url = externalElement.getAttribute("data-openlayer-external");

    if (!url) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 350) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();

    // Logged from the outcome rather than from the attempt. Until this was
    // reachable from a button it did not matter; now that a row offers Open, a
    // log line claiming success before the shell had answered would be the only
    // evidence available when someone reports that nothing happened.
    void openExternalUrl(url).then((opened) => {
      console.log(
        opened
          ? `[OpenLayer] external link opened from ${eventName}: ${url}`
          : `[OpenLayer] external link could not be opened from ${eventName}: ${url}`
      );
    });
  };

  rootElement.addEventListener("click", (event) => runFromEvent("click", event), true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(`keyboard:${key === " " ? "space" : key}`, event);
    }
  });
}

function findActionElement(target: EventTarget | null, rootElement: HTMLElement) {
  let element = getEventElement(target);

  while (element && element !== rootElement) {
    if (element.getAttribute("data-openlayer-action")) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

function findViewElement(target: EventTarget | null, rootElement: HTMLElement) {
  let element = getEventElement(target);

  while (element && element !== rootElement) {
    if (element.getAttribute("data-openlayer-view")) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

function findExternalLinkElement(target: EventTarget | null, rootElement: HTMLElement) {
  let element = getEventElement(target);

  while (element && element !== rootElement) {
    if (element.getAttribute("data-openlayer-external")) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

function findHistoryActionElement(target: EventTarget | null, rootElement: HTMLElement) {
  let element = getEventElement(target);

  while (element && element !== rootElement) {
    if (element.getAttribute("data-openlayer-history-action")) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

/**
 * Hands a URL to the host so the artist's own browser opens it.
 *
 * Returns whether either route actually ran. Both can fail quietly -- UXP's
 * shell can reject, and there is no `window.open` in the Photoshop host -- and
 * a button whose failure is invisible is worse than no button, so the caller is
 * given something to report rather than an assumption.
 */
async function openExternalUrl(url: string): Promise<boolean> {
  try {
    const uxp = require("uxp") as UxpModule;

    if (uxp.shell?.openExternal) {
      await uxp.shell.openExternal(url);
      return true;
    }
  } catch {
    // Browser preview builds do not expose UXP's shell module, and the host can
    // refuse a URL. Both fall through to the browser route below.
  }

  // Guarded as well as feature-checked. The Photoshop host defines `window` but
  // is not a browser, so `open` existing is not a promise that calling it works
  // -- and an exception here would reject a promise nothing is waiting on,
  // which is a console error with no owner rather than a failure anyone sees.
  try {
    if (typeof window.open === "function") {
      window.open(url, "_blank", "noopener");
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function getEventElement(target: EventTarget | null) {
  if (!target) {
    return null;
  }

  if (typeof (target as HTMLElement).getAttribute === "function") {
    return target as HTMLElement;
  }

  if ((target as Node).parentElement) {
    return (target as Node).parentElement;
  }

  return null;
}

function isActionDisabled(element: HTMLElement) {
  return element.classList.contains("is-disabled") || element.getAttribute("aria-disabled") === "true";
}

export function setActionDisabled(element: HTMLElement, isDisabled: boolean) {
  element.classList.toggle("is-disabled", isDisabled);
  element.setAttribute("aria-disabled", String(isDisabled));
  element.setAttribute("tabindex", isDisabled ? "-1" : "0");
}
