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
  // @tago-io/sdk imports `node:path` at the top of its bundle for the
  // `uploadFile` helper — code our widgets never reach. Without an alias
  // Vite externalises `node:path` to `undefined`, which is harmless until
  // someone changes a code path. Map it to `path-browserify` so the
  // import resolves cleanly in the browser bundle.
  resolve: {
    alias: {
      "node:path": "path-browserify",
    },
  },
  // @tago-io/sdk is published as a Node bundle and reads `process.env.*`
  // and `process.versions` at module load. Browsers have no `process`,
  // so we shim it to an empty object — the SDK falls back to its defaults
  // (TagoIO production endpoints) when those env vars are absent.
  define: {
    "process.env.TAGOIO_API": "undefined",
    "process.env.TAGOIO_SSE": "undefined",
    "process.env.TAGOIO_REQUEST_ATTEMPTS": "undefined",
    "process.env": "{}",
    "process.versions": "{}",
    "process.platform": '"browser"',
  },
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
