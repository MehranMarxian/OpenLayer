declare function require(moduleName: "photoshop"): unknown;
declare function require(moduleName: "uxp"): UxpModule;

type UxpPanelEntrypoint = {
  create?: (rootNode: HTMLElement) => void;
  show?: (rootNode: HTMLElement) => void;
  hide?: (rootNode: HTMLElement) => void;
  destroy?: (rootNode: HTMLElement) => void;
};

type UxpEntrypointsSetup = {
  panels?: Record<string, UxpPanelEntrypoint>;
  commands?: Record<string, unknown>;
};

type UxpModule = {
  entrypoints?: {
    setup?: (definition: UxpEntrypointsSetup) => void;
  };
  shell?: {
    openExternal?: (url: string) => Promise<void> | void;
  };
  storage: {
    formats: {
      binary: unknown;
    };
    localFileSystem: {
      getTemporaryFolder: () => Promise<UxpFolder>;
      createSessionToken: (file: unknown) => Promise<string>;
    };
  };
};

type UxpFileSystemEntry = {
  name: string;
  isFile: boolean;
  delete: () => Promise<void>;
};

type UxpFile = UxpFileSystemEntry & {
  write: (data: ArrayBuffer, options: { format: unknown }) => Promise<void>;
};

type UxpFolder = {
  createFile: (name: string, options?: { overwrite?: boolean }) => Promise<UxpFile>;
  getEntries: () => Promise<UxpFileSystemEntry[]>;
};
