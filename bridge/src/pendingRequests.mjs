/**
 * Tracks commands sent to the panel that have not been answered yet.
 *
 * The bridge is a relay between two things with very different failure modes:
 * an MCP client that expects every call to settle, and a Photoshop panel that
 * can be closed, crash, or spend four minutes inside a diffusion run. Every way
 * that goes wrong ends up here.
 *
 * ## The three ways a request ends, and why "unknown id" is normal
 *
 * A request is settled by a matching `result`, by its own timeout, or by the
 * panel disconnecting. All three delete the entry, so the *fourth* case — a
 * `result` arriving for an id that is no longer pending — is not corruption and
 * must not throw. It is the ordinary consequence of a panel that finished its
 * generation two seconds after the deadline: the socket is still open, the
 * reply is well-formed, and it is simply too late to be wanted. `settle`
 * reports that as `false` so the caller can log it and carry on, rather than
 * rejecting an MCP call that has already been rejected once.
 *
 * That is also why an id is never reused. A reused id could match a stale
 * reply to a live request and hand an agent the wrong generation's status.
 *
 * ## Why timers are injected
 *
 * Generation timeouts are minutes long. A test that actually waited would be a
 * test nobody runs, and one built on global fake timers leaks that setup into
 * every other test in the file. Passing `setTimer`/`clearTimer` in keeps the
 * registry a pure data structure with a clock-shaped hole.
 */
export function createPendingRequests({ setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  /** @type {Map<string, { reject: (error: Error) => void, resolve: (value: unknown) => void, timer: unknown }>} */
  const entries = new Map();

  const drop = (id) => {
    const entry = entries.get(id);

    if (!entry) {
      return null;
    }

    clearTimer(entry.timer);
    entries.delete(id);

    return entry;
  };

  return {
    /**
     * Registers `id` and returns the promise the MCP tool call awaits.
     *
     * `timeoutMs` is per call because the tools differ by orders of magnitude:
     * `prompt_from_layer` is a round trip to a captioner, `outpaint` is a full
     * diffusion run on a 12 GB card. One global timeout would either abandon
     * live generations or leave a dead panel hanging an agent for minutes.
     */
    open(id, timeoutMs) {
      if (entries.has(id)) {
        // Only reachable through a bug in id generation, but the failure it
        // would cause — two agents' results crossing — is invisible and awful,
        // so it is worth being loud about here.
        throw new Error(`Request id ${id} is already pending.`);
      }

      return new Promise((resolve, reject) => {
        const timer = setTimer(() => {
          entries.delete(id);
          reject(
            new Error(
              `The OpenLayer panel did not answer within ${Math.round(timeoutMs / 1000)}s. ` +
                `The generation may still be running in Photoshop — check the panel before retrying.`
            )
          );
        }, timeoutMs);

        entries.set(id, { resolve, reject, timer });
      });
    },

    /**
     * Delivers a panel reply. Returns whether it matched a live request; see
     * the note above on why `false` is an expected outcome, not an error.
     */
    settle(id, value) {
      const entry = drop(id);

      if (!entry) {
        return false;
      }

      entry.resolve(value);

      return true;
    },

    /**
     * Fails every outstanding request with the same reason.
     *
     * Called when the panel disconnects or is replaced. Without it, closing
     * Photoshop mid-generation would leave the agent waiting out a full
     * multi-minute timeout for an answer that provably cannot come.
     */
    rejectAll(reason) {
      const outstanding = [...entries.keys()];

      for (const id of outstanding) {
        drop(id)?.reject(new Error(reason));
      }

      return outstanding.length;
    },

    has: (id) => entries.has(id),
    get size() {
      return entries.size;
    }
  };
}
