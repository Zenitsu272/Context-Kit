import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.ts";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    crx({ manifest }),
    {
      name: "packaged-pdf-resources",
      async generateBundle() {
        // CJK character maps and standard fonts must also work without a CDN.
        for (const directory of ["cmaps", "standard_fonts"]) {
          const source = path.resolve("node_modules/pdfjs-dist", directory);
          for (const name of await readdir(source)) {
            this.emitFile({
              type: "asset",
              fileName: `pdf-resources/${directory}/${name}`,
              source: await readFile(path.join(source, name)),
            });
          }
        }
      },
    },
  ],
});
