import { describe, expect, it, vi } from "vitest";
import {
  DownloadDestination,
  DownloadProgress,
  downloadModelFile,
  formatBytesForDownload,
  formatDownloadProgress,
  parseTotalFromContentRange
} from "../../src/comfy/modelDownload";

function memoryDestination(startingBytes = 0) {
  const state = { bytes: startingBytes, discarded: 0, writes: [] as number[] };
  const destination: DownloadDestination = {
    existingBytes: async () => state.bytes,
    append: async (chunk) => {
      state.writes.push(chunk.byteLength);
      state.bytes += chunk.byteLength;
    },
    discard: async () => {
      state.discarded += 1;
      state.bytes = 0;
    }
  };

  return { destination, state };
}

// Serves a file of `total` bytes, honouring Range the way HuggingFace does.
function rangeServer(total: number) {
  const calls: string[] = [];
  const serverFetch = (async (_url: string, init?: { headers?: Record<string, string> }) => {
    const header = init?.headers?.Range ?? "";
    calls.push(header);
    const match = /bytes=(\d+)-(\d+)/.exec(header)!;
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), total - 1);

    if (start >= total) {
      return { status: 416, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    }

    return {
      status: 206,
      headers: { get: (name: string) => (name === "content-range" ? `bytes ${start}-${end}/${total}` : null) },
      arrayBuffer: async () => new ArrayBuffer(end - start + 1)
    };
  }) as unknown as typeof fetch;

  return { serverFetch, calls };
}

describe("chunked model download", () => {
  it("downloads a file in bounded chunks rather than one response", async () => {
    const { destination, state } = memoryDestination();
    const { serverFetch, calls } = rangeServer(1000);

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 400 },
      { fetch: serverFetch, destination }
    );

    expect(outcome).toEqual({ kind: "completed", totalBytes: 1000, resumedFromBytes: 0 });
    expect(calls).toEqual(["bytes=0-399", "bytes=400-799", "bytes=800-999"]);
    expect(state.writes).toEqual([400, 400, 200]);
  });

  it("resumes from the bytes already on disk instead of starting over", async () => {
    const { destination, state } = memoryDestination(800);
    const { serverFetch, calls } = rangeServer(1000);

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 400 },
      { fetch: serverFetch, destination }
    );

    expect(calls).toEqual(["bytes=800-999"]);
    expect(outcome).toEqual({ kind: "completed", totalBytes: 1000, resumedFromBytes: 800 });
    expect(state.writes).toEqual([200]);
  });

  it("does nothing when the file is already complete", async () => {
    const { destination } = memoryDestination(1000);
    const { serverFetch, calls } = rangeServer(1000);

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000 },
      { fetch: serverFetch, destination }
    );

    expect(calls).toEqual([]);
    expect(outcome.kind).toBe("completed");
  });

  // A file bigger than the finished model is not a resume point; it is a
  // different file wearing the same name.
  it("discards an oversized partial file and starts again", async () => {
    const { destination, state } = memoryDestination(5000);
    const { serverFetch } = rangeServer(1000);

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 1000 },
      { fetch: serverFetch, destination }
    );

    expect(state.discarded).toBe(1);
    expect(outcome).toEqual({ kind: "completed", totalBytes: 1000, resumedFromBytes: 0 });
  });

  it("learns the total from Content-Range when the registry publishes no size", async () => {
    const { destination } = memoryDestination();
    const { serverFetch } = rangeServer(900);

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: null, chunkBytes: 500 },
      { fetch: serverFetch, destination }
    );

    expect(outcome).toEqual({ kind: "completed", totalBytes: 900, resumedFromBytes: 0 });
  });
});

