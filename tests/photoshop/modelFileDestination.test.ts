import { describe, expect, it, vi } from "vitest";
import {
  createFolderDestination,
  partialFileName,
  UxpFileLike,
  UxpFolderLike
} from "../../src/photoshop/modelFileDestination";

// A folder in memory with UXP's shapes: createFile, getEntry, and an entry
// whose moveTo renames it.
function memoryFolder(nativePath = "C:/ComfyUI/models/checkpoints") {
  const files = new Map<string, number[]>();

  const entryFor = (name: string): UxpFileLike => ({
    write: vi.fn(async (data: ArrayBuffer, options: Record<string, unknown>) => {
      const existing = options.append ? files.get(name) ?? [] : [];
      files.set(name, [...existing, ...new Uint8Array(data)]);
    }),
    delete: vi.fn(async () => {
      files.delete(name);
    }),
    moveTo: vi.fn(async (_folder: UxpFolderLike, options: { newName: string; overwrite: boolean }) => {
      files.set(options.newName, files.get(name) ?? []);
      files.delete(name);
    })
  });

  const folder: UxpFolderLike = {
    nativePath,
    createFile: vi.fn(async (name: string) => {
      files.set(name, []);
      return entryFor(name);
    }),
    getEntry: vi.fn(async (name: string) => (files.has(name) ? entryFor(name) : null))
  };

  return { folder, files };
}

describe("model file destination", () => {
  it("writes to a .part file that ComfyUI never lists", async () => {
    const { folder, files } = memoryFolder();
    const destination = createFolderDestination({ folder, fileName: "model.safetensors", binaryFormat: "binary" });

    await destination.existingBytes();
    await destination.append(new Uint8Array([1, 2, 3]).buffer);

    expect([...files.keys()]).toEqual(["model.safetensors.part"]);
    expect(partialFileName("model.safetensors")).toBe("model.safetensors.part");
  });

  it("gives the file the model's name only when finalized, with every byte", async () => {
    const { folder, files } = memoryFolder();
    const destination = createFolderDestination({ folder, fileName: "model.safetensors", binaryFormat: "binary" });

    await destination.existingBytes();
    await destination.append(new Uint8Array([1, 2]).buffer);
    await destination.append(new Uint8Array([3]).buffer);
    await destination.finalize();

    expect([...files.keys()]).toEqual(["model.safetensors"]);
    expect(files.get("model.safetensors")).toEqual([1, 2, 3]);
  });

  it("measures the partial file, not the finished name, when resuming", async () => {
    const { folder } = memoryFolder("C:/ComfyUI/models/checkpoints");
    const statSize = vi.fn(async () => 42);
    const destination = createFolderDestination({
      folder,
      fileName: "model.safetensors",
      binaryFormat: "binary",
      statSize
    });

    await expect(destination.existingBytes()).resolves.toBe(42);
    expect(statSize).toHaveBeenCalledWith("C:/ComfyUI/models/checkpoints/model.safetensors.part");
  });

  it("says what to do by hand when the host cannot rename", async () => {
    const { folder } = memoryFolder();
    const createFile = folder.createFile;
    folder.createFile = async (name, options) => {
      const entry = await createFile(name, options);
      return { write: entry.write, delete: entry.delete };
    };
    const destination = createFolderDestination({ folder, fileName: "model.safetensors", binaryFormat: "binary" });

    await destination.append(new Uint8Array([1]).buffer);

    await expect(destination.finalize()).rejects.toThrow("Rename it to model.safetensors by hand");
  });
});
