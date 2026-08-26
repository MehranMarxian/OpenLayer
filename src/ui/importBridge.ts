import { PreviewPublication, PreviewToolId } from "./previewHub";

/**
 * The seam that lets the separated Preview panel trigger an import without
 * containing one.
 *
 * `previewHub` carries pixels one way: a tool publishes a blob, a surface shows
 * it. This carries *intent* the other way, and deliberately carries nothing
 * else. The panel says "import what I am looking at"; `renderApp` decides what
 * that means and does it with the handler it already had.
 *
 * ## Why the panel must not import for itself
 *
 * The obvious shortcut — the panel has the blob, so let it place the blob — is
 * wrong in a way that no test outside Photoshop would catch. A publication
 * carries a `Blob` and a `toolId` and nothing more; it has no
 * `bindDocumentContext` binding, so importing from it would place pixels into
 * whatever document happens to be active, which is precisely the failure
 * invariant A1 exists to prevent. The seven import handlers live inside
 * `renderApp` for good reason: each one owns the document identity frozen at
 * submission time, the mask ordering assertion (A2), the transactional cleanup
 * (A3), and for Inpaint the readiness contract evaluated against the source
 * snapshotted at submit time (B1). None of that is reachable from a blob, and
 * re-deriving any of it here would be a second implementation of the hardest,
 * least testable code in the project.
 *
 * So the bridge moves a tool id and a click. Everything that could be wrong
 * stays where it is already right.
 *
 * ## Why capability is pushed, not computed
 *
 * The panel could try to work out whether import is currently possible. It must
 * not. `setBusy` already computes exactly that for every dashboard button —
 * `isBusy || !gates[gate]` over `BUSY_GATED_ACTIONS` — and a second derivation
 * would be free to disagree. A panel that offers Import while a run is active
 * would break the A4 single-run lockout from a surface that never had to
 * respect it. So `renderApp` pushes a snapshot from the same place it disables
 * its own buttons, and the panel renders what it is told.
 */

/**
 * What each publishing tool offers, in `PREVIEW_TOOLS` order.
 *
 * `hasAutoImport` is not a preference — it records which tools actually have an
 * auto-import flag in `renderApp` today. Text to Image, Image to Image, Upscale
 * and Live Painting do; Sketch, Inpaint and Outpaint have none, in the dashboard
 * either. The panel mirrors the dashboard rather than inventing a control the
 * rest of the app cannot honour, and this table is what stops the two drifting:
 * adding the flag to a tool means changing it here, in one place, on purpose.
 */
export const IMPORT_TARGETS: Record<PreviewToolId, { label: string; hasAutoImport: boolean }> = {
  "text-to-image": { label: "Import Result as New Layer", hasAutoImport: true },
  "image-to-image": { label: "Import to Layers", hasAutoImport: true },
  "sketch-to-image": { label: "Import to Layers", hasAutoImport: false },
  inpaint: { label: "Import to Layers", hasAutoImport: false },
  outpaint: { label: "Import to Layers", hasAutoImport: false },
  upscale: { label: "Import to Layers", hasAutoImport: false },
  "style-reference": { label: "Import to Layers", hasAutoImport: false },
  "live-painting": { label: "Import to Layers", hasAutoImport: true }
};

export type ImportCapability = {
  /**
   * Whether the import button should be clickable right now. Mirrors the
   * dashboard button's own disabled state: a result exists, and no run is
   * active.
   */
  canImport: boolean;
  /**
   * Auto-import state, or null when the tool has no such control. Null and
   * `{ isEnabled: false }` mean different things — "no toggle exists" versus
   * "the toggle is off" — and the panel renders them differently.
   */
  auto: { isEnabled: boolean } | null;
};

export type ImportOutcome = {
  toolId: PreviewToolId;
  status: "importing" | "imported" | "failed";
  message: string;
};

export type ImportBridgeListener = () => void;

export type ImportHandlers = {
  /** Runs the tool's existing import handler. */
  requestImport: () => void;
  /** Flips the tool's auto-import flag. Absent when the tool has no flag. */
  toggleAutoImport?: () => void;
};

