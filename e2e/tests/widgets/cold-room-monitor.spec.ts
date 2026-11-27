import { expect, test } from "@playwright/test";
import { monitorTime, monitorValue } from "../helpers/custom-widgets.ts";
import { minutesAgo, openWidget, sendWidgetData, type WidgetRecord } from "./harness.ts";

// Cold Room Monitor shows a freezer sensor's latest temperature, compressor and door readings.

const readings = (values: { temperature: number; compressor: string; door: string }, time?: string): WidgetRecord[] => [
  { variable: "temperature", value: values.temperature, unit: "°F", time },
  { variable: "compressor", value: values.compressor, time },
  { variable: "door", value: values.door, time },
];

test.beforeEach(({ page }) => openWidget(page, "cold-room-monitor"));

test("shows the latest readings in °F by default", async ({ page }) => {
  await sendWidgetData(page, readings({ temperature: 50, compressor: "on", door: "closed" }));

  await expect(monitorValue(page, "temperature")).toHaveText("50.0°F");
  await expect(monitorValue(page, "compressor")).toHaveText("ON");
  await expect(monitorValue(page, "door")).toHaveText("CLOSED");
});

test("converts the temperature when the user prefers °C", async ({ page }) => {
  await sendWidgetData(page, readings({ temperature: 50, compressor: "off", door: "open" }), { temperature_unit: "°C" });

  await expect(monitorValue(page, "temperature")).toHaveText("10.0°C");
  await expect(monitorValue(page, "compressor")).toHaveText("OFF");
  await expect(monitorValue(page, "door")).toHaveText("OPEN");
});

test("shows N/A when the sensor has not reported yet", async ({ page }) => {
  await sendWidgetData(page, []);

  for (const card of ["temperature", "compressor", "door"] as const) {
    await expect(monitorValue(page, card)).toHaveText("N/A");
  }
});

test("shows how long ago each reading arrived", async ({ page }) => {
  // The widget's clock ticks every 30 s from mount, so a reading exactly 5 min old can still read "4m";
  // 5.5 min keeps the check away from that edge.
  await sendWidgetData(page, readings({ temperature: 10, compressor: "on", door: "closed" }, minutesAgo(5.5)));

  await expect(monitorTime(page, "temperature")).toHaveText("— 5m ago");
});
