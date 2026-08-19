import { afterEach, describe, expect, it, vi } from "vitest";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import {
  ComfyClient,
  findImageOutput,
  findPromptIndex,
  readComfyModelNameList,
  readComfyProgress
} from "../../src/comfy/comfyClient";

describe("ComfyClient output selection", () => {
  it("uses the preferred SaveImage node instead of the first history image", () => {
    const image = findImageOutput(
      {
        outputs: {
          "12": {
            images: [
              {
                filename: "uploaded-mask-preview.png",
                type: "input"
              }
            ]
          },
          "9": {
            images: [
              {
                filename: "OpenLayer_Flux_Inpaint_00001.png",
                type: "output"
              }
            ]
          }
        }
      },
      "9"
    );

    expect(image?.filename).toBe("OpenLayer_Flux_Inpaint_00001.png");
  });

  it("returns null when the expected SaveImage node has no image", () => {
    const image = findImageOutput(
      {
        outputs: {
          "12": {
            images: [
              {
                filename: "uploaded-mask-preview.png",
                type: "input"
              }
            ]
          }
        }
      },
      "9"
    );

    expect(image).toBeNull();
  });
});

describe("ComfyClient image upload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads with an explicit multipart filename instead of relying on FormData", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ name: "OpenLayer_Inpaint_Source_20260711_0136.png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    const client = new ComfyClient("http://127.0.0.1:8190");
    const uploadedName = await client.uploadImage(
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
      "OpenLayer_Inpaint_Source_20260711_0136.png"
    );

    expect(uploadedName).toBe("OpenLayer_Inpaint_Source_20260711_0136.png");
    expect(capturedUrl).toBe("http://127.0.0.1:8190/upload/image");

    const contentType = (capturedInit?.headers as Record<string, string>)["Content-Type"];
    expect(contentType).toContain("multipart/form-data; boundary=");

    const bodyText = new TextDecoder("latin1").decode(capturedInit?.body as ArrayBuffer);
    expect(bodyText).toContain('filename="OpenLayer_Inpaint_Source_20260711_0136.png"');
    expect(bodyText).toContain('name="overwrite"\r\n\r\ntrue');
  });

  it("prefixes the returned name with the server-reported subfolder", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ name: "source.png", subfolder: "openlayer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const client = new ComfyClient("http://127.0.0.1:8190");
    const uploadedName = await client.uploadImage(
      new Blob([new Uint8Array([1])], { type: "image/png" }),
      "source.png"
    );

    expect(uploadedName).toBe("openlayer/source.png");
  });
});

describe("ComfyClient live progress parsing", () => {
  it("reads the classic progress message value and max", () => {
    expect(
      readComfyProgress({ type: "progress", data: { value: 5, max: 20, node: "3" } })
    ).toEqual({ value: 5, max: 20, percent: 25 });
  });

  it("reads step progress from the newer progress_state nodes", () => {
    const progress = readComfyProgress({
      type: "progress_state",
      data: {
        prompt_id: "abc",
        nodes: {
          "4": { value: 0, max: 1, state: "finished" },
          "3": { value: 18, max: 20, state: "running" }
        }
      }
    });

    expect(progress).toEqual({ value: 18, max: 20, percent: 90 });
  });

  it("ignores single-step node markers that would report a bogus 0 percent", () => {
    expect(
      readComfyProgress({ type: "progress_state", data: { nodes: { "4": { value: 0, max: 1 } } } })
    ).toBeNull();
    expect(readComfyProgress({ type: "progress", data: {} })).toBeNull();
  });
});

describe("ComfyClient queue prompt matching", () => {
  it("matches queue entries by the prompt id tuple field", () => {
    const entries = [
      [0, "prompt-aaa", {}, {}, []],
      [1, "prompt-bbb", {}, {}, []]
    ];

    expect(findPromptIndex(entries, "prompt-bbb")).toBe(1);
    expect(findPromptIndex(entries, "prompt-zzz")).toBe(-1);
  });

  it("does not match a prompt id that only appears inside another entry's payload", () => {
    const entries = [
      [0, "prompt-aaa", { previousPromptId: "prompt-bbb" }, {}, []],
      [1, "prompt-bbb", {}, {}, []]
    ];

    expect(findPromptIndex(entries, "prompt-bbb")).toBe(1);
  });

  it("falls back to substring matching for unknown queue entry shapes", () => {
    const entries = [{ prompt_id: "prompt-ccc" }];

    expect(findPromptIndex(entries, "prompt-ccc")).toBe(0);
    expect(findPromptIndex(undefined, "prompt-ccc")).toBe(-1);
  });
});

