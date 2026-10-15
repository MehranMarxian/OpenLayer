import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComfyClient } from "../../src/comfy/comfyClient";
import {
  explainWorkflowRejection,
  isExplainedRejection,
  markExplainedRejection,
  parseComfyRejectionBody
} from "../../src/comfy/workflowRejection";
import { getFriendlyImageToImageErrorMessage, getImageToImageFailureHint } from "../../src/ui/toolErrorMessages";
import { createOpenLayerError } from "../../src/utils/errors";

/**
 * Every body here is a real ComfyUI 0.37.0 answer to POST /prompt, captured
 * from a live server with graphs that fail validation (so nothing was queued).
 * Lists of the capturing machine's model and LoRA files were replaced with
 * placeholder names; the structure is ComfyUI's own.
 */
function fixture(name: string) {
  const recorded = JSON.parse(readFileSync(`tests/fixtures/comfy-rejections/${name}.json`, "utf8")) as {
    status: number;
    body: unknown;
  };
  return { status: recorded.status, text: JSON.stringify(recorded.body) };
}

function explain(name: string) {
  const explanation = explainWorkflowRejection(parseComfyRejectionBody(fixture(name).text));
  expect(explanation, name).not.toBeNull();
  return explanation!;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("explainWorkflowRejection on real ComfyUI rejections", () => {
  it("names the missing checkpoint and the folder it was looked for in", () => {
    const { message, missingModels } = explain("checkpoint-not-in-list");

    expect(message).toBe(
      "The model not-on-disk.safetensors is not in ComfyUI's models/checkpoints/ folder, which is where CheckpointLoaderSimple looks."
    );
    expect(missingModels).toEqual([
      { loaderNode: "CheckpointLoaderSimple", inputName: "ckpt_name", modelName: "not-on-disk.safetensors" }
    ]);
  });

  it("names the diffusion_models folder for a UNETLoader file, even when ComfyUI only says 'list of length 29'", () => {
    expect(explain("unet-in-checkpoints-folder").message).toContain("models/diffusion_models/ folder");
  });

  it("names a missing LoRA and the loras folder", () => {
    expect(explain("lora-not-in-list").message).toBe(
      "The LoRA missing-style.safetensors is not in ComfyUI's models/loras/ folder."
    );
  });

  it("says which node is missing and how to install it", () => {
    expect(explain("missing-node-class").message).toContain(
      "ComfyUI does not have the OpenLayerNoSuchNode node. Its custom node pack is not installed"
    );
  });

  it("names the custom node pack when OpenLayer knows which one provides the node", () => {
    const explanation = explainWorkflowRejection({
      error: { type: "missing_node_type", extra_info: { class_type: "InpaintCropImproved" } }
    });

    expect(explanation?.message).toContain("comfyui-inpaint-cropandstitch");
    expect(explanation?.message).toContain("ComfyUI-Manager");
  });

  it("explains an unset input, a value out of range, and a graph with no output", () => {
    expect(explain("missing-required-input").message).toBe(
      "The workflow leaves seed unset on KSampler (node 5). If this is your own workflow, connect it in ComfyUI and export it again."
    );
    expect(explain("value-out-of-range").message).toBe(
      "EmptyLatentImage cannot use width = 2: Value 2 smaller than min of 16."
    );
    expect(explain("no-output-node").message).toContain("no output node");
  });

  it("writes plain text, because the status bar renders it with textContent", () => {
    for (const name of [
      "checkpoint-not-in-list",
      "unet-in-checkpoints-folder",
      "lora-not-in-list",
      "missing-node-class",
      "missing-required-input",
      "value-out-of-range",
      "no-output-node"
    ]) {
      expect(explain(name).message, name).not.toMatch(/`|--|\{|"error"/);
    }
  });

  it("spells out two problems and counts the rest", () => {
    const node = (id: number) => ({
      class_type: "KSampler",
      errors: [{ type: "required_input_missing", details: `input${id}`, extra_info: { input_name: `input${id}` } }]
    });
    const explanation = explainWorkflowRejection({ node_errors: { 1: node(1), 2: node(2), 3: node(3), 4: node(4) } });

    expect(explanation?.message).toMatch(/input1.*input2.* 2 more problems in diagnostics\.$/);
  });

  it("returns nothing for a body it cannot read, so the caller keeps the HTTP status", () => {
    expect(explainWorkflowRejection(parseComfyRejectionBody("<html>502 Bad Gateway</html>"))).toBeNull();
    expect(explainWorkflowRejection(parseComfyRejectionBody("{}"))).toBeNull();
  });
});

describe("ComfyClient.submitPrompt explains a rejection", () => {
  function stubComfy(rejection: { status: number; text: string }, checkpoints: string[]) {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/prompt")) {
        return new Response(rejection.text, { status: rejection.status });
      }

      if (url.includes("/object_info/CheckpointLoaderSimple")) {
        return new Response(
          JSON.stringify({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [checkpoints] } } } })
        );
      }

      return new Response("{}");
    });
  }

  it("adds where the model actually is when it sits in the wrong folder", async () => {
    stubComfy(fixture("unet-in-checkpoints-folder"), ["epicrealism_naturalSinRC1VAE.safetensors"]);

    const error = await new ComfyClient("http://127.0.0.1:8188").submitPrompt({}).catch((caught: unknown) => caught);

    expect(isExplainedRejection(error)).toBe(true);
    expect((error as Error).message).toBe(
      "The model epicrealism_naturalSinRC1VAE.safetensors is not in ComfyUI's models/diffusion_models/ folder, which is where UNETLoader looks. " +
        "Found epicrealism_naturalSinRC1VAE.safetensors in models/checkpoints/, but this workflow reads it from models/diffusion_models/. Move the file, then refresh ComfyUI."
    );
    // The raw body stays available for Copy Diagnostics.
    expect((error as { technicalDetails?: string }).technicalDetails).toContain("value_not_in_list");
  });

  it("does not claim a wrong folder when the file is nowhere", async () => {
    stubComfy(fixture("checkpoint-not-in-list"), ["something-else.safetensors"]);

    const error = await new ComfyClient("http://127.0.0.1:8188").submitPrompt({}).catch((caught: unknown) => caught);

    expect((error as Error).message).not.toContain("Found");
  });

  it("keeps the old message for a body it cannot explain", async () => {
    stubComfy({ status: 502, text: "<html>Bad Gateway</html>" }, []);

    const error = await new ComfyClient("http://127.0.0.1:8188").submitPrompt({}).catch((caught: unknown) => caught);

    expect((error as Error).message).toBe("ComfyUI rejected the workflow with HTTP 502.");
    expect(isExplainedRejection(error)).toBe(false);
  });
});

describe("tool messages pass an explained rejection through", () => {
  it("keeps the precise sentence instead of a keyword-matched generic one", () => {
    // Raw details containing "loader" used to turn this into
    // "ComfyUI rejected this workflow for the selected checkpoint."
    const explained = markExplainedRejection(
      createOpenLayerError(
        "COMFY_REJECTED_WORKFLOW",
        "The model x.safetensors is not in ComfyUI's models/checkpoints/ folder, which is where CheckpointLoaderSimple looks.",
        '{"node_errors": {"1": {"class_type": "CheckpointLoaderSimple"}}}'
      )
    );

    expect(getFriendlyImageToImageErrorMessage(explained)).toContain("models/checkpoints/");
    expect(getImageToImageFailureHint(explained)).toContain("models/checkpoints/");
  });
});
