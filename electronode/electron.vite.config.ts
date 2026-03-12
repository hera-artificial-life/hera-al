import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

const root = __dirname;

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve(root, "src/main/index.ts"),
        formats: ["cjs"],
      },
      rollupOptions: {
        input: resolve(root, "src/main/index.ts"),
        external: ["electron"],
      },
      copyPublicDir: false,
    },
  },
  preload: {
    build: {
      lib: {
        entry: resolve(root, "src/preload/preload.ts"),
        formats: ["cjs"],
      },
      rollupOptions: {
        input: resolve(root, "src/preload/preload.ts"),
      },
    },
  },
  renderer: {
    root: resolve(root, "src/renderer"),
    build: {
      rollupOptions: {
        input: resolve(root, "src/renderer/index.html"),
      },
    },
    plugins: [react()],
  },
});
