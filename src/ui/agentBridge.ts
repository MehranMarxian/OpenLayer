import { AgentParams, AgentToolId } from "./agentProtocol";

/**
 * The seam that lets a connected agent press the panel's own buttons.
 *
 * Structurally this is `importBridge.ts` at a different edge, and for the same
 * reason: an outside surface needs to trigger handlers that live inside
 * `renderApp`'s closure, and `docs/ORCHESTRATION.md` §3 deliberately rejected
 * carving that closure up. `renderApp` registers references to the handlers it
 * already has; nothing out here reimplements generation.
 *
 * ## Why capability is pushed, and why that is not optional here
 *
 * `docs/mcp-bridge.md` §3.3 claimed invariant A4 — one active run at a time —
 * would be inherited for free, because an agent command "hits the same busy
 * lockout an extra click would". **That is not true, and this module exists in
 * the shape it does because of it.** The seven generation handlers do not check
 * `isBusy`; they *set* it. Nothing in `handleGenerate` refuses to start. The
 * lockout an extra click hits is `syncBusy` disabling the button, which a
 * direct call never touches — so injecting values and invoking the handler
 * would start a second pipeline against a document the first one is still
 * writing to.
 *
 * So `renderApp` pushes a capability snapshot from `syncBusy`, the same place
 * it disables its own buttons, and `execute` refuses when that snapshot says
 * so. This is the identical arrangement `importBridge` uses, and its comment
 * makes the same point: a surface that computes its own answer is free to
 * disagree with the one the dashboard is enforcing.
 *
 * ## Why a rejected parameter cancels the whole command
 *
 * Values are written into the fields a person types into, then the existing
 * zero-arg handler runs. A `<select>` silently keeps its current value when
 * assigned an option it does not have, so an agent asking for a checkpoint that
 * is not installed would otherwise get a real generation on whatever checkpoint
 * happened to be selected, reported as a success. `applyParams` detects that
 * and `execute` refuses to run at all. A refusal an agent can read is always
 * better than a plausible image made from the wrong inputs.
 *
 * ## Why parameters are applied in two passes
 *
 * Some fields rewrite others. Changing Text to Image's workflow runs
 * `applyRecommendedPresetSettings` — which *overwrites* steps and cfg — and
 * kicks off an async refresh of the checkpoint list. Applying a whole command
 * in one pass therefore has two bugs, neither visible in a unit test that stubs
 * the DOM:
 *
 * - `{ workflow, steps }` in that key order silently discards the agent's
 *   steps, because the workflow's listener overwrites them a moment later.
 * - `{ workflow, checkpoint }` validates the checkpoint against the *old*
 *   option list, so a valid checkpoint is rejected and a stale one accepted.
 *
 * So `renderApp` names the fields that rewrite others as `leadingParams` and
 * supplies a `settle` that awaits their consequences. `execute` applies the
 * leading params, awaits `settle`, then applies everything else — which is
 * exactly the order a person works in: choose the workflow, watch the fields
 * repopulate, then adjust. An explicit `steps` now beats the preset default
 * because it is written after it, and a checkpoint is checked against the list
 * that actually exists by then.
 *
 * ## A refused command can still have moved the fields
 *
 * Writing into real controls means a command rejected on its third parameter
 * has already written its first two, and the panel is left showing them. This
 * is inherent rather than an oversight: once a workflow change has repopulated
 * the checkpoint list and overwritten steps and cfg, there is no snapshot left
 * to restore *to*, so atomicity is not actually on offer here. What is on offer
 * is failing early and saying exactly what was wrong — and nothing generates,
 * so the worst case is fields a person can see and correct.
 */

/** A form control an agent may write into. */
export type AgentField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export type AgentToolRegistration = {
  /** The existing zero-arg handler. Never re-implemented, only called. */
  run: () => void | Promise<void>;
  /** Parameter name to the control that holds it. */
  fields: Record<string, AgentField | undefined>;
  /**
   * Params whose fields rewrite other fields, applied first and in this order.
   * See the header: `workflow` repopulates checkpoints and overwrites steps/cfg.
   */
  leadingParams?: readonly string[];
  /**
   * Awaited between the two passes, to let a leading param's consequences land
   * before the rest are written over the top. `renderApp` supplies the real
   * refresh here — the field's own `change` listener voids its promise, so
   * waiting on the listener is not possible from outside the closure.
   */
  settle?: () => Promise<void>;
  /** The tool's status line, read after `run` settles. */
  statusText: HTMLElement;
  /** The tool's status pill, whose `error` class is the reliable failure signal. */
  statusPill?: HTMLElement;
  /**
   * Reads the actual output a run produced, when the status line alone is not
   * the point of the call. Prompt from Layer's status settles to "Prompt text
   * generated." — true, and useless to an agent that asked *for the caption*.
   * Called only when `run` succeeded, and appended to the status text rather
   * than replacing it, so the human-readable outcome an agent might relay is
   * never lost.
   */
  describeResult?: () => string;
};

