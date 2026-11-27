import { expect, type Page, test } from "@playwright/test";
import { coldRoomsSearchBox, customWidgetFrame, groupSection, monitorTime, monitorValue, searchColdRooms, sensorCard } from "./helpers/custom-widgets.ts";
import { ANALYSIS_TIMEOUT, deviceList, openRowView } from "./helpers/device-list.ts";
import { createGroup, createOrganizationAndOpenGroups, createSensor, euiFrom, openSensors, sensorIdFromList, sensorList } from "./helpers/groups-sensors.ts";
import { deleteOrganization, deleteOrganizationsLeftByFailure } from "./helpers/organizations.ts";
import { hasSeederToken, sendSensorReading } from "./helpers/sensor-readings.ts";

// Sends known readings to sensors the test creates and checks where they show up: the Freezer Dashboard
// and the Cold Rooms cards, which the Uplink Handler Analysis builds from each reading.

// The Simulator network also sends readings to every sensor, every 1 to 4 minutes, with 5 to 10 °F and the
// door closed. Values are checked right after sending, with the page already open, to keep the window
// where a Simulator reading can replace ours short.

test.skip(!hasSeederToken(), "E2E_TAGOIO_ANALYSIS_TOKEN is not set in e2e/.env");

// Creating the devices through the UI takes most of the time; the Cold Rooms test creates two groups and three sensors.
test.describe.configure({ timeout: 300_000 });

test.afterEach(deleteOrganizationsLeftByFailure);

// Outside the Simulator's range, so the checks can't pass on a Simulator reading.
const ALERT_READING = { temperatureF: 55, compressor: "off", door: "open" } as const;
const NORMAL_READING = { temperatureF: 12, compressor: "on", door: "closed" } as const;

const openColdRooms = async (page: Page, groupsUrl: string) => {
  await page.goto(groupsUrl);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Cold Rooms", exact: true }).click();
  return customWidgetFrame(page, "cold-room-card-data");
};

test("Freezer Dashboard shows the reading a sensor sends", async ({ page }) => {
  const stamp = Date.now();
  const organizationName = `E2E Org ${stamp}`;
  const groupName = `E2E Group ${stamp}`;
  const sensor = { name: `E2E Sensor ${stamp}`, eui: euiFrom(stamp) };
  let sensorId = "";

  await test.step("create organization, group and sensor", async () => {
    await createOrganizationAndOpenGroups(page, organizationName);
    await createGroup(page, groupName);
    await openSensors(page, groupName);
    await createSensor(page, sensor);
    sensorId = await sensorIdFromList(sensorList(page), sensor.name);
  });

  const monitor = customWidgetFrame(page, "cold-room-monitor");

  await test.step("sensor View opens its Freezer Dashboard", async () => {
    await openRowView(sensorList(page), sensor.name);
    await expect(monitorValue(monitor, "temperature")).toBeVisible();
  });

  await test.step("Cold Room Monitor shows the reading as it arrives", async () => {
    await sendSensorReading(sensorId, ALERT_READING);
    await expect(monitorValue(monitor, "temperature")).toHaveText("55.0°F", { timeout: ANALYSIS_TIMEOUT });
    await expect(monitorValue(monitor, "compressor")).toHaveText("OFF");
    await expect(monitorValue(monitor, "door")).toHaveText("OPEN");
    await expect(monitorTime(monitor, "temperature")).toHaveText(/^— (a few seconds|\d+s) ago$/);
  });

  const history = deviceList(page, "Sensor History");

  await test.step("Sensor History lists the reading", async () => {
    await expect(history.getByText("55.00 °F", { exact: true })).toBeVisible({ timeout: ANALYSIS_TIMEOUT });
  });

  // The chart draws on a canvas, so the test can only check that it renders, not the plotted values.
  await test.step("Temperature History chart opens", async () => {
    await history.getByRole("button", { name: "Temperature History" }).click();
    const chart = page.getByRole("dialog", { name: "Temperature History (last 24h)" });
    await expect(chart.locator("canvas")).toBeVisible();
    await chart.getByRole("button", { name: "Close" }).click();
  });

  await test.step("delete organization", () => deleteOrganization(page, organizationName));
});

