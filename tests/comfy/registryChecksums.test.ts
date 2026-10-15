import { describe, expect, it } from "vitest";
import { WORKFLOW_PRESETS } from "../../src/comfy/presetRegistry";
import { describeDownloadVerification } from "../../src/ui/setupInstallModel";

function downloadableModels() {
  const byUrl = new Map<string, { modelName: string; sha256?: string; downloadSizeBytes?: number; layout?: string }>();

  for (const preset of Object.values(WORKFLOW_PRESETS)) {
    for (const model of preset.requiredModels ?? []) {
      if (model.downloadUrl) {
        byUrl.set(model.downloadUrl, {
          modelName: model.modelName,
          sha256: model.sha256,
          downloadSizeBytes: model.downloadSizeBytes,
          layout: model.downloadLayout
        });
      }
    }
  }

  return [...byUrl.entries()];
}

describe("registry checksums", () => {
  it("records a SHA-256 and a size for every single-file Hugging Face download", () => {
    const missing = downloadableModels()
      .filter(([url, model]) => url.includes("huggingface.co") && model.layout !== "repo-folder")
      .filter(([, model]) => !model.sha256 || model.downloadSizeBytes === undefined)
      .map(([, model]) => model.modelName);

    // A new entry needs both, read from the same HEAD request: the
    // X-Linked-Etag and X-Linked-Size of /resolve/main/<file> without following
    // the redirect. Without them a download cannot tell a re-uploaded file
    // from the one OpenLayer was tested with.
    expect(missing).toEqual([]);
  });

  it("stores every hash as 64 lowercase hex characters", () => {
    for (const [, model] of downloadableModels()) {
      if (model.sha256 !== undefined) {
        expect(model.sha256, model.modelName).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });

  it("records the current flux2-vae.safetensors, which upstream re-uploaded at a new size", () => {
    const vae = downloadableModels().find(([, model]) => model.modelName === "flux2-vae.safetensors")?.[1];

    expect(vae?.downloadSizeBytes).toBe(336213556);
    expect(vae?.sha256).toBe("d64f3a68e1cc4f9f4e29b6e0da38a0204fe9a49f2d4053f0ec1fa1ca02f9c4b5");
  });
});

describe("how a finished download says it was checked", () => {
  it("names the checksum, the resumed size-only case, or nothing", () => {
    expect(describeDownloadVerification("sha256", true)).toContain("checksum Hugging Face publishes");
    expect(describeDownloadVerification("size", true)).toContain("only its size was checked");
    expect(describeDownloadVerification("size", false)).toBe("");
    expect(describeDownloadVerification("none", false)).toBe("");
  });
});
