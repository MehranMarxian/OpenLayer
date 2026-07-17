import { describe, expect, it, vi } from "vitest";
import { createObjectUrlRegistry } from "../../src/ui/objectUrlRegistry";
import { createOwnedObjectUrl } from "../../src/ui/previewState";

function createRegistry() {
  let sequence = 0;
  const revokeObjectURL = vi.fn();
  const registry = createObjectUrlRegistry({
    createObjectURL: vi.fn(() => `blob:${++sequence}`),
    revokeObjectURL
  });
  return { registry, revokeObjectURL };
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
