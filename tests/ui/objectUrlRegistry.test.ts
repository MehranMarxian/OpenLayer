import { describe, expect, it, vi } from "vitest";
import { createObjectUrlRegistry } from "../../src/ui/objectUrlRegistry";

describe("object URL registry", () => {
  it("tracks and individually revokes owned URLs", () => {
    const revokeObjectURL = vi.fn();
    const registry = createObjectUrlRegistry({
      createObjectURL: vi.fn(() => "blob:one"),
      revokeObjectURL
    });

    const url = registry.create(new Blob(["preview"]));
    expect(registry.activeCount()).toBe(1);
    registry.revoke(url);
    registry.revoke(url);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(registry.activeCount()).toBe(0);
  });

  it("revokes every remaining URL during panel teardown", () => {
    let sequence = 0;
    const revokeObjectURL = vi.fn();
    const registry = createObjectUrlRegistry({
      createObjectURL: vi.fn(() => `blob:${++sequence}`),
      revokeObjectURL
    });

    registry.create(new Blob(["source"]));
    registry.create(new Blob(["result"]));
    registry.create(new Blob(["history"]));
    registry.revokeAll();

    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(["blob:1", "blob:2", "blob:3"]);
    expect(registry.activeCount()).toBe(0);
  });
});
