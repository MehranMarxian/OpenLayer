import { AppView } from "./appConstants";
import { AppElements } from "./appMarkup";
import { setDiagnostics } from "./statusBars";

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
  | "copyDiagnostics"
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
  | "clearHistory"
  | "startLivePainting"
  | "stopLivePainting"
  | "refineLivePainting"
  | "toggleLiveZoom"
  | "importLiveResult"
  | "importLiveRefined"
  | "toggleLiveAutoImport"
  | "toggleLiveAutoRefine";
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
    setDiagnostics(elements, `Event received: ${actionName} (${eventName}).`);
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
    info.textContent = "i";
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
    const head = document.createElement("div");
    head.className = "screen-head";
    nav.before(head);
    head.appendChild(nav);
  }
}

export function bindAdvancedToggles(rootElement: HTMLElement) {
  // Hide the sampler-tuning grid (steps/CFG/seed and friends) behind an
  // "Advanced settings" disclosure so each screen leads with prompt + model.
  const grids = Array.from(rootElement.querySelectorAll<HTMLElement>(".settings-grid")).filter((grid) =>
    grid.querySelector('input[id$="steps"], input[id$="cfg"], input[id$="seed"], input[id$="guidance"]')
  );

  for (const grid of grids) {
    const parent = grid.parentElement;

    if (!parent) {
      continue;
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "advanced-toggle";
    toggle.setAttribute("aria-expanded", "false");
    // Plain-text caret (UXP does not render triangle/emoji glyphs reliably).
    toggle.textContent = "+ Advanced settings";

    const body = document.createElement("div");
    body.className = "advanced-body";
    body.hidden = true;

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
    void openExternalUrl(url);
    console.log(`[OpenLayer] external link opened from ${eventName}: ${url}`);
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

async function openExternalUrl(url: string) {
  try {
    const uxp = require("uxp") as UxpModule;

    if (uxp.shell?.openExternal) {
      await uxp.shell.openExternal(url);
      return;
    }
  } catch {
    // Browser preview builds do not expose UXP's shell module.
  }

  if (typeof window.open === "function") {
    window.open(url, "_blank", "noopener");
  }
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
