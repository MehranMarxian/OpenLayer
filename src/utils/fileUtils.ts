type UxpFile = {
  write: (data: ArrayBuffer, options: { format: unknown }) => Promise<void>;
};

export function createLayerName(prefix: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());

  return `${prefix}_${year}${month}${day}_${hour}${minute}`;
}

export async function saveBlobToTemporaryFile(blob: Blob, fileName: string): Promise<UxpFile> {
  const uxp = require("uxp") as UxpModule;
  const tempFolder = await uxp.storage.localFileSystem.getTemporaryFolder();
  const file = await tempFolder.createFile(fileName, { overwrite: true });
  const arrayBuffer = await blob.arrayBuffer();

  await file.write(arrayBuffer, {
    format: uxp.storage.formats.binary
  });

  return file;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
