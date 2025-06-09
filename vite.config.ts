import { resolve } from "path";
import { defineConfig } from "vite";
import { chromeExtension } from "vite-plugin-chrome-extension";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist", // output directory
    rollupOptions: {
      input: {
        manifest: resolve(__dirname, "manifest.json")
      },
    },
  },
  plugins: [
    chromeExtension({
      manifest: resolve(__dirname, "manifest.json"), // explicitly set manifest location
    }),
  ],
});
