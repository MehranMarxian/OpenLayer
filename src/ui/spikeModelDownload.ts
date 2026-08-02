// THIS IS A SPIKE, NOT A FEATURE. It exists to answer whether OpenLayer can
// download a model file itself, before anything is designed around the answer.
// The button that calls it is meant to be deleted.
//
// Two unknowns block the design:
//   1. Can UXP write to an arbitrary path (ComfyUI's models folder), or does it
//      need the artist to pick the folder through a native dialog?
//   2. Can a multi-gigabyte file reach disk without being buffered in memory?
//      An 18.7 GiB model cannot be held as a Blob.
//
// Unknown 2 has a promising answer that avoids streaming entirely: HuggingFace
// serves `accept-ranges: bytes`, verified from the command line, so the file can
// be pulled as bounded ranged chunks and appended. That turns "can fetch
// stream?" -- reportedly unreliable in UXP -- into "does UXP honour a Range
// header, and can we append to a file?", which is what probes 4 and 5 ask.

export type ProbeStatus = "pass" | "fail" | "unsupported";

export type ProbeResult = Readonly<{
  id: string;
  question: string;
  status: ProbeStatus;
  detail: string;
}>;

// A small, ungated, real file on the same host the registry downloads from, so
// the network probes exercise the actual CDN path rather than a stand-in.
export const PROBE_RANGE_URL =
  "https://huggingface.co/xinsir/controlnet-scribble-sdxl-1.0/resolve/main/diffusion_pytorch_model.safetensors";
export const PROBE_RANGE_BYTES = 1048576;

// Hardcoded because no setting records where ComfyUI lives yet -- discovering
// that is part of what a real downloader would have to solve. For the spike it
// only has to be right on the one machine the probe runs on, and a wrong path
// reports itself as a failed resolve rather than failing silently.
export const PROBE_MODELS_FOLDER = "C:/Users/11/pinokio/api/comfyui.git/app/models/upscale_models";

type UxpLike = {
  storage: {
    formats: { binary: unknown; utf8?: unknown };
    localFileSystem: Record<string, unknown>;
  };
};

export type SpikeDeps = Readonly<{
  loadUxp: () => UxpLike;
  loadFs: () => unknown;
  fetch: typeof fetch;
  // Where a real download would have to land. Probed, never written to
  // permanently -- the spike creates and deletes one small file.
  modelsFolderPath: string;
}>;

