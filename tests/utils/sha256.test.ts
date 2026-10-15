import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Sha256 } from "../../src/utils/sha256";

const reference = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("Sha256", () => {
  it("matches the published test vectors", () => {
    expect(new Sha256().digestHex()).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(new Sha256().update(new TextEncoderShim("abc").bytes).digestHex()).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("matches Node's crypto at every length around the 64-byte block and 56-byte padding edges", () => {
    for (let length = 0; length <= 200; length++) {
      const bytes = randomBytes(length);
      expect(new Sha256().update(bytes).digestHex(), `length ${length}`).toBe(reference(bytes));
    }
  });

  it("gives the same digest however the data is split into chunks", () => {
    const bytes = randomBytes(3 * 1024 * 1024 + 17);
    const hash = new Sha256();
    let offset = 0;
    let step = 1;

    while (offset < bytes.length) {
      const end = Math.min(bytes.length, offset + step);
      hash.update(bytes.subarray(offset, end).buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + end));
      offset = end;
      step = (step * 7 + 13) % 300_001;
    }

    expect(hash.digestHex()).toBe(reference(bytes));
  });

  it("refuses to be reused after the digest", () => {
    const hash = new Sha256();
    hash.digestHex();
    expect(() => hash.update(new Uint8Array(1))).toThrow();
  });
});

// TextEncoder is fine in tests (lint bans it in src/ only); kept explicit here.
class TextEncoderShim {
  readonly bytes: Uint8Array;
  constructor(text: string) {
    this.bytes = Uint8Array.from(text, (character) => character.charCodeAt(0));
  }
}
