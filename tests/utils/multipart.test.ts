import { describe, expect, it } from "vitest";
import {
  createMultipartBoundary,
  createMultipartRequestBody,
  encodeUtf8,
  sanitizeMultipartToken
} from "../../src/utils/multipart";

describe("multipart", () => {
  it("builds a multipart body with an explicit file filename and form fields", () => {
    const boundary = "----OpenLayerTestBoundary";
    const fileBytes = new Uint8Array([137, 80, 78, 71]);
    const body = createMultipartRequestBody(
      boundary,
      [
        {
          name: "image",
          filename: "OpenLayer_Inpaint_Source_20260711_0136.png",
          contentType: "image/png",
          data: fileBytes
        }
      ],
      [
        { name: "type", value: "input" },
        { name: "overwrite", value: "true" }
      ]
    );
    const text = new TextDecoder("latin1").decode(body);

    expect(text).toContain(
      'Content-Disposition: form-data; name="image"; filename="OpenLayer_Inpaint_Source_20260711_0136.png"'
    );
    expect(text).toContain("Content-Type: image/png");
    expect(text).toContain('Content-Disposition: form-data; name="type"\r\n\r\ninput\r\n');
    expect(text).toContain('Content-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n');
    expect(text.startsWith(`--${boundary}\r\n`)).toBe(true);
    expect(text.endsWith(`--${boundary}--\r\n`)).toBe(true);
  });

  it("keeps binary file bytes intact inside the multipart body", () => {
    const boundary = "----OpenLayerTestBoundary";
    const fileBytes = new Uint8Array([0, 255, 13, 10, 128]);
    const body = createMultipartRequestBody(
      boundary,
      [{ name: "image", filename: "a.png", contentType: "image/png", data: fileBytes }],
      []
    );

    // latin1 maps every byte to one character, so text offsets equal byte offsets.
    const text = new TextDecoder("latin1").decode(body);
    const payloadStart = text.indexOf("\r\n\r\n") + 4;

    expect(payloadStart).toBeGreaterThan(3);
    expect([...body.subarray(payloadStart, payloadStart + fileBytes.length)]).toEqual([...fileBytes]);
  });

  it("sanitizes quotes and line breaks out of multipart tokens", () => {
    expect(sanitizeMultipartToken('bad"name\r\n.png')).toBe("bad_name__.png");
  });

  it("encodes text as UTF-8 without relying on TextEncoder", () => {
    expect([...encodeUtf8("ab")]).toEqual([0x61, 0x62]);
    expect([...encodeUtf8("café")]).toEqual([...new TextEncoder().encode("café")]);
    expect([...encodeUtf8("画像🎨")]).toEqual([...new TextEncoder().encode("画像🎨")]);
  });

  it("creates unique-looking boundaries", () => {
    const first = createMultipartBoundary();
    const second = createMultipartBoundary();

    expect(first.startsWith("----OpenLayerFormBoundary")).toBe(true);
    expect(first).not.toBe(second);
  });
});
