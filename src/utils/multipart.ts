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
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  for (const field of fields) {
    parts.push(
      encoder.encode(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${sanitizeMultipartToken(field.name)}"${CRLF}${CRLF}` +
          `${field.value}${CRLF}`
      )
    );
  }

  for (const file of files) {
    parts.push(
      encoder.encode(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${sanitizeMultipartToken(file.name)}"; filename="${sanitizeMultipartToken(file.filename)}"${CRLF}` +
          `Content-Type: ${sanitizeMultipartToken(file.contentType)}${CRLF}${CRLF}`
      )
    );
    parts.push(file.data);
    parts.push(encoder.encode(CRLF));
  }

  parts.push(encoder.encode(`--${boundary}--${CRLF}`));

  return concatBytes(parts);
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
