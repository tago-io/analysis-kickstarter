#!/usr/bin/env -S deno run -A
// Build every widget in this workspace as an independent bundle under _dist/<name>/.
// Each widget is a separate vite invocation so its output is fully self-contained
// (no shared chunks), which keeps per-widget uploads to TagoIO simple.

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const widgets = readdirSync(__dirname).filter((name) => {
  if (name.startsWith("_") || name.startsWith(".")) return false;
  const full = resolve(__dirname, name);
  try {
    return statSync(full).isDirectory() && existsSync(resolve(full, "index.html"));
  } catch {
    return false;
  }
});

if (widgets.length === 0) {
  console.error("No widgets found (expected widgets/<name>/index.html).");
  Deno.exit(1);
}

console.log(`Building ${widgets.length} widget(s): ${widgets.join(", ")}`);

for (const widget of widgets) {
  console.log(`\n→ ${widget}`);
  const { code } = await new Deno.Command("deno", {
    args: ["run", "-A", "npm:vite", "build"],
    env: { WIDGET: widget },
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (code !== 0) {
    console.error(`\nBuild failed for ${widget}`);
    Deno.exit(code);
  }
}
