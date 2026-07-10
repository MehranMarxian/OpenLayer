const CRLF = "\r\n";

export type MultipartField = {
  name: string;
  value: string;
};

export type MultipartFilePart = {
  name: string;
  filename: string;
  contentType: string;
  data: Uint8Array;
};

export function createMultipartBoundary() {
  return `----OpenLayerFormBoundary${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

export function createMultipartRequestBody(
  boundary: string,
  files: readonly MultipartFilePart[],
  fields: readonly MultipartField[]
): Uint8Array {
  const parts: Uint8Array[] = [];

  for (const field of fields) {
    parts.push(
      encodeUtf8(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${sanitizeMultipartToken(field.name)}"${CRLF}${CRLF}` +
          `${field.value}${CRLF}`
      )
    );
  }

  for (const file of files) {
    parts.push(
      encodeUtf8(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${sanitizeMultipartToken(file.name)}"; filename="${sanitizeMultipartToken(file.filename)}"${CRLF}` +
          `Content-Type: ${sanitizeMultipartToken(file.contentType)}${CRLF}${CRLF}`
      )
    );
    parts.push(file.data);
    parts.push(encodeUtf8(CRLF));
  }

  parts.push(encodeUtf8(`--${boundary}--${CRLF}`));

  return concatBytes(parts);
}

// Photoshop's UXP environment does not expose TextEncoder, so multipart
// header text is UTF-8 encoded manually.
export function encodeUtf8(text: string): Uint8Array {
  const bytes: number[] = [];

  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }

  return new Uint8Array(bytes);
}

export function sanitizeMultipartToken(value: string) {
  return value.replace(/[\r\n"]/g, "_");
}

function concatBytes(parts: readonly Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }

  return output;
}
