import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DownloadDestination, downloadModelFile } from "../../src/comfy/modelDownload";

// The same shapes as modelDownload.test.ts, plus finalize: the rename that
// gives a finished partial file the model's real name.
function memoryDestination(startingBytes = 0) {
  const state = { bytes: startingBytes, discarded: 0, finalized: 0 };
  const destination: DownloadDestination = {
    existingBytes: async () => state.bytes,
    append: async (chunk) => {
      state.bytes += chunk.byteLength;
    },
    discard: async () => {
      state.discarded += 1;
      state.bytes = 0;
    },
    finalize: async () => {
      state.finalized += 1;
    }
  };

  return { destination, state };
}

// Serves `total` zero bytes, honouring Range the way Hugging Face does.
function rangeServer(total: number) {
  return (async (_url: string, init?: { headers?: Record<string, string> }) => {
    const match = /bytes=(\d+)-(\d+)/.exec(init?.headers?.Range ?? "")!;
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
}

const sha256OfZeros = (length: number) => createHash("sha256").update(new Uint8Array(length)).digest("hex");

describe("a download only takes the model's name once it is complete and correct", () => {
  it("checks the SHA-256 and then renames the partial file", async () => {
    const { destination, state } = memoryDestination();

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, expectedSha256: sha256OfZeros(1000), chunkBytes: 300 },
      { fetch: rangeServer(1000), destination }
    );

    expect(outcome).toEqual({ kind: "completed", totalBytes: 1000, resumedFromBytes: 0, verifiedBy: "sha256" });
    expect(state.finalized).toBe(1);
  });

  it("deletes a file whose hash is wrong instead of installing it", async () => {
    const { destination, state } = memoryDestination();

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, expectedSha256: "0".repeat(64), chunkBytes: 300 },
      { fetch: rangeServer(1000), destination }
    );

    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.reason).toContain("does not match the checksum");
    expect(state.finalized).toBe(0);
    expect(state.discarded).toBe(1);
  });

  it("accepts an uppercase hash from the registry", async () => {
    const { destination } = memoryDestination();

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 10, expectedSha256: sha256OfZeros(10).toUpperCase() },
      { fetch: rangeServer(10), destination }
    );

    expect(outcome).toMatchObject({ kind: "completed", verifiedBy: "sha256" });
  });

  it("falls back to the size check for a download resumed from an earlier session, and says so", async () => {
    const { destination, state } = memoryDestination(600);

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, expectedSha256: sha256OfZeros(1000), chunkBytes: 300 },
      { fetch: rangeServer(1000), destination }
    );

    expect(outcome).toEqual({ kind: "completed", totalBytes: 1000, resumedFromBytes: 600, verifiedBy: "size" });
    expect(state.finalized).toBe(1);
  });

  it("renames a partial file an earlier session finished but never renamed", async () => {
    const { destination, state } = memoryDestination(1000);
    const serverFetch = vi.fn() as unknown as typeof fetch;

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000 },
      { fetch: serverFetch, destination }
    );

    expect(outcome).toMatchObject({ kind: "completed", verifiedBy: "size" });
    expect(serverFetch).not.toHaveBeenCalled();
    expect(state.finalized).toBe(1);
  });

  it("never renames a download that stopped part-way", async () => {
    const { destination, state } = memoryDestination();
    let checks = 0;

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 300 },
      { fetch: rangeServer(1000), destination, isCancelled: () => ++checks > 2 }
    );

    expect(outcome.kind).toBe("cancelled");
    expect(state.finalized).toBe(0);
  });

  it("reports a rename that fails instead of claiming success", async () => {
    const { destination } = memoryDestination();

    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 10 },
      {
        fetch: rangeServer(10),
        destination: {
          ...destination,
          finalize: async () => {
            throw new Error("locked");
          }
        }
      }
    );

    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.reason).toContain("could not be renamed");
  });
});

describe("a file that changed upstream", () => {
  it("is refused instead of being cut off at the size the registry recorded", async () => {
    const { destination, state } = memoryDestination();

    // The server now holds 1,050 bytes; the registry recorded 1,000.
    const outcome = await downloadModelFile(
      { url: "https://example.test/model", expectedBytes: 1000, chunkBytes: 400 },
      { fetch: rangeServer(1050), destination }
    );

    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.reason).toContain("changed upstream");
    expect(state.finalized).toBe(0);
  });
});
