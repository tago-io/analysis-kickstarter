import type { FrameLocator, Page } from "@playwright/test";
import type { WidgetName } from "../widgets/harness.ts";

// Locators for the content of the repo's custom widgets. They take the widget root: the page itself in
// the isolated widget tests, or the widget's iframe in TagoRUN.
type WidgetRoot = Page | FrameLocator;

export const customWidgetFrame = (page: Page, name: WidgetName) => page.locator(`iframe[src*="${name}"]`).contentFrame();

// Cold Room Monitor: one card per reading.
export type MonitorCard = "temperature" | "compressor" | "door";

export const monitorValue = (root: WidgetRoot, card: MonitorCard) => root.getByTestId(card).getByTestId("ring-value");
export const monitorTime = (root: WidgetRoot, card: MonitorCard) => root.getByTestId(card).getByTestId("ring-time");

// Cold Rooms: one card per sensor, grouped by group.
export const groupSection = (root: WidgetRoot, group: string) => root.getByTestId("group-section").filter({ has: root.getByRole("heading", { name: group, exact: true }) });

export const sensorCard = (root: WidgetRoot, sensor: string) => root.getByTestId("sensor-card").filter({ has: root.getByRole("heading", { name: sensor, exact: true }) });

export const coldRoomsSearchBox = (root: WidgetRoot) => root.getByRole("textbox", { name: "Search sensors or groups by name" });

export const searchColdRooms = async (root: WidgetRoot, query: string) => {
  await root.getByRole("button", { name: "Open search" }).click();
  await coldRoomsSearchBox(root).fill(query);
};
