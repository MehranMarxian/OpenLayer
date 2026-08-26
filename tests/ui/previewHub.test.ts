import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPreviewHub,
  getPreviewToolLabel,
  isPreviewToolId,
  PREVIEW_TOOLS,
  PreviewPublication,
  PreviewToolId
} from "../../src/ui/previewHub";
import { createObjectUrlRegistry } from "../../src/ui/objectUrlRegistry";
import { createResultPreviewPanel } from "../../src/ui/previewState";

function blob(marker: string) {
  return { marker } as unknown as Blob;
}

// The result-preview panel touches the DOM, which the node test env does not
// provide. Same minimal stub as previewState.test.ts, for the same reason: keep
// jsdom out of a pure-logic suite.
function installFakeDom() {
  const previousDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: (tagName: string) => ({ tagName, alt: "", src: "", innerHTML: "" })
  };

  return () => {
    (globalThis as { document?: unknown }).document = previousDocument;
  };
}

function publication(toolId: PreviewToolId, kind: PreviewPublication["kind"], marker: string): PreviewPublication {
  return { toolId, kind, blob: blob(marker) };
}

describe("previewHub", () => {
  it("replays the current publication to a listener that subscribes late", () => {
    const hub = createPreviewHub();
    hub.publish(publication("inpaint", "result", "a"));

    const listener = vi.fn();
    hub.subscribe(listener);

    // The point of retaining the latest publication: a preview panel the artist
    // opens after a generation finishes still has something to show.
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ toolId: "inpaint", kind: "result" });
  });

  it("replays null when nothing has been published", () => {
    const listener = vi.fn();
    createPreviewHub().subscribe(listener);

    expect(listener).toHaveBeenCalledWith(null);
  });

  it("keeps only the latest publication", () => {
    const hub = createPreviewHub();
    const listener = vi.fn();
    hub.subscribe(listener);

    hub.publish(publication("text-to-image", "live", "frame-1"));
    hub.publish(publication("text-to-image", "live", "frame-2"));
    hub.publish(publication("text-to-image", "result", "final"));

    expect(hub.latest()?.blob).toEqual(blob("final"));
    expect(hub.latest()?.kind).toBe("result");
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("notifies every subscriber", () => {
    const hub = createPreviewHub();
    const first = vi.fn();
    const second = vi.fn();
    hub.subscribe(first);
    hub.subscribe(second);

    hub.publish(publication("upscale", "result", "x"));

    expect(first).toHaveBeenLastCalledWith(expect.objectContaining({ toolId: "upscale" }));
    expect(second).toHaveBeenLastCalledWith(expect.objectContaining({ toolId: "upscale" }));
  });

  it("stops notifying after unsubscribe", () => {
    const hub = createPreviewHub();
    const listener = vi.fn();
    const unsubscribe = hub.subscribe(listener);
    unsubscribe();

    hub.publish(publication("outpaint", "result", "x"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears to empty and only notifies when there was something to clear", () => {
    const hub = createPreviewHub();
    const listener = vi.fn();
    hub.subscribe(listener);

    hub.clear();
    expect(listener).toHaveBeenCalledTimes(1);

    hub.publish(publication("inpaint", "result", "x"));
    hub.clear();

    expect(hub.latest()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("survives a Live Painting frame sequence ending in a refined result", () => {
    // Live Painting publishes directly rather than through a result-preview
    // panel: many fast-tier frames, then one refined image. The badge has to
    // land on "result" at the end, and only the last blob is retained.
    const hub = createPreviewHub();
    const listener = vi.fn();
    hub.subscribe(listener);

    for (let frame = 0; frame < 30; frame += 1) {
      hub.publish(publication("live-painting", "live", `frame-${frame}`));
    }

    expect(hub.latest()).toMatchObject({ toolId: "live-painting", kind: "live" });
    expect(hub.latest()?.blob).toEqual(blob("frame-29"));

    hub.publish(publication("live-painting", "result", "refined"));

    expect(hub.latest()).toMatchObject({ toolId: "live-painting", kind: "result" });
    expect(hub.latest()?.blob).toEqual(blob("refined"));
    expect(listener).toHaveBeenCalledTimes(32);
  });

  it("keeps publishing to healthy listeners when one throws", () => {
    const hub = createPreviewHub();
    const healthy = vi.fn();
    hub.subscribe(() => {
      throw new Error("listener exploded");
    });
    hub.subscribe(healthy);

    // A preview surface must never be able to break the generation that fed it.
    expect(() => hub.publish(publication("inpaint", "result", "x"))).not.toThrow();
    expect(healthy).toHaveBeenLastCalledWith(expect.objectContaining({ toolId: "inpaint" }));
  });
});

describe("per-tool retention (what pinning resolves through)", () => {
  // The preview panel resolves exactly this way: pinned ? latestForTool(pin) :
  // latest(). These cover the resolution; the select element itself is verified
  // in Photoshop, since this suite deliberately runs without a DOM.
  const resolve = (hub: ReturnType<typeof createPreviewHub>, pin: PreviewToolId | null) =>
    pin ? hub.latestForTool(pin) : hub.latest();

  it("keeps one slot per tool, so a pinned tool survives another tool publishing", () => {
    const hub = createPreviewHub();
    hub.publish(publication("inpaint", "result", "inpaint-final"));
    hub.publish(publication("text-to-image", "result", "t2i-final"));

    // The whole point of the feature: iterating on an Inpaint must not lose the
    // panel to a Text to Image run started to compare against.
    expect(resolve(hub, "inpaint")?.blob).toEqual(blob("inpaint-final"));
    expect(resolve(hub, null)?.blob).toEqual(blob("t2i-final"));
  });

  it("shows nothing for a tool that has not published this session", () => {
    const hub = createPreviewHub();
    hub.publish(publication("inpaint", "result", "inpaint-final"));

    // Not the most recent image, which would be a lie about which tool made it.
    expect(resolve(hub, "upscale")).toBeNull();
    expect(hub.latestForTool("upscale")).toBeNull();
  });

  it("advances the pinned tool's slot when that tool publishes again", () => {
    const hub = createPreviewHub();
    hub.publish(publication("outpaint", "live", "frame-1"));
    hub.publish(publication("text-to-image", "live", "other-tool"));
    hub.publish(publication("outpaint", "result", "outpaint-final"));

    expect(resolve(hub, "outpaint")).toMatchObject({ toolId: "outpaint", kind: "result" });
    expect(resolve(hub, "outpaint")?.blob).toEqual(blob("outpaint-final"));
  });

  it("empties every per-tool slot on clear, not just the most recent", () => {
    // disposeAppResources calls clear(); a preview panel left open must not keep
    // showing a result from a closed session, pinned or not.
    const hub = createPreviewHub();
    hub.publish(publication("inpaint", "result", "a"));
    hub.publish(publication("upscale", "result", "b"));

    hub.clear();

    expect(hub.latest()).toBeNull();
    expect(hub.latestForTool("inpaint")).toBeNull();
    expect(hub.latestForTool("upscale")).toBeNull();
  });

  it("notifies a pinned listener even when another tool published", () => {
    // The panel re-resolves on every notification rather than filtering, so it
    // has to be told about publications that are not its own.
    const hub = createPreviewHub();
    const listener = vi.fn();
    hub.subscribe(listener);

    hub.publish(publication("text-to-image", "result", "x"));

    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("PREVIEW_TOOLS inventory", () => {
  it("lists every tool that publishes a preview, and nothing that does not", () => {
    // Frozen on purpose, the same way toolDescriptors freezes its tables: a tool
    // wired to publish without being added here would not be pinnable, and a
    // tool listed here that never publishes is a dropdown entry that can only
    // ever show "nothing yet". Prompt from Layer produces caption text and is
    // correctly absent.
    expect(PREVIEW_TOOLS.map((tool) => tool.id)).toEqual([
      "text-to-image",
      "image-to-image",
      "sketch-to-image",
      "inpaint",
      "outpaint",
      "upscale",
      "style-reference",
      "live-painting"
    ]);
    expect(PREVIEW_TOOLS.map((tool) => tool.id)).not.toContain("prompt-from-layer");
  });

  it("gives every tool a label for the badge and the dropdown", () => {
    for (const tool of PREVIEW_TOOLS) {
      expect(getPreviewToolLabel(tool.id)).toBe(tool.label);
      expect(tool.label.length).toBeGreaterThan(0);
    }
  });

  it("rejects a stored pin that no longer names a real tool", () => {
    // A pin persisted by an older build must not leave the panel stuck on
    // something that can never publish again.
    expect(isPreviewToolId("inpaint")).toBe(true);
    expect(isPreviewToolId("prompt-from-layer")).toBe(false);
    expect(isPreviewToolId("a-tool-that-was-removed")).toBe(false);
    expect(isPreviewToolId("")).toBe(false);
    expect(isPreviewToolId(null)).toBe(false);
  });
});

describe("result preview panels mirroring to the hub", () => {
  let restoreDom: (() => void) | null = null;

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  function setup() {
    restoreDom = installFakeDom();
    const created: Blob[] = [];
    const revoked: string[] = [];
    let next = 0;
    const urls = createObjectUrlRegistry({
      createObjectURL: (value) => {
        created.push(value);
        next += 1;
        return `blob:main-${next}`;
      },
      revokeObjectURL: (url) => revoked.push(url)
    });
    const hub = createPreviewHub();
    const panel = { innerHTML: "", append: vi.fn() } as unknown as HTMLElement;

    const resultPanel = createResultPreviewPanel({
      urls,
      panel,
      emptyText: "No result yet",
      resultAlt: "result",
      liveAlt: "live",
      hub,
      toolId: "inpaint"
    });

    return { hub, resultPanel, urls, created, revoked };
  }

  it("publishes the blob rather than the panel's own object URL", () => {
    const { hub, resultPanel, created } = setup();
    const source = blob("result-bytes");

    resultPanel.showResult(source);

    // A5: handing over the URL would give it two owners and make the second
    // panel's image depend on which panel tears down first.
    expect(hub.latest()?.blob).toBe(source);
    expect(created).toEqual([source]);
    expect(String(hub.latest()?.blob)).not.toContain("blob:");
  });

  it("mirrors live frames as live and the final image as a result", () => {
    const { hub, resultPanel } = setup();

    resultPanel.showProgress("Generating", blob("frame"));
    expect(hub.latest()).toMatchObject({ toolId: "inpaint", kind: "live" });

    resultPanel.showResult(blob("final"));
    expect(hub.latest()).toMatchObject({ toolId: "inpaint", kind: "result" });
  });

  it("does not mirror textual progress or a cleared result", () => {
    const { hub, resultPanel } = setup();
    const listener = vi.fn();
    hub.subscribe(listener);

    resultPanel.showProgress("Queued in ComfyUI");
    resultPanel.showResult(null);

    expect(hub.latest()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops mirroring progress once a result exists, matching the in-panel preview", () => {
    const { hub, resultPanel } = setup();

    resultPanel.showResult(blob("final"));
    resultPanel.showProgress("late frame", blob("stale"));

    expect(hub.latest()?.blob).toEqual(blob("final"));
  });

  it("publishes nothing when no hub is wired", () => {
    restoreDom = installFakeDom();
    const urls = createObjectUrlRegistry({
      createObjectURL: () => "blob:x",
      revokeObjectURL: () => undefined
    });
    const panel = { innerHTML: "", append: vi.fn() } as unknown as HTMLElement;
    const resultPanel = createResultPreviewPanel({
      urls,
      panel,
      emptyText: "empty",
      resultAlt: "result",
      liveAlt: "live"
    });

    expect(() => resultPanel.showResult(blob("x"))).not.toThrow();
  });
});
