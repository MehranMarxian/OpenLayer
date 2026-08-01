import { describe, expect, it } from "vitest";
import {
  aggregateCycles,
  deriveServerPhases,
  formatCycleLine,
  formatCyclesTable,
  LIVE_PHASE_IDS,
  summariseCycle,
  type LiveCycleSample
} from "../../src/ui/livePaintingTimings";

function sample(
  totalMs: number,
  phases: LiveCycleSample["phases"] = {},
  cycleIndex = 1
): LiveCycleSample {
  return {
    cycleIndex,
    kind: "live",
    totalMs,
    phases
  };
}

describe("live painting timing summaries", () => {
  it("keeps phase IDs in the order used by cycle output", () => {
    expect(LIVE_PHASE_IDS).toEqual([
      "capture.getPixels",
      "capture.toRgba",
      "capture.pngEncode",
      "upload.encodeBody",
      "upload.http",
      "submit.http",
      "server.queueWait",
      "server.execute",
      "poll.overshoot",
      "download.http",
      "paint"
    ]);
  });

  it("accounts only measured phases and preserves the exact total", () => {
    const summary = summariseCycle(sample(50, {
      "capture.getPixels": 10,
      "capture.toRgba": null,
      "capture.pngEncode": 0
    }));

    expect(summary.accountedMs).toBe(10);
    expect(summary.unaccountedMs).toBe(40);
    expect(summary.accountedMs + summary.unaccountedMs).toBe(summary.totalMs);
    expect(summary.overAccounted).toBe(false);
    expect(summary.phases["capture.toRgba"]).toBeNull();
  });

  it("flags overlapping marks and clamps negative unaccounted time", () => {
    const summary = summariseCycle(sample(10, {
      "capture.getPixels": 8,
      "capture.toRgba": 5
    }));

    expect(summary.accountedMs).toBe(13);
    expect(summary.unaccountedMs).toBe(0);
    expect(summary.overAccounted).toBe(true);
  });
});

describe("deriveServerPhases", () => {
  it("derives queue, execution, and polling durations from a real ComfyUI history fixture", () => {
    const messages = [
      ["execution_start", { prompt_id: "prompt-1", timestamp: 1785599882955 }],
      ["execution_cached", { nodes: [], prompt_id: "prompt-1", timestamp: 1785599882959 }],
      ["execution_success", { prompt_id: "prompt-1", timestamp: 1785599891059 }]
    ];

    expect(deriveServerPhases(1785599882823, 1785599891349, messages)).toEqual({
      queueWaitMs: 132,
      executeMs: 8104,
      pollOvershootMs: 290
    });
  });

  it("ignores unrelated completion events without crashing", () => {
    const messages = [
      ["execution_start", { timestamp: 110 }],
      ["execution_error", { exception_message: "cancelled" }],
      ["execution_interrupted", null],
      ["execution_success", { timestamp: 150 }]
    ];

    expect(deriveServerPhases(100, 170, messages)).toEqual({
      queueWaitMs: 10,
      executeMs: 40,
      pollOvershootMs: 20
    });
  });

  it.each([
    undefined,
    null,
    "not an array",
    {},
    [],
    [["execution_start", { timestamp: 110 }]],
    [["execution_start", { timestamp: "110" }], ["execution_success", { timestamp: 150 }]],
    [["execution_start"], ["execution_success", { timestamp: 150 }]],
    [null, 42, {}]
  ])("returns no measurements for absent or malformed messages %#", (messages) => {
    expect(deriveServerPhases(100, 170, messages)).toEqual({
      queueWaitMs: null,
      executeMs: null,
      pollOvershootMs: null
    });
  });

  it("turns clock-skewed durations into null without discarding valid durations", () => {
    const messages = [
      ["execution_start", { timestamp: 90 }],
      ["execution_success", { timestamp: 80 }]
    ];

    expect(deriveServerPhases(100, 70, messages)).toEqual({
      queueWaitMs: null,
      executeMs: null,
      pollOvershootMs: null
    });

    expect(deriveServerPhases(100, 140, [
      ["execution_start", { timestamp: 90 }],
      ["execution_success", { timestamp: 130 }]
    ])).toEqual({
      queueWaitMs: null,
      executeMs: 40,
      pollOvershootMs: 10
    });
  });
});

describe("aggregateCycles", () => {
  it("calculates odd medians and counts phases measured in only some cycles", () => {
    const aggregate = aggregateCycles([
      sample(10, { "capture.getPixels": 1, "capture.toRgba": 2 }, 1),
      sample(20, { "capture.getPixels": 3 }, 2),
      sample(30, { "capture.getPixels": 5, "capture.toRgba": 4 }, 3)
    ]);

    expect(aggregate.totalMs).toEqual({ median: 20, p90: 30, count: 3 });
    expect(aggregate.phases["capture.getPixels"]).toEqual({ median: 3, p90: 5, count: 3 });
    expect(aggregate.phases["capture.toRgba"]).toEqual({ median: 3, p90: 4, count: 2 });
    expect(aggregate.phases["capture.pngEncode"]).toEqual({ median: null, p90: null, count: 0 });
  });

  it("averages the middle pair for even medians", () => {
    const aggregate = aggregateCycles([
      sample(40),
      sample(10),
      sample(30),
      sample(20)
    ]);

    expect(aggregate.totalMs).toEqual({ median: 25, p90: 40, count: 4 });
  });
});

describe("live painting timing formatters", () => {
  it("renders measured zero separately from an unmeasured phase in a cycle line", () => {
    const line = formatCycleLine(sample(5, {
      "capture.getPixels": 0,
      "capture.toRgba": null
    }));

    expect(line).toContain("capture.getPixels 0ms");
    expect(line).toContain("capture.toRgba not reported");
    expect(line).not.toContain("capture.getPixels not reported");
    expect(line).not.toContain("capture.toRgba 0ms");
    expect(line.split("\n")).toHaveLength(1);
  });

  it("creates a tab-separated multi-line table without conflating zero and missing data", () => {
    const table = formatCyclesTable([
      {
        ...sample(5, { "capture.getPixels": 0, "capture.toRgba": null }),
        captureMode: "non-modal-scaled",
        width: 512,
        height: 256
      },
      sample(8, {}, 2)
    ]);
    const [headers, firstRow, secondRow] = table.split("\n").map((line) => line.split("\t"));
    const getPixelsIndex = headers.indexOf("capture.getPixels");
    const toRgbaIndex = headers.indexOf("capture.toRgba");

    expect(table.split("\n")).toHaveLength(3);
    expect(firstRow[getPixelsIndex]).toBe("0ms");
    expect(firstRow[toRgbaIndex]).toBe("not reported");
    expect(secondRow[getPixelsIndex]).toBe("not reported");
    expect(firstRow.slice(getPixelsIndex, getPixelsIndex + LIVE_PHASE_IDS.length)).toHaveLength(
      LIVE_PHASE_IDS.length
    );
  });
});
