import { expect, test } from "@playwright/test";
import { coldRoomsSearchBox, groupSection, searchColdRooms, sensorCard } from "../helpers/custom-widgets.ts";
import { openWidget, sendWidgetData, type WidgetRecord } from "./harness.ts";

// Cold Room cards: one card per sensor, grouped by group, built from the cold_room_card_data rows
// the Uplink Handler Analysis writes on the organization device.

const card = (sensor: string, group: string, reading: { temperatureF: number; compressor: string; door: string }): WidgetRecord => ({
  variable: "cold_room_card_data",
  value: reading.temperatureF,
  group: `${sensor}-id`,
  metadata: {
    sensor_name: sensor,
    group_id: `${group}-id`,
    group_name: group,
    temperature_fahrenheit: reading.temperatureF,
    compressor_status: reading.compressor,
    door_status: reading.door,
  },
});

const CARDS = [
  card("Freezer 1", "Kitchen", { temperatureF: 10, compressor: "on", door: "closed" }),
  card("Freezer 2", "Kitchen", { temperatureF: 50, compressor: "off", door: "open" }),
  card("Freezer 3", "Warehouse", { temperatureF: 5, compressor: "on", door: "closed" }),
];

test.beforeEach(({ page }) => openWidget(page, "cold-room-card-data"));

test("groups sensor cards by group, with their readings", async ({ page }) => {
  await sendWidgetData(page, CARDS);

  await expect(groupSection(page, "Kitchen").getByTestId("sensor-card")).toHaveCount(2);
  await expect(groupSection(page, "Kitchen")).toContainText("2 sensors");
  await expect(groupSection(page, "Warehouse").getByTestId("sensor-card")).toHaveCount(1);

  const openFreezer = sensorCard(page, "Freezer 2");
  await expect(openFreezer.getByTestId("temperature")).toHaveText("50.0°F");
  await expect(openFreezer.getByTestId("compressor")).toHaveText("OFF");
  await expect(openFreezer.getByTestId("door")).toHaveText("OPEN");
});

test("lists sensors in alert first inside a group", async ({ page }) => {
  await sendWidgetData(page, CARDS);

  // Freezer 2 is warm and has its door open, so it comes before Freezer 1 despite the name order.
  await expect(groupSection(page, "Kitchen").getByRole("heading", { level: 3 })).toHaveText(["Freezer 2", "Freezer 1"]);
});

test("shows temperatures in °C when the user prefers it", async ({ page }) => {
  await sendWidgetData(page, CARDS, { temperature_unit: "°C" });

  await expect(sensorCard(page, "Freezer 2").getByTestId("temperature")).toHaveText("10.0°C");
});

test("search matches sensor and group names", async ({ page }) => {
  await sendWidgetData(page, CARDS);

  await searchColdRooms(page, "freezer 3");
  await expect(page.getByTestId("sensor-card")).toHaveCount(1);
  await expect(sensorCard(page, "Freezer 3")).toBeVisible();

  await coldRoomsSearchBox(page).fill("kitchen");
  await expect(page.getByTestId("sensor-card")).toHaveCount(2);
});

test("search without matches says so", async ({ page }) => {
  await sendWidgetData(page, CARDS);

  await searchColdRooms(page, "basement");
  await expect(page.getByText('No sensors match "basement".')).toBeVisible();
});

test("group filter hides unselected groups", async ({ page }) => {
  await sendWidgetData(page, CARDS);

  await page.getByRole("button", { name: "Filter by group" }).click();
  await page.getByRole("checkbox", { name: /Warehouse/ }).uncheck();
  await expect(groupSection(page, "Warehouse")).toHaveCount(0);
  await expect(groupSection(page, "Kitchen")).toBeVisible();

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByText("No groups selected.")).toBeVisible();
});

test("shows the empty state when no sensor has reported", async ({ page }) => {
  await sendWidgetData(page, []);

  await expect(page.getByText("No data")).toBeVisible();
});
