import { describe, expect, it, vi } from "vitest";
import { resolveModelSubfolder } from "../../src/photoshop/modelSubfolder";

// A stand-in for a UXP Folder: a name, its child folders, and whether it may
// create one. UXP's getEntry throws for a name that is not there.
function folder(name: string, children: Record<string, unknown> = {}, canCreate = false) {
  return {
    name,
    isFolder: true,
    nativePath: `C:\\ComfyUI\\${name}`,
    getEntry: vi.fn(async (child: string) => {
      if (child in children) return children[child];
      throw new Error(`${child} not found`);
    }),
    createFolder: canCreate ? vi.fn(async (child: string) => ({ name: child, isFolder: true })) : undefined
  };
}

describe("resolveModelSubfolder", () => {
  it("uses the folder itself when it is the right model folder", async () => {
    const vae = folder("vae");

    expect(await resolveModelSubfolder(vae, "vae")).toEqual({ kind: "use", folder: vae, note: null });
  });

  it("uses the right folder inside ComfyUI's models folder, so one grant serves every download", async () => {
    const vae = { name: "vae", isFolder: true };
    const encoders = { name: "text_encoders", isFolder: true };
    const models = folder("models", { vae, text_encoders: encoders });

    expect(await resolveModelSubfolder(models, "vae")).toEqual({ kind: "use", folder: vae, note: null });
    expect(await resolveModelSubfolder(models, "text_encoders")).toEqual({ kind: "use", folder: encoders, note: null });
  });

  it("creates the folder inside models when ComfyUI has not yet", async () => {
    const models = folder("models", {}, true);
    const resolution = await resolveModelSubfolder(models, "diffusion_models");

    expect(models.createFolder).toHaveBeenCalledWith("diffusion_models");
    expect(resolution).toEqual({ kind: "use", folder: { name: "diffusion_models", isFolder: true }, note: null });
  });

  it("refuses a different model folder rather than putting a VAE among the upscalers", async () => {
    // The bug this exists for: the remembered grant was upscale_models.
    const resolution = await resolveModelSubfolder(folder("upscale_models"), "vae");

    expect(resolution.kind).toBe("wrong-folder");
    expect(resolution.kind === "wrong-folder" && resolution.note).toContain("Choose ComfyUI's models folder");
  });

  it("still uses an unfamiliar folder, with the warning, for extra_model_paths layouts", async () => {
    const custom = folder("my-shared-vaes");
    const resolution = await resolveModelSubfolder(custom, "vae");

    expect(resolution.kind).toBe("use");
    expect(resolution.kind === "use" && resolution.folder).toBe(custom);
    expect(resolution.kind === "use" && resolution.note).toContain('does not end in "vae"');
  });

  it("does not mistake a file of the same name for the folder", async () => {
    const models = folder("models", { vae: { name: "vae", isFolder: false } });
    const resolution = await resolveModelSubfolder(models, "vae");

    // No child folder and no permission to create one: the warning path.
    expect(resolution.kind === "use" && resolution.folder).toBe(models);
  });

  it("reads the name from the native path when the entry has none, case-insensitively", async () => {
    const entry = { nativePath: "D:\\AI\\ComfyUI\\models\\VAE\\" };

    expect(await resolveModelSubfolder(entry, "vae")).toEqual({ kind: "use", folder: entry, note: null });
  });
});
