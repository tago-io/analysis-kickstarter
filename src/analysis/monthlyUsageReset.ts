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
 * - account_token: the value must be a token from your profile. generated at My Settings of your developer's account.
 */

import { Account, Device, Analysis, Utils } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";

async function init(context: TagoContext, scope: Data[]): Promise<void> {
  context.log("Monthly usage reset analysis started");
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

  const org_list = await account.devices.list({
    page: 1,
    fields: ["id", "name"],
    filter: {
      tags: [{ key: "device_type", value: "organization" }],
    },
    amount: 9999,
    resolveBucketName: false,
  });

  for (const org of org_list) {
    const org_params = await account.devices.paramList(org.id);

    const plan_email_limit_usage = org_params.find((x) => x.key === "plan_email_limit_usage") || { key: "plan_email_limit_usage", value: "0", sent: false };
    const plan_sms_limit_usage = org_params.find((x) => x.key === "plan_sms_limit_usage") || { key: "plan_sms_limit_usage", value: "0", sent: false };
    const plan_notif_limit_usage = org_params.find((x) => x.key === "plan_notif_limit_usage") || { key: "plan_notif_limit_usage", value: "0", sent: false };

    await account.devices.paramSet(org.id, { ...plan_email_limit_usage, value: "0", sent: false });
    await account.devices.paramSet(org.id, { ...plan_sms_limit_usage, value: "0", sent: false });
    await account.devices.paramSet(org.id, { ...plan_notif_limit_usage, value: "0", sent: false });
  }

  return context.log("Analysis finished successfuly!");
}

export default new Analysis(init, { token: "eb1b2ade-dd52-4216-866d-0dbce79d824f" });
