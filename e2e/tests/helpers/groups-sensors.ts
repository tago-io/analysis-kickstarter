import { expect, type Locator, type Page } from "@playwright/test";
import { ANALYSIS_TIMEOUT, deviceList, filterByName, listColumn, nameCell, openRowView, pickAddress, submitCreateForm } from "./device-list.ts";
import { createOrganization, organizationList } from "./organizations.ts";

// The user's path: Organization -> View -> Groups -> View -> Sensors -> View -> Freezer Dashboard.

export const groupList = (page: Page) => deviceList(page, "Group list");
export const sensorList = (page: Page) => deviceList(page, "Sensor List");

// EUIs are 16 hex characters and must be unique across the application. Padding with "a" keeps
// letters in every EUI, so the upper/lower case checks are meaningful.
export const euiFrom = (seed: number) => seed.toString(16).padStart(16, "a");

export const createOrganizationAndOpenGroups = async (page: Page, name: string) => {
  await createOrganization(page, name);
  await openRowView(organizationList(page), name);
  // Groups opens on the Cold Rooms tab; the Group List lives on Overview (?tab=1, kept on reload).
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Overview", exact: true }).click();
  await expect(groupList(page)).toBeVisible();
  return page.url();
};

// A fresh load resets the form, which keeps old values and messages (clear_form is off).
export const submitGroupForm = async (page: Page, name: string, expectedMessage: string) => {
  await page.reload();
  await submitCreateForm(groupList(page), "Create Group", async (dialog) => {
    await dialog.getByPlaceholder("e.g. TagoIo").fill(name);
    await pickAddress(dialog);
  }, expectedMessage);
};

export const createGroup = async (page: Page, name: string) => {
  await submitGroupForm(page, name, "Group successfully created!");
  await expect(nameCell(groupList(page), name)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
};

// The dashboard selectors can't confirm which org or group is open: they only show up when there is more
// than one option (blueprint "more_than_one"). Callers check that the new item's lists start empty instead.
export const openSensors = async (page: Page, groupName: string) => {
  await openRowView(groupList(page), groupName);
  await expect(sensorList(page)).toBeVisible();
};

export const submitSensorForm = async (page: Page, sensor: { name: string; eui: string }, expectedMessage: string) => {
  await page.reload();
  await submitCreateForm(sensorList(page), "Create Sensor", async (dialog) => {
    await dialog.getByPlaceholder("enter the device name").fill(sensor.name);
    // Network (Simulator) and Model (Freezer Simulator) come preselected.
    await dialog.getByPlaceholder("Type or scan - 16 hexadecimal characters").fill(sensor.eui);
  }, expectedMessage);
};

export const createSensor = async (page: Page, sensor: { name: string; eui: string }) => {
  await submitSensorForm(page, sensor, "Sensor successfully created!");
  await expect(nameCell(sensorList(page), sensor.name)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
};

// The sensor's View link opens its Freezer Dashboard and carries the sensor (device) id as sensor_dev.
export const sensorIdFromList = async (list: Locator, sensorName: string) => {
  await filterByName(list, sensorName);
  const href = await listColumn(list, "View").getByRole("link").getAttribute("href");
  const sensorId = new URL(href ?? "", "https://tago.run").searchParams.get("sensor_dev");
  expect(sensorId, `sensor_dev in the View link of ${sensorName}`).toMatch(/^[0-9a-f]{24}$/);
  return sensorId as string;
};