export type ImportBridge = {
  /**
   * `renderApp` registers a tool's handlers and gets an unregister function. A
   * remount re-registers over the top, so a stale closure from a previous mount
   * cannot keep serving clicks.
   */
  register: (toolId: PreviewToolId, handlers: ImportHandlers) => () => void;
  /** Pushes the current enabled/auto state for one tool. */
  publishCapability: (toolId: PreviewToolId, capability: ImportCapability) => void;
  capabilityFor: (toolId: PreviewToolId) => ImportCapability | null;
  /**
   * Asks the registered handler to import. A no-op when the tool never
   * registered or when its capability says it cannot import — the button should
   * already be disabled, and this is the second line of defence rather than the
   * first.
   */
  requestImport: (toolId: PreviewToolId) => void;
  toggleAutoImport: (toolId: PreviewToolId) => void;
  /** `renderApp` reports what happened so the clicking surface can say so. */
  reportOutcome: (outcome: ImportOutcome) => void;
  outcomeFor: (toolId: PreviewToolId) => ImportOutcome | null;
  subscribe: (listener: ImportBridgeListener) => () => void;
};

/**
 * Whether the panel should show an enabled import button for what it is
 * currently displaying.
 *
 * A `live` publication is a mid-generation sampler frame. There is no committed
 * result behind it — the handler would have nothing to place — and a run is by
 * definition still active, so this is also the A4 lockout expressed at the one
 * surface that can see the frame. Pure, and tested, because "is this button
 * live-safe" is exactly the kind of judgement that rots silently in a renderer.
 */
export function resolveImportAffordance(
  capability: ImportCapability | null,
  publication: PreviewPublication | null
): { visible: boolean; enabled: boolean; reason: string } {
  if (!publication || !capability) {
    return { visible: false, enabled: false, reason: "" };
  }

  if (publication.kind === "live") {
    return { visible: true, enabled: false, reason: "Import when the generation finishes." };
  }

  if (!capability.canImport) {
    return { visible: true, enabled: false, reason: "Import is unavailable while a generation is running." };
  }

  return { visible: true, enabled: true, reason: "" };
}

export function createImportBridge(): ImportBridge {
  const handlers = new Map<PreviewToolId, ImportHandlers>();
  const capabilities = new Map<PreviewToolId, ImportCapability>();
  const outcomes = new Map<PreviewToolId, ImportOutcome>();
  const listeners = new Set<ImportBridgeListener>();

  // A surface that throws while re-rendering must not propagate back into the
  // import handler that reported success, or a cosmetic bug becomes a failed
  // import. Same reasoning as previewHub's deliver().
  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error("[OpenLayer] An import bridge listener threw.", error);
      }
    }
  };

  return {
    register(toolId, toolHandlers) {
      handlers.set(toolId, toolHandlers);
      notify();

      return () => {
        // Only unregister if this registration is still the current one, so a
        // remount's cleanup cannot tear down the mount that replaced it.
        if (handlers.get(toolId) === toolHandlers) {
          handlers.delete(toolId);
          notify();
        }
      };
    },
    publishCapability(toolId, capability) {
      const previous = capabilities.get(toolId);

      if (
        previous &&
        previous.canImport === capability.canImport &&
        previous.auto?.isEnabled === capability.auto?.isEnabled &&
        (previous.auto === null) === (capability.auto === null)
      ) {
        // syncBusy runs on every state change; re-rendering the panel for an
        // unchanged capability would rebuild its buttons during live frames.
        return;
      }

      capabilities.set(toolId, capability);
      notify();
    },
    capabilityFor: (toolId) => capabilities.get(toolId) ?? null,
    requestImport(toolId) {
      const capability = capabilities.get(toolId);

      if (!capability?.canImport) {
        return;
      }

      handlers.get(toolId)?.requestImport();
    },
    toggleAutoImport(toolId) {
      handlers.get(toolId)?.toggleAutoImport?.();
    },
    reportOutcome(outcome) {
      outcomes.set(outcome.toolId, outcome);
      notify();
    },
    outcomeFor: (toolId) => outcomes.get(toolId) ?? null,
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}

/**
 * The instance the panels share, for the same reason `previewHub` is a module
 * singleton: both entrypoints are mounted from one module graph in one
 * JavaScript context, so there is no realm to bridge.
 */
export const importBridge = createImportBridge();
