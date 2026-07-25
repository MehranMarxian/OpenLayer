/**
 * The seam between the generating tools and any surface that wants to show what
 * they produced — currently the separated `openlayerPreview` panel.
 *
 * The hub carries **blobs, not object URLs**. That is the whole design decision
 * worth knowing: safety invariant A5 requires every object URL to have exactly
 * one owner that revokes it, and handing a URL created by the main panel to a
 * second panel would give it two, with teardown order deciding whether the
 * second panel shows a dead image. Passing the blob instead lets each surface
 * mint and own its own URL, and nothing has to reason about the other's
 * lifetime.
 *
 * Only the latest publication is retained. That is deliberate rather than lazy:
 * a panel the artist opens *after* a generation finishes still has something to
 * show, which is the difference between a preview panel and a live-only feed.
 */

export type PreviewPublicationKind = "live" | "result";

export type PreviewPublication = {
  /** Artist-facing tool name, e.g. "Inpaint". */
  toolLabel: string;
  kind: PreviewPublicationKind;
  blob: Blob;
};

export type PreviewHubListener = (publication: PreviewPublication | null) => void;

export type PreviewHub = {
  publish: (publication: PreviewPublication) => void;
  /** Drops the retained publication and tells every listener the surface is empty. */
  clear: () => void;
  latest: () => PreviewPublication | null;
  /**
   * Subscribes and immediately replays the current publication, so a listener
   * attaching late renders the right thing without a separate initial read.
   * Returns an unsubscribe function.
   */
  subscribe: (listener: PreviewHubListener) => () => void;
};

export function createPreviewHub(): PreviewHub {
  const listeners = new Set<PreviewHubListener>();
  let latest: PreviewPublication | null = null;

  // One broken listener must not stop the others from updating, and must never
  // propagate back into the generation pipeline that published. This guards the
  // replay inside subscribe() as well as the fan-out: a surface that throws on
  // its very first render would otherwise break the caller that attached it.
  const deliver = (listener: PreviewHubListener) => {
    try {
      listener(latest);
    } catch (error) {
      console.error("[OpenLayer] A preview listener threw.", error);
    }
  };

  const notify = () => {
    for (const listener of [...listeners]) {
      deliver(listener);
    }
  };

  return {
    publish(publication) {
      latest = publication;
      notify();
    },
    clear() {
      if (!latest) {
        return;
      }

      latest = null;
      notify();
    },
    latest: () => latest,
    subscribe(listener) {
      listeners.add(listener);
      deliver(listener);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}

/**
 * The instance the panels share. Both panels run in one JavaScript context — the
 * second entrypoint does not get its own realm — so a module singleton is all
 * the plumbing this needs. `createPreviewHub` stays exported so tests get
 * isolated instances.
 */
export const previewHub = createPreviewHub();
