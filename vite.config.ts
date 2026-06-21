import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "src",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2020",
    modulePreload: {
      polyfill: false
    },
    rollupOptions: {
      input: resolve(projectRoot, "src/index.html")
    }
  }
});
