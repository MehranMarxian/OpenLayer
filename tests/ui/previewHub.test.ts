import { afterEach, describe, expect, it, vi } from "vitest";
import { createPreviewHub, PreviewPublication } from "../../src/ui/previewHub";
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

function publication(toolLabel: string, kind: PreviewPublication["kind"], marker: string): PreviewPublication {
  return { toolLabel, kind, blob: blob(marker) };
}

describe("previewHub", () => {
  it("replays the current publication to a listener that subscribes late", () => {
    const hub = createPreviewHub();
    hub.publish(publication("Inpaint", "result", "a"));

    const listener = vi.fn();
    hub.subscribe(listener);

    // The point of retaining the latest publication: a preview panel the artist
    // opens after a generation finishes still has something to show.
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ toolLabel: "Inpaint", kind: "result" });
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

    hub.publish(publication("Text to Image", "live", "frame-1"));
    hub.publish(publication("Text to Image", "live", "frame-2"));
    hub.publish(publication("Text to Image", "result", "final"));

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

    hub.publish(publication("Upscale", "result", "x"));

    expect(first).toHaveBeenLastCalledWith(expect.objectContaining({ toolLabel: "Upscale" }));
    expect(second).toHaveBeenLastCalledWith(expect.objectContaining({ toolLabel: "Upscale" }));
  });

  it("stops notifying after unsubscribe", () => {
    const hub = createPreviewHub();
    const listener = vi.fn();
    const unsubscribe = hub.subscribe(listener);
    unsubscribe();

    hub.publish(publication("Outpaint", "result", "x"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears to empty and only notifies when there was something to clear", () => {
    const hub = createPreviewHub();
    const listener = vi.fn();
    hub.subscribe(listener);

    hub.clear();
    expect(listener).toHaveBeenCalledTimes(1);

    hub.publish(publication("Inpaint", "result", "x"));
    hub.clear();

    expect(hub.latest()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("keeps publishing to healthy listeners when one throws", () => {
    const hub = createPreviewHub();
    const healthy = vi.fn();
    hub.subscribe(() => {
      throw new Error("listener exploded");
    });
    hub.subscribe(healthy);

    // A preview surface must never be able to break the generation that fed it.
    expect(() => hub.publish(publication("Inpaint", "result", "x"))).not.toThrow();
    expect(healthy).toHaveBeenLastCalledWith(expect.objectContaining({ toolLabel: "Inpaint" }));
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
      toolLabel: "Inpaint"
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
    expect(hub.latest()).toMatchObject({ toolLabel: "Inpaint", kind: "live" });

    resultPanel.showResult(blob("final"));
    expect(hub.latest()).toMatchObject({ toolLabel: "Inpaint", kind: "result" });
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
