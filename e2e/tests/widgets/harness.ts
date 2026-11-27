import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import type { Page } from "@playwright/test";

// Runs a built custom widget without TagoRUN. The widget talks to its parent page through
// window.postMessage (@tago-io/custom-widget-react), so the test plays the parent's role and
// sends fixed data. Opened as the top page, the widget's parent is its own window.

// Tasks run from e2e/, and `deno task build` in widgets/ writes each bundle to _dist/<name>/.
const DIST_DIR = resolve("../widgets/_dist");
const ORIGIN = "http://widget.test";
const CONTENT_TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

export type WidgetName = "sensor-status" | "cold-room-monitor" | "cold-room-card-data";

export interface WidgetRecord {
  variable: string;
  value?: string | number | boolean;
  unit?: string;
  time?: string;
  group?: string;
  metadata?: Record<string, unknown>;
}

export const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const openWidget = async (page: Page, name: WidgetName) => {
  if (!existsSync(join(DIST_DIR, name, "index.html"))) {
    throw new Error(`No build for ${name} in widgets/_dist. Run "deno task test:e2e:widgets" from the repo root, which builds the widgets first.`);
  }
  // Everything else is blocked, so a test never depends on the network.
  await page.route("**/*", (route) => route.abort());
  await page.route(`${ORIGIN}/**`, (route) => {
    const file = new URL(route.request().url()).pathname.slice(1) || "index.html";
    return route.fulfill({ body: readFileSync(join(DIST_DIR, name, file)), contentType: CONTENT_TYPES[extname(file)] ?? "application/octet-stream" });
  });
  // The widget announces { loaded: true } once its message listener is ready; data sent earlier is lost.
  await page.addInitScript(() => {
    globalThis.addEventListener("message", (event: MessageEvent) => {
      if (event.data?.loaded) {
        (globalThis as unknown as { widgetLoaded: boolean }).widgetLoaded = true;
      }
    });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => (globalThis as unknown as { widgetLoaded?: boolean }).widgetLoaded === true);
};

// Same message shape TagoRUN sends. No `language` is sent, so the widget skips the dictionary
// request and renders its English baseline texts.
export const sendWidgetData = (page: Page, records: WidgetRecord[], customPreferences: Record<string, string> = {}) =>
  page.evaluate(({ records, customPreferences }) => {
    const now = new Date().toISOString();
    const result = records.map((record, index) => ({ id: `record-${index}`, device: "e2e-device", ...record, time: record.time ?? now }));
    const variables = [...new Set(records.map((record) => record.variable))];
    globalThis.postMessage({
      widget: { id: "e2e-widget", display: {}, data: [{ origin: "e2e-device", variables }] },
      userInformation: { custom_preferences: customPreferences },
      realtime: [{ data: { origin: "e2e-device", variable: variables }, result }],
    }, "*");
  }, { records, customPreferences });
