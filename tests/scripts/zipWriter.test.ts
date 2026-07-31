import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// @ts-expect-error -- scripts/ is plain .mjs and sits outside the tsconfig `include`.
import { writeZip } from "../../scripts/lib/zipWriter.mjs";

const END_OF_CENTRAL_DIRECTORY = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const CENTRAL_FILE_HEADER = Buffer.from([0x50, 0x4b, 0x01, 0x02]);

/**
 * Reads entry names straight out of the ZIP central directory.
 *
 * Deliberately not an unzip library: the bug this suite exists to prevent is
 * backslash entry paths, and most readers normalize those away silently —
 * Python's `zipfile` does. A normalizing reader reports a malformed archive as
 * clean, which is how nine OpenLayer releases shipped with the defect and how
 * the first check for it returned the wrong answer. Only the raw bytes prove
 * what is stored. See `docs/DISTRIBUTION_SPIKE.md`, Finding 2.
 */
function findEndOfCentralDirectory(archive: Buffer): number {
  const offset = archive.lastIndexOf(END_OF_CENTRAL_DIRECTORY);

  if (offset < 0) {
    throw new Error("No end-of-central-directory record: this is not a zip.");
  }

  return offset;
}

function readCentralDirectoryNames(archive: Buffer): string[] {
  const endOfCentralDirectory = findEndOfCentralDirectory(archive);
  const total = archive.readUInt16LE(endOfCentralDirectory + 10);
  const names: string[] = [];
  let offset = archive.readUInt32LE(endOfCentralDirectory + 16);

  for (let index = 0; index < total; index += 1) {
    if (!archive.subarray(offset, offset + 4).equals(CENTRAL_FILE_HEADER)) {
      throw new Error(`Corrupt central directory header at entry ${index}.`);
    }

    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);

    names.push(archive.toString("utf8", offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return names;
}

/** CRC-32 of the first entry, read from its central directory header. */
function readFirstEntryCrc(archive: Buffer): number {
  const centralOffset = archive.readUInt32LE(findEndOfCentralDirectory(archive) + 16);
  return archive.readUInt32LE(centralOffset + 16);
}

async function writeToTempZip(entries: { path: string; data: Buffer | string }[]) {
  const directory = await mkdtemp(join(tmpdir(), "openlayer-zip-"));
  const zipPath = join(directory, "test.zip");

  try {
    await writeZip(zipPath, entries);
    return await readFile(zipPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Textbook CRC-32, written independently so it cannot share a bug with the writer. */
function referenceCrc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

describe("writeZip", () => {
  it("stores nested paths with forward slashes", async () => {
    const archive = await writeToTempZip([
      { path: "manifest.json", data: "{}" },
      { path: "assets/index-abc123.js", data: "console.log(1);" },
      { path: "icons/dark/icon_D.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }
    ]);

    const names = readCentralDirectoryNames(archive);

    expect(names).toEqual(["manifest.json", "assets/index-abc123.js", "icons/dark/icon_D.png"]);
    expect(names.filter((name) => name.includes("\\"))).toEqual([]);
  });

  it("normalizes a backslash path handed to it, rather than storing it", async () => {
    // The failure mode that shipped: a caller building paths with `path.join`
    // on Windows produces "assets\\index.js". The writer must not pass that
    // through, because the archive gets opened on machines that are not Windows.
    const archive = await writeToTempZip([{ path: "assets\\index.js", data: "x" }]);

    expect(readCentralDirectoryNames(archive)).toEqual(["assets/index.js"]);
  });

  it("refuses absolute and traversing paths", async () => {
    await expect(writeToTempZip([{ path: "/etc/passwd", data: "x" }])).rejects.toThrow(/unsafe/i);
    await expect(writeToTempZip([{ path: "../outside.txt", data: "x" }])).rejects.toThrow(/unsafe/i);
    // Backslash traversal is normalized first, so it must still be caught after.
    await expect(writeToTempZip([{ path: "..\\outside.txt", data: "x" }])).rejects.toThrow(/unsafe/i);
  });

  it("records a CRC that matches the uncompressed payload", async () => {
    const payload = Buffer.from("the quick brown fox".repeat(50), "utf8");
    const archive = await writeToTempZip([{ path: "body.txt", data: payload }]);

    expect(readFirstEntryCrc(archive)).toBe(referenceCrc32(payload));
  });

  it("stores payloads that deflate badly without corrupting them", async () => {
    // Pseudo-random bytes grow under deflate, so the writer stores them
    // uncompressed. Both branches must yield an entry with an honest CRC.
    const incompressible = Buffer.from(
      Array.from({ length: 512 }, (_unused, index) => (index * 2654435761) % 256)
    );
    const archive = await writeToTempZip([{ path: "noise.bin", data: incompressible }]);

    expect(readFirstEntryCrc(archive)).toBe(referenceCrc32(incompressible));
    expect(readCentralDirectoryNames(archive)).toEqual(["noise.bin"]);
  });
});