describe("ComfyClient object_info model parsing", () => {
  it("reads newer COMBO option lists from ComfyUI object_info", () => {
    const names = readComfyModelNameList(
      {
        UpscaleModelLoader: {
          input: {
            required: {
              model_name: [
                "COMBO",
                {
                  multiselect: false,
                  options: ["4x-UltraSharp.pth"]
                }
              ]
            }
          }
        }
      },
      "UpscaleModelLoader",
      "model_name"
    );

    expect(names).toEqual(["4x-UltraSharp.pth"]);
  });

  it("keeps reading older direct array object_info lists", () => {
    const names = readComfyModelNameList(
      {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [["model-a.safetensors", "model-b.safetensors"]]
            }
          }
        }
      },
      "CheckpointLoaderSimple",
      "ckpt_name"
    );

    expect(names).toEqual(["model-a.safetensors", "model-b.safetensors"]);
  });
});

describe("ComfyClient preset setup validation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Serves an /object_info reply built from the preset's own requirements, but
   * moves the named inputs into ComfyUI's `optional` bucket — which is where
   * InpaintCropImproved really declares `mask`.
   */
  function stubObjectInfo(presetId: string, optionalInputs: Record<string, string[]>) {
    const preset = getWorkflowPreset(presetId);

    vi.stubGlobal("fetch", async (url: string) => {
      const classType = String(url).split("/object_info/")[1] ?? "";
      const requirement = preset.requiredNodes.find((node) => node.classType === classType);
      const optional = optionalInputs[classType] ?? [];
      const body: Record<string, unknown> = {};

      if (requirement) {
        body[classType] = {
          input: {
            required: Object.fromEntries(
              requirement.requiredInputs
                .filter((name) => !optional.includes(name))
                .map((name) => [name, ["*"]])
            ),
            optional: Object.fromEntries(optional.map((name) => [name, ["*"]]))
          }
        };
      }

      // Every required model reads its name list off a loader node, so serve
      // the ones this preset asks for rather than failing on models.
      for (const model of preset.requiredModels ?? []) {
        if (model.objectInfoNode === classType) {
          const node = (body[classType] ??= { input: { required: {} } }) as {
            input: { required: Record<string, unknown> };
          };
          node.input.required[model.inputName] = [[model.modelName]];
        }
      }

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    return preset;
  }

  it("accepts an input the node declares optional rather than required", async () => {
    // The real defect this guards: InpaintCropImproved puts `mask` in
    // `input.optional`, so reading only `input.required` reported "ComfyUI is
    // missing setup" on a machine where the node pack was installed and the
    // graph ran fine. `requiredInputs` in the registry means "OpenLayer wires
    // this and depends on it", which is not ComfyUI's required/optional split.
    stubObjectInfo("inpaint-flux-fill-cropstitch", { InpaintCropImproved: ["mask"] });

    const client = new ComfyClient("http://127.0.0.1:8190");

    await expect(client.validatePresetSetup(getWorkflowPreset("inpaint-flux-fill-cropstitch")))
      .resolves.toBeTypeOf("object");
  });

  it("still reports an input the node does not declare at all", async () => {
    stubObjectInfo("inpaint-flux-fill-cropstitch", {});
    const preset = getWorkflowPreset("inpaint-flux-fill-cropstitch");
    const cropRequirement = preset.requiredNodes.find(
      (node) => node.classType === "InpaintCropImproved"
    );

    const client = new ComfyClient("http://127.0.0.1:8190");
    const probed = {
      ...preset,
      requiredNodes: preset.requiredNodes.map((node) =>
        node === cropRequirement
          ? { ...node, requiredInputs: [...node.requiredInputs, "not_a_real_input"] }
          : node
      )
    };

    // The summary names the preset; the actionable detail names the input.
    const failure = await client.validatePresetSetup(probed).catch((error: unknown) => error);

    expect(String((failure as { message?: string }).message)).toContain(
      "missing setup required by inpaint-flux-fill-cropstitch"
    );
    expect(JSON.stringify(failure)).toContain("not_a_real_input");
  });
});
