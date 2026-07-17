export type PhotoshopDocumentIdentity = Readonly<{
  id: number;
  name: string;
}>;

export type DocumentContextBound<T extends object> = T & Readonly<{
  originatingDocument: PhotoshopDocumentIdentity | null;
}>;

export type DocumentImportValidation =
  | Readonly<{
    ok: true;
    activeDocument: PhotoshopDocumentIdentity;
  }>
  | Readonly<{
    ok: false;
    reason: "missing-origin" | "no-active-document" | "origin-closed" | "different-active-document";
    message: string;
  }>;

export function createPhotoshopDocumentIdentity(id: number, name?: string): PhotoshopDocumentIdentity {
  return Object.freeze({
    id,
    name: normalizeDocumentName(name)
  });
}

export function bindDocumentContext<T extends object>(
  value: T,
  originatingDocument: PhotoshopDocumentIdentity | null
): DocumentContextBound<T> {
  return Object.freeze({
    ...value,
    originatingDocument
  });
}

export function validateDocumentImportContext(
  originatingDocument: PhotoshopDocumentIdentity | null,
  activeDocument: PhotoshopDocumentIdentity | null,
  openDocuments?: readonly PhotoshopDocumentIdentity[]
): DocumentImportValidation {
  if (!originatingDocument) {
    return {
      ok: false,
      reason: "missing-origin",
      message:
        "This result is not linked to an originating Photoshop document, so OpenLayer will not import it. Generate it again while the intended document is active."
    };
  }

  if (!activeDocument) {
    return {
      ok: false,
      reason: "no-active-document",
      message: `This result belongs to “${originatingDocument.name}”. Activate the original document before importing. If it was closed, reopen it and generate the result again.`
    };
  }

  const originIsOpen = openDocuments?.some((document) => document.id === originatingDocument.id);

  if (originIsOpen === false) {
    return {
      ok: false,
      reason: "origin-closed",
      message: `This result belongs to “${originatingDocument.name}”, but that document is no longer open. Reopen it and generate the result again before importing.`
    };
  }

  if (activeDocument.id !== originatingDocument.id) {
    return {
      ok: false,
      reason: "different-active-document",
      message: `This result belongs to “${originatingDocument.name}”, but “${activeDocument.name}” is active. Activate “${originatingDocument.name}” and import again.`
    };
  }

  return {
    ok: true,
    activeDocument
  };
}

function normalizeDocumentName(name?: string) {
  const normalized = name?.trim();
  return normalized || "Untitled document";
}
