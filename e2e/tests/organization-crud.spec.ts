import { expect, type Page, test } from "@playwright/test";
import { ANALYSIS_TIMEOUT, nameCell, renameRow } from "./helpers/device-list.ts";
import { createOrganization, deleteOrganization, deleteOrganizationsLeftByFailure, organizationList, renameOrganization } from "./helpers/organizations.ts";

// Covers the "CRUD Organization" Analysis round trip, plus the Organization List refresh.

test.afterEach(deleteOrganizationsLeftByFailure);

// The map pins come from the organization_address rows the Analysis writes, and each pin's infobox
// shows the organization name. A visible infobox means the address was geocoded and plotted.
const expectOrganizationOnMap = async (page: Page, name: string) => {
  await organizationList(page).getByRole("button", { name: "Map View" }).click();
  const map = page.getByRole("dialog", { name: "Map" });
  await expect(map.getByText(name, { exact: true })).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
  // exact: true, because each Leaflet infobox also has a "Close popup" button.
  await map.getByRole("button", { name: "Close", exact: true }).click();
};

test("Admin creates, renames, and deletes an organization", async ({ page }) => {
  const name = `E2E Org ${Date.now()}`;
  const editedName = `${name} edited`;

  await test.step("create", () => createOrganization(page, name));
  await test.step("address shows on the map", () => expectOrganizationOnMap(page, name));

  await test.step("rename", async () => {
    await renameOrganization(page, name, editedName);
    // Reload so the check reads stored data, not the widget's optimistic update.
    await page.reload();
    await expect(nameCell(organizationList(page), editedName)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
  });
  await test.step("map follows the new name", () => expectOrganizationOnMap(page, editedName));

  await test.step("delete", () => deleteOrganization(page, editedName));
});

test("Renaming to a name already in use is reverted with a notification", async ({ page }) => {
  const stamp = Date.now();
  const takenName = `E2E Org ${stamp} A`;
  const originalName = `E2E Org ${stamp} B`;
  const list = organizationList(page);

  await test.step("create two organizations", async () => {
    await createOrganization(page, takenName);
    await createOrganization(page, originalName);
  });

  await test.step("rename B to A's name", async () => {
    await renameRow(list, originalName, takenName);
    await expect(page.getByText(`An organization with name ${takenName} already exists.`)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
  });

  await test.step("original name is restored", async () => {
    await page.reload();
    await expect(nameCell(list, originalName)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
    await expect(nameCell(list, takenName)).toHaveCount(1);
  });

  await test.step("clean up", async () => {
    await deleteOrganization(page, originalName);
    await deleteOrganization(page, takenName);
  });
});