describe("download refusals", () => {
  // Reading a 200 body would defeat the whole bounded-memory design.
  it("refuses a server that ignores Range and sends the whole file", async () => {
    const { destination } = memoryDestination();
    const wholeFile = (async () => ({
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(1000)
    })) as unknown as typeof fetch;

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000 },
      { fetch: wholeFile, destination }
    );

    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.reason).toContain("whole file at once");
  });

  it("explains a 403 as a licence gate rather than a bug", async () => {
    const { destination } = memoryDestination();
    const refused = (async () => ({
      status: 403,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0)
    })) as unknown as typeof fetch;

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000 },
      { fetch: refused, destination }
    );

    expect(outcome.kind === "failed" && outcome.reason).toContain("licence-gated");
  });

  it("stops instead of looping when the server returns an empty chunk", async () => {
    const { destination } = memoryDestination();
    const empty = (async () => ({
      status: 206,
      headers: { get: () => "bytes 0-0/1000" },
      arrayBuffer: async () => new ArrayBuffer(0)
    })) as unknown as typeof fetch;

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 100 },
      { fetch: empty, destination }
    );

    expect(outcome.kind === "failed" && outcome.reason).toContain("empty chunk");
  });

  it("reports a short download rather than declaring success", async () => {
    const { destination } = memoryDestination();
    const { serverFetch } = rangeServer(600);

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 1000 },
      { fetch: serverFetch, destination }
    );

    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.reason).toContain("incomplete or the source changed");
  });

  it("keeps the partial file's byte count on a network failure so it can resume", async () => {
    const { destination } = memoryDestination(400);
    const dropped = (async () => {
      throw new Error("socket hang up");
    }) as unknown as typeof fetch;

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000 },
      { fetch: dropped, destination }
    );

    expect(outcome).toEqual({ kind: "failed", reason: expect.stringContaining("socket hang up"), receivedBytes: 400 });
  });
});

describe("cancellation", () => {
  it("stops between chunks and reports what it already has", async () => {
    const { destination } = memoryDestination();
    const { serverFetch, calls } = rangeServer(1000);
    let chunks = 0;

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 200 },
      { fetch: serverFetch, destination, isCancelled: () => chunks++ >= 2 }
    );

    expect(outcome).toEqual({ kind: "cancelled", receivedBytes: 400 });
    expect(calls).toHaveLength(2);
  });
});

describe("progress reporting", () => {
  it("reports monotonically increasing bytes with a fraction", async () => {
    const { destination } = memoryDestination();
    const { serverFetch } = rangeServer(1000);
    const seen: DownloadProgress[] = [];

    await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 500 },
      { fetch: serverFetch, destination, onProgress: (progress) => seen.push(progress) }
    );

    expect(seen.map((entry) => entry.receivedBytes)).toEqual([0, 500, 1000]);
    expect(seen[seen.length - 1].fraction).toBe(1);
  });

  // Same rule as formatBytes(0): an unmeasured total must never render as a
  // confident percentage.
  it("reports a null fraction, not zero, when the total is unknown", async () => {
    const { destination } = memoryDestination();
    const noRange = (async () => ({
      status: 206,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(100)
    })) as unknown as typeof fetch;
    const seen: DownloadProgress[] = [];

    await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: null, chunkBytes: 100 },
      {
        fetch: noRange,
        destination,
        onProgress: (progress) => seen.push(progress),
        isCancelled: () => seen.length > 2
      }
    );

    expect(seen[0].fraction).toBeNull();
    expect(formatDownloadProgress(seen[1])).toContain("downloaded");
    expect(formatDownloadProgress(seen[1])).not.toContain("%");
  });

  it("mentions the resume point so a resumed download does not look like a fresh one", () => {
    const text = formatDownloadProgress({
      receivedBytes: 900,
      totalBytes: 1000,
      fraction: 0.9,
      resumedFromBytes: 500
    });

    expect(text).toContain("90%");
    expect(text).toContain("resumed from");
  });
});

describe("byte formatting", () => {
  it("says 0 B rather than unknown, because a download that received nothing did measure it", () => {
    expect(formatBytesForDownload(0)).toBe("0 B");
  });

  it("scales to sensible units", () => {
    expect(formatBytesForDownload(512)).toBe("512 B");
    expect(formatBytesForDownload(2502139104)).toBe("2.3 GiB");
    expect(formatBytesForDownload(20082414560)).toBe("18.7 GiB");
  });

  it("says unknown for nonsense", () => {
    expect(formatBytesForDownload(-1)).toBe("unknown");
    expect(formatBytesForDownload(Number.NaN)).toBe("unknown");
  });
});

describe("content-range parsing", () => {
  it("reads the total from a well-formed header", () => {
    expect(parseTotalFromContentRange("bytes 0-8388607/2502139104")).toBe(2502139104);
  });

  it("returns null for headers it cannot trust", () => {
    expect(parseTotalFromContentRange(null)).toBeNull();
    expect(parseTotalFromContentRange("bytes 0-100/*")).toBeNull();
    expect(parseTotalFromContentRange("nonsense")).toBeNull();
  });
});

describe("guard rails", () => {
  it("refuses a nonsense chunk size instead of looping forever", async () => {
    const { destination } = memoryDestination();
    const never = vi.fn();

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 0 },
      { fetch: never as unknown as typeof fetch, destination }
    );

    expect(outcome.kind).toBe("failed");
    expect(never).not.toHaveBeenCalled();
  });
});