export type AgentCapability = {
  /** Whether a command may run right now. Mirrors the dashboard button's state. */
  canRun: boolean;
  /** Shown to the agent when `canRun` is false. */
  reason: string;
};

export type AgentOutcome = { ok: boolean; status: string };

export type AppliedParams = {
  applied: string[];
  rejected: { name: string; reason: string }[];
};

/**
 * Writes agent-supplied values into the tool's own form controls.
 *
 * Exported for testing and used only by `execute`. Dispatches `input` and
 * `change` so anything listening for a human edit — disclosure toggles, derived
 * labels, preset reactions — behaves exactly as it would if someone had typed.
 */
export function applyParams(
  fields: Record<string, AgentField | undefined>,
  params: AgentParams
): AppliedParams {
  const applied: string[] = [];
  const rejected: { name: string; reason: string }[] = [];

  for (const [name, rawValue] of Object.entries(params)) {
    const field = fields[name];

    if (!field) {
      rejected.push({ name, reason: `${name} is not a parameter of this tool.` });
      continue;
    }

    const value = String(rawValue);
    const options = optionValuesOf(field);

    if (options && !options.includes(value)) {
      // The silent-keep case. Naming what *is* available turns a dead end into
      // something an agent can retry correctly on its next turn.
      rejected.push({
        name,
        reason:
          `${name} "${value}" is not available. ` +
          `Choose one of: ${options.filter(Boolean).join(", ") || "(none loaded yet)"}.`
      });
      continue;
    }

    field.value = value;
    notifyFieldChanged(field);
    applied.push(name);
  }

  return { applied, rejected };
}

/**
 * A field's selectable values, or null when it is not a select.
 *
 * Duck-typed rather than `instanceof HTMLSelectElement`, and read by index
 * rather than spread, because this runs in Photoshop's UXP runtime — a DOM
 * subset, not a browser. Nothing else in `src/` uses `instanceof HTML*` or
 * relies on a DOM collection being iterable, and this is not the file to find
 * out whether they hold: a wrong answer here silently skips the validation that
 * stops an agent generating on the wrong checkpoint.
 */
function optionValuesOf(field: AgentField): string[] | null {
  const options = (field as HTMLSelectElement).options as HTMLOptionsCollection | undefined;

  if (!options || typeof options.length !== "number") {
    return null;
  }

  const values: string[] = [];

  for (let index = 0; index < options.length; index += 1) {
    values.push(options[index]?.value ?? "");
  }

  return values;
}

/**
 * Tells the panel a field changed, the way a human edit would.
 *
 * Best-effort on purpose. `Event` is the one constructor in this module that
 * `src/` has never used anywhere else, so whether UXP provides it is genuinely
 * unverified until this runs in Photoshop. Correctness does not depend on it —
 * the field's value is already set, and the one listener that truly matters
 * (workflow repopulating checkpoints) is driven by the registration's `settle`
 * instead. So a host without `Event` loses cosmetic reactions, not the command.
 */
