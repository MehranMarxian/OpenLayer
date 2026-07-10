import { afterEach, describe, expect, it, vi } from "vitest";
import { ComfyClient, findImageOutput, findPromptIndex, readComfyModelNameList } from "../../src/comfy/comfyClient";

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
