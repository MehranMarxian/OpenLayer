import { describe, expect, it } from "vitest";
import {
  formatSpikeReport,
  PROBE_RANGE_BYTES,
  ProbeResult,
  runModelDownloadSpike,
  summarizeSpike
} from "../../src/ui/spikeModelDownload";

function result(id: string, status: ProbeResult["status"]): ProbeResult {
  return { id, question: id, status, detail: "" };
}

describe("spike verdict", () => {
  const allPassing = [
    result("arbitrary-path", "pass"),
    result("arbitrary-write", "pass"),
    result("fs-module", "pass"),
    result("append", "pass"),
    result("ranged-fetch", "pass")
  ];

  it("calls a direct downloader buildable only when placement, accumulation and chunking all work", () => {
    expect(summarizeSpike(allPassing)).toContain("FEASIBLE");
  });

  it("accepts fs as the accumulation route when append is unsupported", () => {
    const results = allPassing.map((entry) =>
      entry.id === "append" ? result("append", "unsupported") : entry
    );

    expect(summarizeSpike(results)).toContain("FEASIBLE");
  });

  it("blocks when neither append nor fs can grow a file, because the model would have to fit in memory", () => {
    const results = allPassing.map((entry) =>
      entry.id === "append" || entry.id === "fs-module"
        ? result(entry.id, "unsupported")
        : entry
    );

    expect(summarizeSpike(results)).toContain("BLOCKED");
    expect(summarizeSpike(results)).toContain("incrementally");
  });

  it("names a folder picker as the consequence when the path cannot be resolved unattended", () => {
    const results = allPassing.map((entry) =>
      entry.id === "arbitrary-path" ? result("arbitrary-path", "unsupported") : entry
    );

    expect(summarizeSpike(results)).toContain("folder picker");
  });

  it("reports every blocker at once rather than only the first", () => {
    const verdict = summarizeSpike([
      result("arbitrary-path", "fail"),
      result("arbitrary-write", "fail"),
      result("fs-module", "unsupported"),
      result("append", "fail"),
      result("ranged-fetch", "fail")
    ]);

    expect(verdict).toContain("folder picker");
    expect(verdict).toContain("incrementally");
    expect(verdict).toContain("ranged download");
  });
});

describe("spike probe isolation", () => {
  // A spike that aborts on the first failure answers one question instead of
  // five, which defeats the point of running it.
  it("still reports the later probes when an early one throws", async () => {
    const results = await runModelDownloadSpike({
      loadUxp: () => {
        throw new Error("no uxp here");
      },
      loadFs: () => undefined,
      fetch: (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
      modelsFolderPath: "C:/nowhere"
    });

    expect(results).toHaveLength(5);
    expect(results.map((entry) => entry.id)).toEqual([
      "arbitrary-path",
      "arbitrary-write",
      "fs-module",
      "append",
      "ranged-fetch"
    ]);
    expect(results.every((entry) => entry.status !== "pass")).toBe(true);
  });

  it("records a thrown error as the detail instead of losing it", async () => {
    const results = await runModelDownloadSpike({
      loadUxp: () => {
        throw new Error("no uxp here");
      },
      loadFs: () => undefined,
      fetch: (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
      modelsFolderPath: "C:/nowhere"
    });

    expect(results[0].detail).toContain("no uxp here");
    expect(results[4].detail).toContain("offline");
  });

  it("fails the range probe when the server ignores the header and returns the whole file", async () => {
    const results = await runModelDownloadSpike({
      loadUxp: () => {
        throw new Error("unused");
      },
      loadFs: () => undefined,
      fetch: (async () => ({
        status: 200,
        headers: { get: () => "2502139104" },
        arrayBuffer: async () => new ArrayBuffer(0)
      })) as unknown as typeof fetch,
      modelsFolderPath: "C:/nowhere"
    });

    const range = results.find((entry) => entry.id === "ranged-fetch");
    expect(range?.status).toBe("fail");
    expect(range?.detail).toContain("206");
  });

  it("fails the range probe when a 206 arrives with the wrong number of bytes", async () => {
    const results = await runModelDownloadSpike({
      loadUxp: () => {
        throw new Error("unused");
      },
      loadFs: () => undefined,
      fetch: (async () => ({
        status: 206,
        headers: { get: () => null },
        arrayBuffer: async () => new ArrayBuffer(PROBE_RANGE_BYTES - 1)
      })) as unknown as typeof fetch,
      modelsFolderPath: "C:/nowhere"
    });

    expect(results.find((entry) => entry.id === "ranged-fetch")?.status).toBe("fail");
  });
});

describe("spike report formatting", () => {
  it("puts the status first so the outcome is readable without parsing the sentence", () => {
    const report = formatSpikeReport([
      { id: "a", question: "Can it?", status: "pass", detail: "Yes." }
    ]);

    expect(report).toContain("[PASS] Can it?");
    expect(report).toContain("Yes.");
  });
});
