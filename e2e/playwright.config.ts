import { existsSync } from "node:fs";
import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

// Tasks run from e2e/, so the .env path is relative to it.
const ENV_FILE = ".env";
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

export const ADMIN_AUTH_FILE = "playwright/.auth/admin.json";

export default defineConfig({
  testDir: "./tests",
  // Dashboard CRUD runs through Analyses on TagoIO, so UI updates arrive seconds after each action.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  // No retries on purpose: this POC wants to see real flakiness.
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    locale: "en-US",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1600, height: 900 },
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: /widgets\//,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 }, storageState: ADMIN_AUTH_FILE },
      dependencies: ["setup"],
    },
    // Custom widgets run on their own, from their build, with fixed data: no login and no TagoRUN.
    {
      name: "widgets",
      testDir: "./tests/widgets",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1200, height: 700 } },
    },
  ],
});
