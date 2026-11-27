import { expect, type Locator, type Page, test } from "@playwright/test";
import { ANALYSIS_TIMEOUT, deleteRow, filterByName, listColumn, nameCell, renameRow } from "./helpers/device-list.ts";
import {
  createGroup,
  createOrganizationAndOpenGroups,
  createSensor,
  euiFrom,
  groupList,
  openSensors,
  sensorList,
  submitGroupForm,
  submitSensorForm,
} from "./helpers/groups-sensors.ts";
import { deleteOrganization, deleteOrganizationsLeftByFailure } from "./helpers/organizations.ts";
import { customWidgetFrame } from "./helpers/custom-widgets.ts";

// Follows the user's path: Organization -> View -> Groups -> View -> Sensors, covering the
// "CRUD Group" and "CRUD Sensor" Analyses.

// Each test creates, walks through and deletes three levels of devices, which takes longer than the global timeout.
test.describe.configure({ timeout: 240_000 });

// Deleting the organization cascades to its groups and sensors, so one delete cleans up a failed test.
test.afterEach(deleteOrganizationsLeftByFailure);

// Sensor Status is a custom widget, so its content lives in a cross-origin iframe. The Analysis
// recalculates "Registered" on every sensor create and delete.
const expectRegisteredSensors = async (page: Page, count: RegExp) => {
  const sensorStatus = customWidgetFrame(page, "sensor-status");
  const registered = sensorStatus.getByTestId("registered").getByTestId("gauge-value");
  await expect(registered).toHaveText(new RegExp(`^${count.source}$`), { timeout: ANALYSIS_TIMEOUT });
};

const expectRowCount = (list: Locator, text: string) => expect(list.getByText(text, { exact: true })).toBeVisible();

