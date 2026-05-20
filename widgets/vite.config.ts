import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Each widget is built independently so its _dist/<name>/ folder is fully
// self-contained (no shared assets/ dir to track). Pick the widget via the
// WIDGET env var; build.ts loops over all widgets for `deno task build`.
const widget = process.env.WIDGET;
if (!widget) {
  throw new Error(
    "Set WIDGET=<folder-name> to target a widget (e.g. `WIDGET=line-chart deno task dev`).",
  );
}

export default defineConfig({
  root: resolve(__dirname, widget),
  // Relative base so a widget works wherever it's hosted (TagoIO file storage, CDN, etc.).
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, "_dist", widget),
    emptyOutDir: true,
    chunkSizeWarningLimit: 5000,
    // Flat output inside the widget's folder — easier to upload as a single bundle.
    assetsDir: "",
    rollupOptions: {
      output: {
        entryFileNames: "[name]-[hash].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 1234,
    strictPort: true,
    // Listen on all interfaces so tunnels (ngrok, Cloudflare, etc.) can reach the dev server.
    host: true,
    // Vite returns 403 for any Host header not in its allow-list (DNS-rebind guard).
    // `true` trusts any host — fine for local dev over a tunnel; do not ship to prod.
    allowedHosts: true,
  },
});
