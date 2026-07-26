import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4 läuft über das offizielle Vite-Plugin — kein PostCSS-Setup nötig.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
