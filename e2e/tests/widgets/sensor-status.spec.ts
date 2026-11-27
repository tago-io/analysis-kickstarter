import { expect, type Page, test } from "@playwright/test";
import { openWidget, sendWidgetData } from "./harness.ts";

// Sensor Status reads the group's device_connectivity_summary record, which the CRUD Sensor and
// Check Inactive Sensors Analyses keep up to date.

const gaugeValue = (page: Page, card: "registered" | "online" | "offline") => page.getByTestId(card).getByTestId("gauge-value");

const summary = (counts: { registered: number; online: number; offline: number }) => ({
  variable: "device_connectivity_summary",
  value: counts.registered,
  metadata: { total_registered: counts.registered, online: counts.online, offline: counts.offline },
});

test.beforeEach(({ page }) => openWidget(page, "sensor-status"));

test("shows N/A while the group has no summary yet", async ({ page }) => {
  await sendWidgetData(page, []);

  await expect(gaugeValue(page, "registered")).toHaveText("N/A");
  await expect(gaugeValue(page, "online")).toHaveText("N/A");
  await expect(gaugeValue(page, "offline")).toHaveText("N/A");
});

test("shows registered, online and offline counts", async ({ page }) => {
  await sendWidgetData(page, [summary({ registered: 3, online: 2, offline: 1 })]);

  await expect(gaugeValue(page, "registered")).toHaveText("3");
  await expect(gaugeValue(page, "online")).toHaveText("2");
  await expect(gaugeValue(page, "offline")).toHaveText("1");
});

test("updates when a new summary arrives in realtime", async ({ page }) => {
  await sendWidgetData(page, [summary({ registered: 3, online: 2, offline: 1 })]);
  await expect(gaugeValue(page, "registered")).toHaveText("3");

  await sendWidgetData(page, [summary({ registered: 4, online: 4, offline: 0 })]);

  await expect(gaugeValue(page, "registered")).toHaveText("4");
  await expect(gaugeValue(page, "online")).toHaveText("4");
  await expect(gaugeValue(page, "offline")).toHaveText("0");
});
