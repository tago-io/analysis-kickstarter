import { Analysis, Resources } from "@tago-io/sdk";

import { fetchDeviceList } from "../lib/fetch-device-list";

/**
 * Function to start the analysis and clear variables from devices of type organization
 * @param context
 * @param scope
 */
async function startAnalysis() {
  const deviceList = await fetchDeviceList({ tags: [{ key: "device_type", value: "organization" }] });

  for (const device of deviceList) {
    const result = await Resources.devices.deleteDeviceData(device.id, { variables: ["device_qty", "plan_usage"], qty: 9999 });
    console.debug(result);
  }
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}
