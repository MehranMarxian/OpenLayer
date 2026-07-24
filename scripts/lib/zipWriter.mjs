import { deflateRawSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

/**
 * A minimal, spec-correct ZIP writer.
 *
 * Why not `Compress-Archive`, which `scripts/package.mjs` uses? Because Windows
 * PowerShell 5.1 runs on .NET Framework, which stores entry paths with
 * backslashes. The ZIP specification requires forward slashes, and the existing
 * release zips carry 40 such entries. Windows tooling tolerates it; other
 * unzippers are entitled not to. The setup pack goes to strangers' machines and
 * gets opened by whatever they have, so it is written correctly here instead.
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }

    table[index] = value;
  }

  return table;
})();

function crc32(buffer) {
  let crc = -1;

  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[index]) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

/** MS-DOS date/time, the only timestamp a base ZIP header can hold. */
function toDosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);

  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

/**
 * @param {string} zipPath destination file
 * @param {{ path: string, data: Buffer | string }[]} entries archive members;
 *   `path` must already be the desired in-archive path, using forward slashes
 * @param {Date} [modifiedAt]
 */
export async function writeZip(zipPath, entries, modifiedAt = new Date()) {
  const { time, date } = toDosDateTime(modifiedAt);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const normalizedPath = entry.path.split("\\").join("/");

    if (normalizedPath.startsWith("/") || normalizedPath.includes("..")) {
      throw new Error(`Refusing to write unsafe zip entry path: ${entry.path}`);
    }

    const nameBuffer = Buffer.from(normalizedPath, "utf8");
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const compressed = deflateRawSync(raw, { level: 9 });
    // Deflate can grow tiny or already-compressed payloads. Storing those
    // uncompressed keeps the archive smaller and stays valid either way.
    const useDeflate = compressed.length < raw.length;
    const payload = useDeflate ? compressed : raw;
    const checksum = crc32(raw);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(useDeflate ? 8 : 0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, nameBuffer, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(useDeflate ? 8 : 0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    centralHeader.writeUInt32LE(0, 38); // external attributes
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + payload.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4); // disk number
  endRecord.writeUInt16LE(0, 6); // central directory start disk
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20); // comment length

  await writeFile(zipPath, Buffer.concat([...localParts, centralDirectory, endRecord]));
}
