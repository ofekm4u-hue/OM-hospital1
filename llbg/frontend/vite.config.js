import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend dev server. The backend runs separately on :8000 (WebSocket /ws).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
});
