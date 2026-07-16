export type ObjectUrlApi = Readonly<{
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
}>;

export type ObjectUrlRegistry = Readonly<{
  create: (blob: Blob) => string;
  revoke: (url: string) => void;
  revokeAll: () => void;
  activeCount: () => number;
}>;

export function createObjectUrlRegistry(api: ObjectUrlApi = URL): ObjectUrlRegistry {
  const activeUrls = new Set<string>();

  return {
    create(blob) {
      const url = api.createObjectURL(blob);
      activeUrls.add(url);
      return url;
    },
    revoke(url) {
      if (!url || !activeUrls.delete(url)) return;
      api.revokeObjectURL(url);
    },
    revokeAll() {
      for (const url of activeUrls) api.revokeObjectURL(url);
      activeUrls.clear();
    },
    activeCount() {
      return activeUrls.size;
    }
  };
}