export async function runModelDownloadSpike(deps: SpikeDeps): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  let arbitraryFolder: unknown;

  results.push(await probe(
    "arbitrary-path",
    "Can UXP resolve ComfyUI's models folder without a picker?",
    async () => {
      const lfs = deps.loadUxp().storage.localFileSystem;
      const getEntryWithUrl = lfs.getEntryWithUrl as
        | ((url: string) => Promise<unknown>)
        | undefined;

      if (typeof getEntryWithUrl !== "function") {
        return unsupported("localFileSystem.getEntryWithUrl does not exist in this UXP build.");
      }

      // UXP wants a file: URL. Native Windows separators are normalised so the
      // probe reports on the path itself, not on our formatting of it.
      const url = `file:${deps.modelsFolderPath.replace(/\\/g, "/")}`;
      arbitraryFolder = await getEntryWithUrl(url);

      if (!arbitraryFolder) {
        return fail(`getEntryWithUrl returned nothing for ${url}`);
      }

      return pass(`Resolved ${url} with no dialog.`);
    }
  ));

  results.push(await probe(
    "arbitrary-write",
    "Can it create and delete a file in that folder?",
    async () => {
      if (!arbitraryFolder) {
        return unsupported("Skipped: the folder never resolved, so writing there could not be tried.");
      }

      const folder = arbitraryFolder as {
        createFile?: (name: string, options?: { overwrite?: boolean }) => Promise<{
          write: (data: unknown, options: { format: unknown }) => Promise<void>;
          delete: () => Promise<void>;
        }>;
      };

      if (typeof folder.createFile !== "function") {
        return unsupported("The resolved entry has no createFile; it may be a file rather than a folder.");
      }

      const uxp = deps.loadUxp();
      const file = await folder.createFile("openlayer-write-probe.tmp", { overwrite: true });
      await file.write(new ArrayBuffer(16), { format: uxp.storage.formats.binary });
      await file.delete();

      return pass("Created, wrote 16 bytes to, and deleted a probe file.");
    }
  ));

  results.push(await probe(
    "fs-module",
    "Is a Node-like fs module with file descriptors available?",
    async () => {
      const fs = deps.loadFs() as Record<string, unknown> | undefined;

      if (!fs) {
        return unsupported("require(\"fs\") is not available.");
      }

      const present = ["open", "write", "close", "appendFile", "writeFile", "lstat"]
        .filter((name) => typeof fs[name] === "function");

      if (present.length === 0) {
        return unsupported("An fs module exists but exposes none of the expected methods.");
      }

      return pass(`fs exposes: ${present.join(", ")}.`);
    }
  ));

  results.push(await probe(
    "append",
    "Can bytes be appended, so chunks accumulate without buffering the whole file?",
    async () => {
      const uxp = deps.loadUxp();
      const lfs = uxp.storage.localFileSystem as {
        getTemporaryFolder: () => Promise<{
          createFile: (name: string, options?: { overwrite?: boolean }) => Promise<{
            write: (data: unknown, options: Record<string, unknown>) => Promise<void>;
            read?: (options: Record<string, unknown>) => Promise<ArrayBuffer>;
            delete: () => Promise<void>;
          }>;
        }>;
      };
      const folder = await lfs.getTemporaryFolder();
      const file = await folder.createFile("openlayer-append-probe.bin", { overwrite: true });
      const chunk = new ArrayBuffer(1024);

      await file.write(chunk, { format: uxp.storage.formats.binary });
      // "append" is what the docs describe but the published typings omit, so
      // this is exactly the claim worth testing rather than assuming.
      await file.write(chunk, { format: uxp.storage.formats.binary, append: true });

      let observed = -1;
      if (typeof file.read === "function") {
        const contents = await file.read({ format: uxp.storage.formats.binary });
        observed = contents.byteLength;
      }

      await file.delete();

      if (observed === 2048) return pass("Two 1 KiB writes with append:true produced 2048 bytes.");
      if (observed === 1024) return fail("append:true was ignored -- the second write replaced the first (1024 bytes).");
      if (observed < 0) return unsupported("Wrote both chunks, but this build cannot read the file back to confirm the size.");
      return fail(`Two 1 KiB appends produced ${observed} bytes, which is neither 1024 nor 2048.`);
    }
  ));

  results.push(await probe(
    "ranged-fetch",
    "Does UXP's fetch honour a Range header, so downloads stay bounded and resumable?",
    async () => {
      const response = await deps.fetch(PROBE_RANGE_URL, {
        headers: { Range: `bytes=0-${PROBE_RANGE_BYTES - 1}` }
      });

      if (response.status !== 206) {
        return fail(
          `Expected HTTP 206 Partial Content, got ${response.status}. The whole ${response.headers.get("content-length") ?? "unknown"}-byte file would arrive at once.`
        );
      }

      const buffer = await response.arrayBuffer();

      if (buffer.byteLength !== PROBE_RANGE_BYTES) {
        return fail(`Asked for ${PROBE_RANGE_BYTES} bytes, received ${buffer.byteLength}.`);
      }

      return pass(`HTTP 206 with exactly ${buffer.byteLength} bytes; ranged download works.`);
    }
  ));

  return results;
}

// Every probe is isolated so one failure reports itself rather than aborting the
// rest -- a spike that stops at the first problem answers one question instead
// of five.
async function probe(
  id: string,
  question: string,
  run: () => Promise<Omit<ProbeResult, "id" | "question">>
): Promise<ProbeResult> {
  try {
    return { id, question, ...(await run()) };
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    return { id, question, status: "fail", detail: `Threw: ${message}` };
  }
}

function pass(detail: string) {
  return { status: "pass" as const, detail };
}

function fail(detail: string) {
  return { status: "fail" as const, detail };
}

function unsupported(detail: string) {
  return { status: "unsupported" as const, detail };
}

export function formatSpikeReport(results: readonly ProbeResult[]): string {
  return results
    .map((result) => `[${result.status.toUpperCase()}] ${result.question}\n    ${result.detail}`)
    .join("\n");
}

// The verdict the spike exists to produce, so the report states a conclusion
// instead of leaving five facts to be interpreted later.
export function summarizeSpike(results: readonly ProbeResult[]): string {
  const byId = new Map(results.map((result) => [result.id, result]));
  const ok = (id: string) => byId.get(id)?.status === "pass";
  const canPlaceFiles = ok("arbitrary-path") && ok("arbitrary-write");
  const canAccumulate = ok("append") || ok("fs-module");
  const canChunk = ok("ranged-fetch");

  if (canPlaceFiles && canAccumulate && canChunk) {
    return "FEASIBLE: OpenLayer can write to ComfyUI's models folder, accumulate a file in chunks, and pull bounded ranges. A direct downloader is buildable.";
  }

  const blockers: string[] = [];
  if (!canPlaceFiles) blockers.push("no unattended write access to the models folder (a folder picker would be required)");
  if (!canAccumulate) blockers.push("no way to grow a file incrementally (the whole model would have to fit in memory)");
  if (!canChunk) blockers.push("no ranged download (the whole file would arrive in one response)");

  return `BLOCKED: ${blockers.join("; ")}.`;
}
