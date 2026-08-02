// The download engine for model files, built on what the feasibility spike
// established (PR #80): UXP can append to a file, and HuggingFace honours a
// Range header. So a model arrives as a sequence of bounded ranged chunks that
// are appended to disk, and memory never holds more than one chunk -- an 18.7
// GiB model is no harder than a 700 MiB one.
//
// Resume falls out of the same mechanism for free, which matters more here than
// it looks: a connection that drops at 17 GiB resumes from 17 GiB instead of
// starting over.

export const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;

export type DownloadProgress = Readonly<{
  receivedBytes: number;
  totalBytes: number | null;
  // Null rather than 0 when the total is unknown, so a caller can never render
  // a confident "0%" for something it has not measured.
  fraction: number | null;
  resumedFromBytes: number;
}>;

// The destination is an interface rather than a UXP file so the engine is
// testable without a host, and so the two access routes the spike found (direct
// path, or a folder the artist granted) are interchangeable here.
export type DownloadDestination = Readonly<{
  // Bytes already on disk for this file, or 0 if it does not exist yet.
  existingBytes: () => Promise<number>;
  append: (chunk: ArrayBuffer) => Promise<void>;
  // Called when a partial file must be thrown away rather than resumed.
  discard: () => Promise<void>;
}>;

export type DownloadRequest = Readonly<{
  url: string;
  // From the registry. Null when the registry does not publish one; the
  // download still runs, it just cannot be size-verified at the end.
  expectedBytes: number | null;
  chunkBytes?: number;
}>;

export type DownloadDeps = Readonly<{
  fetch: typeof fetch;
  destination: DownloadDestination;
  onProgress?: (progress: DownloadProgress) => void;
  // Polled between chunks. Cancelling mid-chunk is not worth the complexity:
  // one chunk is seconds at most, and the partial file is resumable anyway.
  isCancelled?: () => boolean;
}>;

export type DownloadOutcome =
  | { kind: "completed"; totalBytes: number; resumedFromBytes: number }
  | { kind: "cancelled"; receivedBytes: number }
  | { kind: "failed"; reason: string; receivedBytes: number };

export async function downloadModelFile(
  request: DownloadRequest,
  deps: DownloadDeps
): Promise<DownloadOutcome> {
  const chunkBytes = request.chunkBytes ?? DEFAULT_CHUNK_BYTES;

  if (!Number.isInteger(chunkBytes) || chunkBytes <= 0) {
    return { kind: "failed", reason: "The download chunk size must be a positive whole number of bytes.", receivedBytes: 0 };
  }

  let received: number;

  try {
    received = await deps.destination.existingBytes();
  } catch (caughtError) {
    return { kind: "failed", reason: `Could not inspect the partial download. ${messageOf(caughtError)}`, receivedBytes: 0 };
  }

  // A partial file larger than the finished model is not a resume point, it is
  // a different file that happens to share a name. Starting over is the only
  // safe reading.
  if (request.expectedBytes !== null && received > request.expectedBytes) {
    try {
      await deps.destination.discard();
      received = 0;
    } catch (caughtError) {
      return { kind: "failed", reason: `A partial file is larger than the expected model and could not be removed. ${messageOf(caughtError)}`, receivedBytes: received };
    }
  }

  if (request.expectedBytes !== null && received === request.expectedBytes) {
    return { kind: "completed", totalBytes: received, resumedFromBytes: received };
  }

  const resumedFrom = received;
  let total: number | null = request.expectedBytes;

  report(deps, received, total, resumedFrom);

  while (total === null || received < total) {
    if (deps.isCancelled?.()) {
      return { kind: "cancelled", receivedBytes: received };
    }

    const rangeEnd = total === null ? received + chunkBytes - 1 : Math.min(received + chunkBytes, total) - 1;

    if (rangeEnd < received) {
      return { kind: "failed", reason: "Computed an empty byte range; refusing to loop.", receivedBytes: received };
    }

    let response: Response;

    try {
      response = await deps.fetch(request.url, { headers: { Range: `bytes=${received}-${rangeEnd}` } });
    } catch (caughtError) {
      return { kind: "failed", reason: `Network error at byte ${received}. ${messageOf(caughtError)}`, receivedBytes: received };
    }

    // A 200 means the server ignored the Range header and is sending the whole
    // file. Reading that body would defeat the entire bounded-memory design, so
    // it is refused rather than tolerated.
    if (response.status === 200) {
      return {
        kind: "failed",
        reason: "The server ignored the Range header and tried to send the whole file at once, which cannot be downloaded safely.",
        receivedBytes: received
      };
    }

    // 416 means the server has nothing past this offset. That is either a clean
    // finish or a source shorter than the registry claims -- the final size
    // check below can tell those apart, and says so precisely. Reporting "HTTP
    // 416" here instead would hide a real mismatch behind a status code.
    if (response.status === 416) {
      break;
    }

    if (response.status !== 206) {
      return { kind: "failed", reason: describeHttpFailure(response.status), receivedBytes: received };
    }

    if (total === null) {
      total = parseTotalFromContentRange(response.headers?.get?.("content-range") ?? null);
    }

    let chunk: ArrayBuffer;

    try {
      chunk = await response.arrayBuffer();
    } catch (caughtError) {
      return { kind: "failed", reason: `Could not read the response body at byte ${received}. ${messageOf(caughtError)}`, receivedBytes: received };
    }

    if (chunk.byteLength === 0) {
      return { kind: "failed", reason: `The server returned an empty chunk at byte ${received}, so the download cannot progress.`, receivedBytes: received };
    }

    try {
      await deps.destination.append(chunk);
    } catch (caughtError) {
      return { kind: "failed", reason: `Could not write to disk at byte ${received}. ${messageOf(caughtError)}`, receivedBytes: received };
    }

    received += chunk.byteLength;
    report(deps, received, total, resumedFrom);
  }

  if (request.expectedBytes !== null && received !== request.expectedBytes) {
    return {
      kind: "failed",
      reason: `The download finished at ${received} bytes but the registry expects ${request.expectedBytes}. The file is incomplete or the source changed.`,
      receivedBytes: received
    };
  }

  return { kind: "completed", totalBytes: received, resumedFromBytes: resumedFrom };
}