test("Admin builds an organization, group and sensor, then removes them", async ({ page }) => {
  const stamp = Date.now();
  const organizationName = `E2E Org ${stamp}`;
  const groupName = `E2E Group ${stamp}`;
  const editedGroupName = `${groupName} edited`;
  const sensor = { name: `E2E Sensor ${stamp}`, eui: euiFrom(stamp).toUpperCase() };
  const editedSensorName = `${sensor.name} edited`;
  let groupsUrl = "";

  await test.step("organization View opens its Groups", async () => {
    groupsUrl = await createOrganizationAndOpenGroups(page, organizationName);
    await expectRowCount(groupList(page), "0 Group(s)");
  });

  await test.step("create group with address", async () => {
    await createGroup(page, groupName);
    await filterByName(groupList(page), groupName);
    await expect(listColumn(groupList(page), "Address")).toContainText("Fayetteville St");
  });

  await test.step("rename group", async () => {
    await renameRow(groupList(page), groupName, editedGroupName);
    await page.reload();
    await expect(nameCell(groupList(page), editedGroupName)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
  });

  await test.step("group View opens its Sensors", async () => {
    await openSensors(page, editedGroupName);
    await expectRowCount(sensorList(page), "0 Sensor(s)");
    await expectRegisteredSensors(page, /(N\/A|0)/);
  });

  await test.step("create sensor", async () => {
    await createSensor(page, sensor);
    const list = sensorList(page);
    await filterByName(list, sensor.name);
    await expect(listColumn(list, "EUI")).toContainText(sensor.eui);
    await expect(listColumn(list, "Network")).toContainText("Simulator");
    await expect(listColumn(list, "Model")).toContainText("Freezer Simulator");
    await expectRegisteredSensors(page, /1/);
  });

  await test.step("rename sensor", async () => {
    await renameRow(sensorList(page), sensor.name, editedSensorName);
    await page.reload();
    await expect(nameCell(sensorList(page), editedSensorName)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
  });

  await test.step("delete sensor", async () => {
    await deleteRow(sensorList(page), editedSensorName);
    await expectRegisteredSensors(page, /0/);
  });

  await test.step("delete group", async () => {
    await page.goto(groupsUrl);
    await deleteRow(groupList(page), editedGroupName);
  });

  await test.step("delete organization", () => deleteOrganization(page, organizationName));
});

test("Group rules reject duplicate names", async ({ page }) => {
  const stamp = Date.now();
  const takenName = `E2E Group ${stamp} A`;
  const originalName = `E2E Group ${stamp} B`;

  await test.step("create two groups", async () => {
    await createOrganizationAndOpenGroups(page, `E2E Org ${stamp}`);
    await createGroup(page, takenName);
    await createGroup(page, originalName);
  });

  await test.step("create with a name already in use is rejected", async () => {
    await submitGroupForm(page, takenName, `A group with name ${takenName} already exists within this organization.`);
    await page.reload();
    await expectRowCount(groupList(page), "2 Group(s)");
  });

  await test.step("rename to a name already in use is reverted", async () => {
    await renameRow(groupList(page), originalName, takenName);
    await expect(page.getByText(`A group with name ${takenName} already exists within this organization.`)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
    await page.reload();
    await expect(nameCell(groupList(page), originalName)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
    await expect(nameCell(groupList(page), takenName)).toHaveCount(1);
  });

  await test.step("clean up", () => deleteOrganization(page, `E2E Org ${stamp}`));
});

test("Sensor create validates the EUI and rejects duplicates", async ({ page }) => {
  const stamp = Date.now();
  const organizationName = `E2E Org ${stamp}`;
  const groupName = `E2E Group ${stamp}`;
  const first = { name: `E2E Sensor ${stamp} S1`, eui: euiFrom(stamp).toUpperCase() };
  const second = { name: `E2E Sensor ${stamp} S2`, eui: euiFrom(stamp + 1) };
  const unusedEui = euiFrom(stamp + 2);

  await test.step("create organization, group and first sensor", async () => {
    await createOrganizationAndOpenGroups(page, organizationName);
    await createGroup(page, groupName);
    await openSensors(page, groupName);
    await createSensor(page, first);
  });

  const invalidEuis = [
    { label: "too short", eui: unusedEui.slice(1) },
    { label: "too long", eui: `${unusedEui}a` },
    { label: "non-hex character", eui: `${unusedEui.slice(1)}G` },
    { label: "with separators", eui: "00-11-22-33-44-55-66-77" },
  ];
  for (const { label, eui } of invalidEuis) {
    await test.step(`EUI ${label} is rejected`, () => submitSensorForm(page, { name: `E2E Sensor ${stamp} X`, eui }, "EUI must be 16 hexadecimal characters"));
  }

  // The form blocks an empty required field before the Analysis runs. The QR Code field reports it as
  // "Invalid QR Code", even when nothing was scanned.
  await test.step("empty EUI is rejected", () => submitSensorForm(page, { name: `E2E Sensor ${stamp} X`, eui: "" }, "Invalid QR Code"));

  await test.step("no sensor was created by the rejected attempts", async () => {
    await page.reload();
    await expectRowCount(sensorList(page), "1 Sensor(s)");
  });

  await test.step("lowercase EUI is accepted", () => createSensor(page, second));

  await test.step("duplicate name in the group is rejected", () =>
    submitSensorForm(page, { name: first.name, eui: unusedEui }, `A sensor with name ${first.name} already exists within this group.`));

  await test.step("duplicate EUI is rejected", () => submitSensorForm(page, { name: `E2E Sensor ${stamp} X`, eui: first.eui }, `A sensor with EUI ${first.eui} already exists`));

  await test.step("duplicate EUI in a different letter case is rejected", () =>
    submitSensorForm(page, { name: `E2E Sensor ${stamp} Y`, eui: first.eui.toLowerCase() }, `A sensor with EUI ${first.eui.toLowerCase()} already exists`));

  await test.step("rename to a name already in use is reverted", async () => {
    await renameRow(sensorList(page), second.name, first.name);
    await expect(page.getByText(`A sensor with name ${first.name} already exists within this group.`)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
    await page.reload();
    await expect(nameCell(sensorList(page), second.name)).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
    await expect(nameCell(sensorList(page), first.name)).toHaveCount(1);
    // Only S1 and S2 exist: none of the rejected attempts created a sensor.
    await expectRowCount(sensorList(page), "2 Sensor(s)");
  });

  await test.step("clean up", () => deleteOrganization(page, organizationName));
});
