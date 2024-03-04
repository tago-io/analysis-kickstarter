/*
 * KickStarter Analysis
 * Data Retention Updater
 *
 * This analysis gets all sensors in the application and make sure bucket data retention is set properly.
 */

import { Analysis, Resources } from "@tago-io/sdk";
import { DeviceListItem } from "@tago-io/sdk/lib/types";

import { fetchDeviceList } from "../lib/fetch-device-list";

/**
 * Function that resolves the data retention of the organization
 * @param org_id Organization ID to resolve the data retention
 */
async function resolveDataRetentionByOrg(org_id: string) {
  const device_list: DeviceListItem[] = await fetchDeviceList({
    tags: [
      { key: "device_type", value: "device" },
      { key: "organization_id", value: org_id },
    ],
  });

  for (const device_obj of device_list) {
    // @ts-ignore: Unreachable code error
    if (!device_obj.bucket) {
      return;
    }

    const bucket_variables = await Resources.buckets.listVariables(device_obj.bucket.id);
    if (!bucket_variables[0]) {
      return;
    }

    const bucket_vars = bucket_variables.map((v) => v.variable);
    const data_retention_ignore = bucket_vars
      .map((r) => {
        if (!r.includes("action")) {
          return null;
        }
        return r;
      })
      .filter((x) => x);
    // @ts-ignore: Unreachable code error
    await Resources.buckets.edit(device_obj.bucket.id, { data_retention_ignore });
  }
}

/**
 * Function that updates the data retention of the application
 */
async function updateDataRetention() {
  console.debug("Running");

  const organization_list: DeviceListItem[] = await fetchDeviceList({ tags: [{ key: "device_type", value: "organization" }] });

  for (const org of organization_list) {
    const org_id = org.id;
    const org_param_list = await Resources.devices.paramList(org_id);
    const plan_data_retention = org_param_list.find((x) => x.key === "plan_data_retention")?.value || "";

    if (plan_data_retention !== "") {
      await resolveDataRetentionByOrg(org_id);
    }
  }

  console.debug("success");
}

/**
 * Function that starts the analysis
 */
async function startAnalysis() {
  await updateDataRetention()
    .then(() => {
      console.debug("Script end.");
    })
    .catch((error) => {
      console.debug(error);
      console.debug(error.message || JSON.stringify(error));
    });
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
