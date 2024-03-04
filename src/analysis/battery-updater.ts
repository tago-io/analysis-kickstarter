/*
 * KickStarter Analysis
 * Battery Updater
 *
 * This analysis is responsible to
 * update sensor's last checkin parameter.
 *
 * Battery Updater will run when:
 * - When the scheduled action (Battery Updater Trigger) triggers this script. (Default 1 day)
 */

import { Analysis, Resources } from "@tago-io/sdk";

import { fetchDeviceList } from "../lib/fetch-device-list";

async function resolveDevice(org_id: string, device_id: string) {
  if (!org_id || !device_id) {
    throw "Missing Router parameter";
  }

  const device_params = await Resources.devices.paramList(device_id);
  const dev_battery_param = device_params.find((param) => param.key === "dev_battery") || { key: "dev_battery", value: "N/A", sent: false };

  const [dev_battery] = await Resources.devices.getDeviceData(device_id, { variables: ["bat", "battery_capacity"], qty: 1 });

  if (dev_battery?.value) {
    await Resources.devices.paramSet(device_id, { ...dev_battery_param, value: String(dev_battery.value) });
  }
}

async function startAnalysis() {
  console.debug("Running Analysis");

  try {
    const sensorList = await fetchDeviceList({ tags: [{ key: "device_type", value: "device" }] });

    sensorList.map((device) =>
      resolveDevice(device.tags.find((tag) => tag.key === "organization_id")?.value as string, device.tags.find((tag) => tag.key === "device_id")?.value as string)
    );

    console.debug("Analysis finished");
  } catch (error) {
    console.debug(error);
    console.debug(error.message || JSON.stringify(error));
  }
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
