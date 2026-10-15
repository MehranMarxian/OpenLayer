import { describe, expect, it } from "vitest";

// @ts-expect-error -- bridge/ is plain .mjs and sits outside the tsconfig `include`.
import { describeOrigin, judgeOrigin } from "../../bridge/src/originPolicy.mjs";

describe("Agent Bridge hub origin policy", () => {
  it("allows a handshake with no Origin, which is how the MCP agent connects", () => {
    expect(judgeOrigin(undefined)).toEqual({ allowed: true });
    expect(judgeOrigin("")).toEqual({ allowed: true });
  });

  it("refuses any web page, wherever it is served from", () => {
    for (const origin of [
      "https://evil.example",
      "http://evil.example:8080",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "HTTPS://Mixed.Case.Example"
    ]) {
      expect(judgeOrigin(origin), origin).toMatchObject({ allowed: false });
    }
  });

  it("refuses the opaque origin a sandboxed iframe or file page sends", () => {
    expect(judgeOrigin("null")).toMatchObject({ allowed: false });
    expect(judgeOrigin(" NULL ")).toMatchObject({ allowed: false });
  });

  it("allows origins no web page can produce", () => {
    expect(judgeOrigin("plugin://openlayer")).toEqual({ allowed: true });
    expect(judgeOrigin("uxp://1e827d3d")).toEqual({ allowed: true });
    expect(judgeOrigin("not a url")).toEqual({ allowed: true });
  });

  it("names the refused page in the reason, for the hub log", () => {
    const verdict = judgeOrigin("https://evil.example");

    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false && verdict.reason).toContain("https://evil.example");
    expect(describeOrigin(undefined)).toBe("no Origin header");
    expect(describeOrigin("uxp://x")).toBe("Origin uxp://x");
  });
});