// Licence-gated weights sit behind an account agreement. Sending an anonymous
// request produces a 401/403 that reads like a bug, so the caller is expected to
// check this first and send the artist to the model page instead.
export function describeHttpFailure(status: number): string {
  if (status === 401 || status === 403) {
    return `The server refused the download (HTTP ${status}). This usually means the model is licence-gated and needs its terms accepted on the model page first.`;
  }

  if (status === 404) {
    return "The download URL returned 404. The pinned file may have moved or been renamed upstream.";
  }

  if (status === 429) {
    return "The server is rate-limiting the download (HTTP 429). Waiting and resuming will continue from where it stopped.";
  }

  return `The server returned HTTP ${status}.`;
}

// "bytes 0-8388607/2502139104" -> 2502139104
export function parseTotalFromContentRange(header: string | null): number | null {
  if (!header) return null;

  const match = /\/(\d+)\s*$/.exec(header.trim());
  if (!match) return null;

  const total = Number(match[1]);
  return Number.isInteger(total) && total > 0 ? total : null;
}

export function formatDownloadProgress(progress: DownloadProgress): string {
  const received = formatBytesForDownload(progress.receivedBytes);

  if (progress.totalBytes === null || progress.fraction === null) {
    return `${received} downloaded`;
  }

  const percent = Math.floor(progress.fraction * 100);
  const resumeNote = progress.resumedFromBytes > 0
    ? ` (resumed from ${formatBytesForDownload(progress.resumedFromBytes)})`
    : "";

  return `${percent}% - ${received} of ${formatBytesForDownload(progress.totalBytes)}${resumeNote}`;
}

// Deliberately not the shared formatBytes: that one returns "unknown" for 0,
// which is right for an unmeasured file size and wrong for a download that has
// genuinely received nothing yet.
export function formatBytesForDownload(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
  if (bytes === 0) return "0 B";

  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

function report(deps: DownloadDeps, received: number, total: number | null, resumedFrom: number) {
  deps.onProgress?.({
    receivedBytes: received,
    totalBytes: total,
    fraction: total === null || total === 0 ? null : Math.min(received / total, 1),
    resumedFromBytes: resumedFrom
  });
}

function messageOf(caughtError: unknown) {
  return caughtError instanceof Error ? caughtError.message : String(caughtError);
}