function notifyFieldChanged(field: AgentField) {
  try {
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (error) {
    console.warn("[OpenLayer] Could not dispatch a field change event.", error);
  }
}

/**
 * Reads a settled handler's own account of what happened.
 *
 * The handlers swallow their errors — catch, set the status bar, return — so
 * awaiting one tells you nothing. The pill's `error` class is preferred over
 * matching words in the text because it is what the handler actually set;
 * the text fallback exists only for a tool whose status line has no pill.
 */
export function readOutcome(statusText: HTMLElement, statusPill?: HTMLElement): AgentOutcome {
  const status = statusText.textContent?.trim() || "Finished.";
  const failed = statusPill
    ? statusPill.classList.contains("error")
    : /fail|error|required|could not|unavailable/i.test(status);

  return { ok: !failed, status };
}

export type AgentBridgeListener = () => void;

export type AgentBridge = {
  register: (toolId: AgentToolId, registration: AgentToolRegistration) => () => void;
  registeredTools: () => AgentToolId[];
  publishCapability: (toolId: AgentToolId, capability: AgentCapability) => void;
  capabilityFor: (toolId: AgentToolId) => AgentCapability | null;
  execute: (toolId: AgentToolId, params: AgentParams) => Promise<AgentOutcome>;
  subscribe: (listener: AgentBridgeListener) => () => void;
};

export function createAgentBridge(): AgentBridge {
  const registrations = new Map<AgentToolId, AgentToolRegistration>();
  const capabilities = new Map<AgentToolId, AgentCapability>();
  const listeners = new Set<AgentBridgeListener>();

  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error("[OpenLayer] An agent bridge listener threw.", error);
      }
    }
  };

  return {
    register(toolId, registration) {
      registrations.set(toolId, registration);
      notify();

      return () => {
        // Identity-checked so a remount's cleanup cannot tear down the
        // registration that replaced it. Same guard, same reason, as
        // `importBridge.register`.
        if (registrations.get(toolId) === registration) {
          registrations.delete(toolId);
          notify();
        }
      };
    },

    registeredTools: () => [...registrations.keys()],

    publishCapability(toolId, capability) {
      const previous = capabilities.get(toolId);

      if (previous?.canRun === capability.canRun && previous.reason === capability.reason) {
        // `syncBusy` runs on every state change; re-notifying for an unchanged
        // snapshot would churn subscribers during a live sequence.
        return;
      }

      capabilities.set(toolId, capability);
      notify();
    },

    capabilityFor: (toolId) => capabilities.get(toolId) ?? null,

    /**
     * Runs a tool on an agent's behalf.
     *
     * Always resolves. Every refusal is a real answer an agent can act on, and
     * an exception here would reach the socket handler as an unhandled
     * rejection rather than as something the agent gets told.
     */
    async execute(toolId, params) {
      const registration = registrations.get(toolId);

      if (!registration) {
        return { ok: false, status: `${toolId} is not available in this panel.` };
      }

      const capability = capabilities.get(toolId);

      if (!capability?.canRun) {
        // The A4 gate. See the header: this is the only thing standing between
        // an agent command and a second concurrent pipeline, because the
        // handler itself will not refuse.
        return {
          ok: false,
          status: capability?.reason || "OpenLayer is busy with another operation."
        };
      }

      // Pass one: the fields that rewrite other fields, in the order given.
      const leadingNames = (registration.leadingParams ?? []).filter(
        (name) => params[name] !== undefined
      );
      const leading: AgentParams = {};

      for (const name of leadingNames) {
        leading[name] = params[name];
      }

      const trailing: AgentParams = {};

      for (const [name, value] of Object.entries(params)) {
        if (!leadingNames.includes(name)) {
          trailing[name] = value;
        }
      }

      const leadingResult = applyParams(registration.fields, leading);

      if (leadingResult.rejected.length > 0) {
        // Bail before the refresh: a bad workflow makes every field that
        // depends on it meaningless, and there is nothing to wait for.
        return {
          ok: false,
          status: leadingResult.rejected.map((entry) => entry.reason).join(" ")
        };
      }

      // Only wait when a leading param actually changed something. A command
      // that never mentions the workflow should not pay for a model-list
      // refresh it does not need.
      if (leadingResult.applied.length > 0 && registration.settle) {
        try {
          await registration.settle();
        } catch (error) {
          return {
            ok: false,
            status: `Could not refresh the panel after setting ${leadingResult.applied.join(", ")}: ${
              error instanceof Error ? error.message : String(error)
            }`
          };
        }
      }

      // Pass two, now that any repopulated lists exist and any preset defaults
      // have landed — so an explicit value here wins over the default.
      const trailingResult = applyParams(registration.fields, trailing);
      const rejected = [...leadingResult.rejected, ...trailingResult.rejected];

      if (rejected.length > 0) {
        return {
          ok: false,
          status: rejected.map((entry) => entry.reason).join(" ")
        };
      }

      try {
        await registration.run();
      } catch (error) {
        // Handlers are not expected to throw — they catch and set their status
        // bar. If one ever does, the agent must not be left waiting out a
        // ten-minute timeout for a reply that is never coming.
        return {
          ok: false,
          status: error instanceof Error ? error.message : String(error)
        };
      }

      const outcome = readOutcome(registration.statusText, registration.statusPill);

      if (outcome.ok && registration.describeResult) {
        try {
          const description = registration.describeResult();

          return description ? { ok: true, status: `${outcome.status} ${description}` } : outcome;
        } catch (error) {
          // The generation already succeeded and the panel already has its
          // result; a broken describer must not turn a real success into a
          // reported failure. Fall back to the plain status.
          console.warn("[OpenLayer] describeResult threw.", error);
        }
      }

      return outcome;
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}

/**
 * The instance the panel shares, for the same reason `importBridge` is a module
 * singleton: both entrypoints mount from one module graph in one JavaScript
 * context, so there is no realm to bridge.
 */
export const agentBridge = createAgentBridge();
