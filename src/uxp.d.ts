declare function require(moduleName: "photoshop"): unknown;
declare function require(moduleName: "uxp"): UxpModule;

type UxpModule = {
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

type UxpFolder = {
  createFile: (name: string, options?: { overwrite?: boolean }) => Promise<{
    write: (data: ArrayBuffer, options: { format: unknown }) => Promise<void>;
  }>;
};
