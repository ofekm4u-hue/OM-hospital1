import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Self-contained client-side app — no backend. The mixology engine runs entirely
// in the browser (see src/data/labEngine.js).
//
// `viteSingleFile` inlines all JS/CSS into a single dist/index.html so the built
// app opens directly in a browser (double-click / file://) — matching the rest
// of this portfolio. `base: "./"` keeps any remaining asset paths relative.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  server: { port: 5174, host: true },
});
