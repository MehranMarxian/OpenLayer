import { ObjectUrlRegistry } from "./objectUrlRegistry";

// One owned object-URL slot. Whatever URL it holds is revoked when a new one
// takes its place or the slot is released, so a panel can never leak the URL of
// a preview it no longer shows.
export type OwnedObjectUrl = {
  set: (url: string) => string;
  createFrom: (blob: Blob) => string;
  release: () => void;
};

export function createOwnedObjectUrl(urls: ObjectUrlRegistry): OwnedObjectUrl {
  let ownedUrl = "";

  return {
    set(url) {
      if (ownedUrl) urls.revoke(ownedUrl);
      ownedUrl = url;
      return ownedUrl;
    },
    createFrom(blob) {
      return this.set(urls.create(blob));
    },
    release() {
      if (ownedUrl) urls.revoke(ownedUrl);
      ownedUrl = "";
    }
  };
}

export function renderPreviewImage(panel: HTMLElement, src: string, alt: string) {
  panel.innerHTML = "";
  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  panel.append(image);
}

export function renderPreviewMessage(panel: HTMLElement, className: string, text: string) {
  panel.innerHTML = "";
  const message = document.createElement("span");
  message.className = className;
  message.textContent = text;
  panel.append(message);
}

export type SourcePreviewContent = {
  previewUrl: string;
  title: string;
  meta: string;
};

export type SourcePreviewPanel = {
  show: (content: SourcePreviewContent | null) => void;
};

// A captured-source preview: image plus title/meta lines. The shown preview URL
// was created by the capture handler; showing it here transfers ownership, so
// replacing or clearing the source revokes it.
export function createSourcePreviewPanel(options: {
  urls: ObjectUrlRegistry;
  panel: HTMLElement;
  titleElement: HTMLElement;
  metaElement: HTMLElement;
  imageAlt: string;
  emptyTitle?: string;
  emptyMeta?: string;
}): SourcePreviewPanel {
  const ownedUrl = createOwnedObjectUrl(options.urls);

  return {
    show(content) {
      if (!content) {
        ownedUrl.release();
        renderPreviewMessage(options.panel, "source-empty", "None");
        options.titleElement.textContent = options.emptyTitle ?? "No source captured";
        options.metaElement.textContent = options.emptyMeta ?? "Choose active layer or full canvas.";
        return;
      }

      renderPreviewImage(options.panel, ownedUrl.set(content.previewUrl), options.imageAlt);
      options.titleElement.textContent = content.title;
      options.metaElement.textContent = content.meta;
    }
  };
}

export type ResultPreviewPanel = {
  showResult: (blob: Blob | null) => void;
  showProgress: (message: string, blob?: Blob) => void;
  releaseLivePreviewUrl: () => void;
};

// A generation-result preview. Owns two URL slots: the final result image and
// the transient live ComfyUI preview frames shown while a result does not exist
// yet. Progress updates are ignored once a result is displayed, matching the
// panels this replaces.
export function createResultPreviewPanel(options: {
  urls: ObjectUrlRegistry;
  panel: HTMLElement;
  emptyText: string;
  resultAlt: string;
  liveAlt: string;
}): ResultPreviewPanel {
  const resultUrl = createOwnedObjectUrl(options.urls);
  const liveUrl = createOwnedObjectUrl(options.urls);
  let hasResult = false;

  return {
    showResult(blob) {
      resultUrl.release();
      liveUrl.release();
      hasResult = Boolean(blob);

      if (!blob) {
        renderPreviewMessage(options.panel, "preview-empty", options.emptyText);
        return;
      }

      renderPreviewImage(options.panel, resultUrl.createFrom(blob), options.resultAlt);
    },
    showProgress(message, blob) {
      if (hasResult) return;

      if (blob) {
        renderPreviewImage(options.panel, liveUrl.createFrom(blob), options.liveAlt);
        return;
      }

      liveUrl.release();
      renderPreviewMessage(options.panel, "preview-empty", message);
    },
    releaseLivePreviewUrl() {
      liveUrl.release();
    }
  };
}
