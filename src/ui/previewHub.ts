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
 * The latest publication is retained. That is deliberate rather than lazy: a
 * panel the artist opens *after* a generation finishes still has something to
 * show, which is the difference between a preview panel and a live-only feed.
 *
 * It is retained **per tool** as well as overall, which is what lets the panel
 * be pinned. Pinning to Inpaint and then generating in Text to Image has to
 * leave the panel showing Inpaint's last result, and pinning to a tool that has
 * not run yet has to show the empty state rather than whatever happened to be
 * on screen. Both fall out of keeping one slot per tool.
 */

export type PreviewPublicationKind = "live" | "result";

/**
 * Every tool that can put an image on a preview surface, in dashboard order.
 *
 * This is the single source for both the `PreviewToolId` union and the panel's
 * pin dropdown, so a tool cannot be wired to publish without also being
 * pinnable, and the dropdown cannot offer a tool that never publishes.
 *
 * Prompt from Layer is deliberately absent: it produces caption text, not an
 * image, and has no result preview panel. Offering it as a pin target would
 * mean a choice that can only ever show "nothing yet".
 */
export const PREVIEW_TOOLS = [
  { id: "text-to-image", label: "Text to Image" },
  { id: "image-to-image", label: "Image to Image" },
  { id: "sketch-to-image", label: "Sketch to Image" },
  { id: "inpaint", label: "Inpaint" },
  { id: "outpaint", label: "Outpaint" },
  { id: "upscale", label: "Upscale" },
  { id: "live-painting", label: "Live Painting" }
] as const;

export type PreviewToolId = (typeof PREVIEW_TOOLS)[number]["id"];

export function isPreviewToolId(value: unknown): value is PreviewToolId {
  return PREVIEW_TOOLS.some((tool) => tool.id === value);
}

export function getPreviewToolLabel(toolId: PreviewToolId): string {
  return PREVIEW_TOOLS.find((tool) => tool.id === toolId)?.label ?? "OpenLayer";
}

export type PreviewPublication = {
  /**
   * Which tool published. The artist-facing label is derived from this rather
   * than carried alongside it, so a publisher cannot pass a label that
   * disagrees with the id the pin matches on.
   */
  toolId: PreviewToolId;
  kind: PreviewPublicationKind;
  blob: Blob;
};

export type PreviewHubListener = (publication: PreviewPublication | null) => void;

export type PreviewHub = {
  publish: (publication: PreviewPublication) => void;
  /** Drops every retained publication and tells listeners the surface is empty. */
  clear: () => void;
  latest: () => PreviewPublication | null;
  /**
   * The given tool's most recent publication, or null if it has not published
   * this session. A pinned panel resolves through this, which is why pinning to
   * an idle tool shows the empty state instead of another tool's image.
   */
  latestForTool: (toolId: PreviewToolId) => PreviewPublication | null;
  /**
   * Subscribes and immediately replays the current publication, so a listener
   * attaching late renders the right thing without a separate initial read.
   * Returns an unsubscribe function.
   *
   * Listeners are notified on every publication regardless of tool, and a
   * pinned surface re-resolves through `latestForTool` rather than filtering
   * the delivered value. That keeps the hub free of any notion of who is
   * looking at what.
   */
  subscribe: (listener: PreviewHubListener) => () => void;
};

export function createPreviewHub(): PreviewHub {
  const listeners = new Set<PreviewHubListener>();
  const byTool = new Map<PreviewToolId, PreviewPublication>();
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
      byTool.set(publication.toolId, publication);
      notify();
    },
    clear() {
      if (!latest && byTool.size === 0) {
        return;
      }

      latest = null;
      byTool.clear();
      notify();
    },
    latest: () => latest,
    latestForTool: (toolId) => byTool.get(toolId) ?? null,
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
