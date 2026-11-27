import process from "node:process";
import { expect, test as setup } from "@playwright/test";
import { ADMIN_AUTH_FILE } from "../playwright.config.ts";

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}. Copy .env.example and export it before running.`);
  }
  return value;
};

setup("log in as TagoRUN admin", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByRole("textbox", { name: "Email" }).fill(requireEnv("E2E_ADMIN_EMAIL"));
  await page.getByRole("textbox", { name: "Password" }).fill(requireEnv("E2E_ADMIN_PASSWORD"));
  await page.getByRole("button", { name: "Continue" }).click();

  // exact: true matters. Before the dictionary loads, the link is named "#GLOBAL.ORGANIZATIONS#",
  // which a substring match would accept too early.
  await expect(page.getByRole("link", { name: "Organizations", exact: true })).toBeVisible();
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
