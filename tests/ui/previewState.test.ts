import { afterEach, describe, expect, it, vi } from "vitest";
import { createObjectUrlRegistry } from "../../src/ui/objectUrlRegistry";
import { createOwnedObjectUrl, createResultPreviewPanel } from "../../src/ui/previewState";

function createRegistry() {
  let sequence = 0;
  const revokeObjectURL = vi.fn();
  const registry = createObjectUrlRegistry({
    createObjectURL: vi.fn(() => `blob:${++sequence}`),
    revokeObjectURL
  });
  return { registry, revokeObjectURL };
}

// The result-preview panel touches the DOM (createElement/append), which the
// node test env does not provide. A minimal stub lets us assert the element
// reuse that eliminates the flicker, plus the URL ownership around it, without
// pulling in jsdom.
type FakeElement = { tagName: string; alt: string; src: string; innerHTML: string };

function installFakeDom() {
  const created: FakeElement[] = [];
  const previousDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: (tagName: string) => {
      const element: FakeElement = { tagName, alt: "", src: "", innerHTML: "" };
      created.push(element);
      return element;
    }
  };

  const panel = {
    innerHTML: "",
    children: [] as FakeElement[],
    append(child: FakeElement) {
      this.children.push(child);
    }
  };

  const restore = () => {
    (globalThis as { document?: unknown }).document = previousDocument;
  };

  return { created, panel, restore };
}

describe("owned object URL slot", () => {
  it("revokes the previous URL when a new one takes its place", () => {
    const { registry, revokeObjectURL } = createRegistry();
    const slot = createOwnedObjectUrl(registry);

    const first = slot.createFrom(new Blob(["a"]));
    const second = slot.createFrom(new Blob(["b"]));

    expect(first).toBe("blob:1");
    expect(second).toBe("blob:2");
    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(["blob:1"]);
    expect(registry.activeCount()).toBe(1);
  });

  it("takes ownership of an externally created URL and revokes it on replacement", () => {
    // The capture handlers create a source preview URL themselves; showing it
    // in a panel transfers ownership so replacing the source revokes it.
    const { registry, revokeObjectURL } = createRegistry();
    const slot = createOwnedObjectUrl(registry);

    const captured = registry.create(new Blob(["captured"]));
    slot.set(captured);
    slot.createFrom(new Blob(["replacement"]));

    expect(revokeObjectURL).toHaveBeenCalledWith(captured);
    expect(registry.activeCount()).toBe(1);
  });

  it("release revokes the held URL and empties the slot", () => {
    const { registry, revokeObjectURL } = createRegistry();
    const slot = createOwnedObjectUrl(registry);

    slot.createFrom(new Blob(["a"]));
    slot.release();

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(registry.activeCount()).toBe(0);
  });

  it("release on an empty slot does nothing", () => {
    const { registry, revokeObjectURL } = createRegistry();
    const slot = createOwnedObjectUrl(registry);

    slot.release();
    slot.release();

    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("stays safe when the registry has already revoked everything at teardown", () => {
    // Panel teardown calls registry.revokeAll(); a later release of the slot's
    // now-stale URL must not double-revoke through the underlying API.
    const { registry, revokeObjectURL } = createRegistry();
    const slot = createOwnedObjectUrl(registry);

    slot.createFrom(new Blob(["a"]));
    registry.revokeAll();
    slot.release();

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe("result preview live frames", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createPanel() {
    const { created, panel, restore } = installFakeDom();
    const { registry, revokeObjectURL } = createRegistry();
    const preview = createResultPreviewPanel({
      urls: registry,
      panel: panel as unknown as HTMLElement,
      emptyText: "No result yet",
      resultAlt: "Result",
      liveAlt: "Live preview"
    });
    return { created, panel, restore, registry, revokeObjectURL, preview };
  }

  it("reuses one img element across consecutive live frames instead of rebuilding it", () => {
    const { created, panel, restore, preview } = createPanel();

    try {
      preview.showProgress("frame", new Blob(["1"]));
      preview.showProgress("frame", new Blob(["2"]));
      preview.showProgress("frame", new Blob(["3"]));

      // The flicker fix: a single <img> is created and kept, not one per frame.
      const images = created.filter((element) => element.tagName === "img");
      expect(images).toHaveLength(1);
      expect(panel.children).toEqual(images);
      expect(images[0].src).toBe("blob:3");
    } finally {
      restore();
    }
  });

  it("keeps exactly one live URL alive across frames and revokes each prior one", () => {
    const { restore, registry, revokeObjectURL, preview } = createPanel();

    try {
      preview.showProgress("frame", new Blob(["1"]));
      preview.showProgress("frame", new Blob(["2"]));
      preview.showProgress("frame", new Blob(["3"]));

      // Two prior frames revoked, newest still alive.
      expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(["blob:1", "blob:2"]);
      expect(registry.activeCount()).toBe(1);

      preview.releaseLivePreviewUrl();
      expect(registry.activeCount()).toBe(0);
    } finally {
      restore();
    }
  });

  it("re-appends a fresh img after the panel drops to a message and back to frames", () => {
    const { created, restore, preview } = createPanel();

    try {
      preview.showProgress("frame", new Blob(["1"]));
      preview.showProgress("waiting...");
      preview.showProgress("frame", new Blob(["2"]));

      // Leaving live-image mode resets the persistent element, so the second
      // run gets its own img rather than reviving a detached one.
      expect(created.filter((element) => element.tagName === "img")).toHaveLength(2);
    } finally {
      restore();
    }
  });

  it("ignores live frames once a final result is shown", () => {
    const { created, restore, registry, preview } = createPanel();

    try {
      preview.showResult(new Blob(["result"]));
      const before = registry.activeCount();
      preview.showProgress("frame", new Blob(["late"]));

      expect(created.filter((element) => element.tagName === "img")).toHaveLength(1);
      expect(registry.activeCount()).toBe(before);
    } finally {
      restore();
    }
  });
});
