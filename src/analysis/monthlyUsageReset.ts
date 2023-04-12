/*
 * KickStarter Analysis
 * Monthly Usage Reset
 *
 * This analysis will reset the monthly usage of SMS and Email from all clients.
 *
 * How it works:
 * - The action "[TagoIO] - Monthly plan reset trigger" will trigger this analysis on the first day of each month at 00:00 UTC.
 * - Organization's SMS and Email usage will be reset to 0.
 *
 * How to setup this analysis
 * Make sure you have the following enviroment variables:
 * - account_token: the value must be a token from your profile. See how to generate account-token at: https://help.tago.io/portal/en/kb/articles/495-account-token.
 */

import { Account, Device, Analysis, Utils } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import { fetchDeviceList } from "../lib/fetchDeviceList";

async function init(context: TagoContext, scope: Data[]): Promise<void> {
  console.debug("Monthly usage reset analysis started");
  // Convert the environment variables from [{ key, value }] to { key: value };
  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  }

  if (!environment.account_token) {
    throw "Missing account_token environment var";
  }
  // Instance the Account class
  const account = new Account({ token: environment.account_token });

  const org_list: DeviceListItem[] = await fetchDeviceList(account, [{ key: "device_type", value: "organization" }]);

  for (const org of org_list) {
    const org_params = await account.devices.paramList(org.id);

    const plan_email_limit_usage = org_params.find((x) => x.key === "plan_email_limit_usage") || { key: "plan_email_limit_usage", value: "0", sent: false };
    const plan_sms_limit_usage = org_params.find((x) => x.key === "plan_sms_limit_usage") || { key: "plan_sms_limit_usage", value: "0", sent: false };
    const plan_notif_limit_usage = org_params.find((x) => x.key === "plan_notif_limit_usage") || { key: "plan_notif_limit_usage", value: "0", sent: false };

    await account.devices.paramSet(org.id, { ...plan_email_limit_usage, value: "0", sent: false });
    await account.devices.paramSet(org.id, { ...plan_sms_limit_usage, value: "0", sent: false });
    await account.devices.paramSet(org.id, { ...plan_notif_limit_usage, value: "0", sent: false });
  }

  return console.debug("Analysis finished successfuly!");
}

export default new Analysis(init, { token: "6c73d99e-fbc2-43c7-a656-3a446f5c196d" });