test("Cold Rooms cards group the sensors and can be narrowed by search and group", async ({ page }) => {
  const stamp = Date.now();
  const organizationName = `E2E Org ${stamp}`;
  const groupA = `E2E Group ${stamp} A`;
  const groupB = `E2E Group ${stamp} B`;
  const a1 = { name: `E2E Sensor ${stamp} A1`, eui: euiFrom(stamp) };
  const a2 = { name: `E2E Sensor ${stamp} A2`, eui: euiFrom(stamp + 1) };
  const b1 = { name: `E2E Sensor ${stamp} B1`, eui: euiFrom(stamp + 2) };
  const sensorIds = new Map<string, string>();
  let groupsUrl = "";

  const createSensorAndKeepId = async (sensor: { name: string; eui: string }) => {
    await createSensor(page, sensor);
    sensorIds.set(sensor.name, await sensorIdFromList(sensorList(page), sensor.name));
  };

  await test.step("create two groups with sensors", async () => {
    groupsUrl = await createOrganizationAndOpenGroups(page, organizationName);
    await createGroup(page, groupA);
    await createGroup(page, groupB);
    await openSensors(page, groupA);
    await createSensorAndKeepId(a1);
    await createSensorAndKeepId(a2);
    await page.goto(groupsUrl);
    await openSensors(page, groupB);
    await createSensorAndKeepId(b1);
  });

  await test.step("each sensor's first reading creates its card", async () => {
    for (const id of sensorIds.values()) {
      await sendSensorReading(id, NORMAL_READING);
    }
  });

  const coldRooms = await openColdRooms(page, groupsUrl);

  await test.step("cards are grouped by group, in name order", async () => {
    await expect(groupSection(coldRooms, groupA).getByTestId("sensor-card")).toHaveCount(2, { timeout: ANALYSIS_TIMEOUT });
    await expect(groupSection(coldRooms, groupA)).toContainText("2 sensors");
    await expect(groupSection(coldRooms, groupB).getByTestId("sensor-card")).toHaveCount(1);
    await expect(groupSection(coldRooms, groupA).getByRole("heading", { level: 3 })).toHaveText([a1.name, a2.name]);
  });

  await test.step("a sensor in alert moves to the top of its group, with its reading", async () => {
    await sendSensorReading(sensorIds.get(a2.name) ?? "", ALERT_READING);
    await expect(groupSection(coldRooms, groupA).getByRole("heading", { level: 3 })).toHaveText([a2.name, a1.name], { timeout: ANALYSIS_TIMEOUT });
    const alertCard = sensorCard(coldRooms, a2.name);
    await expect(alertCard.getByTestId("temperature")).toHaveText("55.0°F");
    await expect(alertCard.getByTestId("compressor")).toHaveText("OFF");
    await expect(alertCard.getByTestId("door")).toHaveText("OPEN");
  });

  await test.step("search matches sensor and group names", async () => {
    await searchColdRooms(coldRooms, b1.name);
    await expect(coldRooms.getByTestId("sensor-card")).toHaveCount(1);
    await expect(sensorCard(coldRooms, b1.name)).toBeVisible();

    await coldRoomsSearchBox(coldRooms).fill(groupA);
    await expect(coldRooms.getByTestId("sensor-card")).toHaveCount(2);
    await expect(groupSection(coldRooms, groupB)).toHaveCount(0);

    await coldRoomsSearchBox(coldRooms).fill("no such sensor");
    await expect(coldRooms.getByText('No sensors match "no such sensor".')).toBeVisible();

    await coldRoomsSearchBox(coldRooms).fill("");
    await expect(coldRooms.getByTestId("sensor-card")).toHaveCount(3);
  });

  await test.step("group filter hides unselected groups", async () => {
    await coldRooms.getByRole("button", { name: "Filter by group" }).click();
    await coldRooms.getByRole("checkbox", { name: new RegExp(groupB) }).uncheck();
    await expect(groupSection(coldRooms, groupB)).toHaveCount(0);
    await expect(groupSection(coldRooms, groupA)).toBeVisible();

    await coldRooms.getByRole("button", { name: "Clear" }).click();
    await expect(coldRooms.getByText("No groups selected.")).toBeVisible();
  });

  await test.step("delete organization", () => deleteOrganization(page, organizationName));
});
