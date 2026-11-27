import { expect, type Page, type TestInfo } from "@playwright/test";
import { ANALYSIS_TIMEOUT, deleteRow, deviceList, nameCell, pickAddress, renameRow, submitCreateForm } from "./device-list.ts";

// Sidebar items sit inside a drag-and-drop wrapper with aria-disabled="true", which Playwright treats as
// disabled for click(). Navigating to the link's href keeps the test independent of dashboard IDs.
// A fresh load also resets the Create form, which keeps old values and messages (clear_form is off).
export const openOrganizations = async (page: Page) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "Organizations", exact: true });
  await page.goto((await link.getAttribute("href")) ?? "");
};

export const organizationList = (page: Page) => deviceList(page, "Organization List");

// Organizations created by the current test and not deleted yet, for cleanup after a failure.
const pendingOrganizations = new Set<string>();

export const createOrganization = async (page: Page, name: string) => {
  await openOrganizations(page);
  const list = organizationList(page);
  await submitCreateForm(list, "Create Organization", async (dialog) => {
    await dialog.getByPlaceholder("e.g. TagoIo").fill(name);
    await pickAddress(dialog);
  }, "Organization successfully created!");
  pendingOrganizations.add(name);
  await expect(nameCell(list, name)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
};

// For renames the Analysis accepts: cleanup after a failure then looks for the new name.
export const renameOrganization = async (page: Page, name: string, newName: string) => {
  await renameRow(organizationList(page), name, newName);
  pendingOrganizations.delete(name);
  pendingOrganizations.add(newName);
};

// Deleting an organization also deletes its groups and sensors (see crud-organization.ts).
export const deleteOrganization = async (page: Page, name: string) => {
  await openOrganizations(page);
  await deleteRow(organizationList(page), name);
  pendingOrganizations.delete(name);
};

// Use as test.afterEach. A test that fails midway leaves its organizations behind; deleting them
// through the UI lets the Analysis cascade to groups and sensors. Renames go through
// renameOrganization, so the list holds the current name.
export const deleteOrganizationsLeftByFailure = async ({ page }: { page: Page }, testInfo: TestInfo) => {
  const leftovers = [...pendingOrganizations];
  pendingOrganizations.clear();
  if (testInfo.status === testInfo.expectedStatus || leftovers.length === 0) {
    return;
  }
  // Hooks share the test's timeout, which a late failure may have used up.
  testInfo.setTimeout(testInfo.timeout + 60_000 * leftovers.length);
  for (const name of leftovers) {
    await deleteOrganization(page, name).catch((error) => console.log(`[cleanup] Could not delete ${name}: ${error}`));
  }
};
