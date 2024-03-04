/*
 * KickStarter Analysis
 * Monthly Usage Reset
 *
 * This analysis will reset the monthly usage of SMS and Email from all clients.
 *
 * How it works:
 * - The action "[TagoIO] - Monthly plan reset trigger" will trigger this analysis on the first day of each month at 00:00 UTC.
 * - Organization's SMS and Email usage will be reset to 0.
 */

import { Analysis, Resources } from "@tago-io/sdk";
import { DeviceListItem } from "@tago-io/sdk/lib/types";

import { fetchDeviceList } from "../lib/fetch-device-list";

/**
 * Function that initializes the analysis
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 */
async function init(): Promise<void> {
  console.debug("Monthly usage reset analysis started");

  const org_list: DeviceListItem[] = await fetchDeviceList({ tags: [{ key: "device_type", value: "organization" }] });

  for (const org of org_list) {
    const org_params = await Resources.devices.paramList(org.id);

    const plan_email_limit_usage = org_params.find((x) => x.key === "plan_email_limit_usage") || { key: "plan_email_limit_usage", value: "0", sent: false };
    const plan_sms_limit_usage = org_params.find((x) => x.key === "plan_sms_limit_usage") || { key: "plan_sms_limit_usage", value: "0", sent: false };
    const plan_notif_limit_usage = org_params.find((x) => x.key === "plan_notif_limit_usage") || { key: "plan_notif_limit_usage", value: "0", sent: false };

    await Resources.devices.paramSet(org.id, { ...plan_email_limit_usage, value: "0", sent: false });
    await Resources.devices.paramSet(org.id, { ...plan_sms_limit_usage, value: "0", sent: false });
    await Resources.devices.paramSet(org.id, { ...plan_notif_limit_usage, value: "0", sent: false });
  }

  return console.debug("Analysis finished successfuly!");
}

if (!process.env.T_TEST) {
  Analysis.use(init, { token: process.env.T_ANALYSIS_TOKEN });
}

export { init };
