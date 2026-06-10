import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Self-contained client-side app — no backend. The mixology engine runs entirely
// in the browser (see src/data/labEngine.js).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true },
});
