import { expect, type Locator, type Page } from "@playwright/test";

// Dashboard CRUD runs through Analyses, and Device Lists are not realtime (they poll roughly every 10 s),
// so results can take a while to show up.
export const ANALYSIS_TIMEOUT = 30_000;

export const deviceList = (page: Page, title: string) => page.getByTestId(/^grid-widget-/).filter({ hasText: title });

// The Device List renders one DOM tree per column (no table rows), so we address columns by header.
export const listColumn = (list: Locator, header: string) => list.getByTestId("device-list-column").filter({ has: list.page().getByText(header, { exact: true }) });

export const nameCell = (list: Locator, name: string) => listColumn(list, "Name").getByText(name, { exact: true });

// Filtering by name leaves a single row, so the View and Controls columns hold only that row's items.
export const filterByName = async (list: Locator, name: string) => {
  const showSearch = list.getByRole("button", { name: "Show search" });
  const searchBox = listColumn(list, "Name").getByRole("textbox", { name: "search" });
  // Wait for the list to render before checking whether the search row is collapsed.
  await expect(showSearch.or(searchBox).first()).toBeVisible();
  if (await showSearch.isVisible()) {
    await showSearch.click();
  }
  await searchBox.fill(name);
  await expect(nameCell(list, name)).toBeVisible();
};

const rowButton = (list: Locator, action: "edit" | "delete") => listColumn(list, "Controls").getByRole("button").nth(action === "edit" ? 0 : 1);

// The View column links to the next dashboard (Organization -> Groups -> Sensors).
export const openRowView = async (list: Locator, name: string) => {
  await filterByName(list, name);
  await listColumn(list, "View").getByRole("link").click();
  // Wait until the navigation leaves this dashboard, so the next step doesn't act on the old page.
  await expect(list).toBeHidden();
};

// Header buttons open a form in a dialog named after the button. Forms keep old values and messages
// (clear_form is off), so callers load the page fresh before each submit.
export const submitCreateForm = async (list: Locator, button: string, fill: (dialog: Locator) => Promise<void>, expectedMessage: string) => {
  await list.getByRole("button", { name: button }).click();
  const dialog = list.page().getByRole("dialog", { name: button });
  await fill(dialog);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog.getByText(expectedMessage)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
  await dialog.getByRole("button", { name: "Close" }).click();
};

// The address field geocodes as you type, so it needs real key events, then a picked suggestion.
export const ADDRESS_QUERY = "150 Fayetteville St, Raleigh";

export const pickAddress = async (dialog: Locator) => {
  await dialog.getByPlaceholder("drag the pin over the map or type in an address").pressSequentially(ADDRESS_QUERY);
  await dialog.page().getByTestId("selector-options-item").first().click();
};

// The widget saves the new name itself; the Analysis validates afterwards and may revert it.
export const renameRow = async (list: Locator, currentName: string, newName: string) => {
  const page = list.page();
  await filterByName(list, currentName);
  await rowButton(list, "edit").click();

  const editModal = page.getByTestId("modal-card").filter({ has: page.getByRole("heading", { name: "Editing" }) });
  await expect(editModal).toBeVisible();
  // The modal can open before it loads the stored address, and Save is blocked while that required field
  // is empty. Sensors have no address, so the check only runs when the field exists.
  const addressField = editModal.getByTestId("formgroup-container").filter({ hasText: "Address" }).getByRole("textbox");
  if (await addressField.count() > 0) {
    await expect(addressField).not.toHaveValue("");
  }
  await editModal.getByTestId("formgroup-container").filter({ hasText: "Name" }).getByRole("textbox").fill(newName);
  await editModal.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Successfully edited!")).toBeVisible();
};

export const deleteRow = async (list: Locator, name: string) => {
  await filterByName(list, name);
  await rowButton(list, "delete").click();

  await list.page().getByTestId("modal-card").filter({ hasText: "Are you sure?" }).getByRole("button", { name: "Confirm" }).click();
  await expect(nameCell(list, name)).toHaveCount(0, { timeout: ANALYSIS_TIMEOUT });
};
