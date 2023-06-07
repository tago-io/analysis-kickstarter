/*
 * KickStarter Analysis
 * Data Retetion Updater
 *
 * This analysis gets all sensors in the application and make sure bucket data retention is set properly.
 *
 * How to setup this analysis
 * Make sure you have the following enviroment variables:
 * - config_token: the value must be a token from a HTTPs device, that stores general information of the application.
 * You also must have an action of type Schedule, and set this analysis to run each day (recommended).
 * - account_token: the value must be a token from your profile. See how to generate account-token at: https://help.tago.io/portal/en/kb/articles/495-account-token.
 */

import { Utils, Account, Analysis } from "@tago-io/sdk";
import { DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import { fetchDeviceList } from "../lib/fetchDeviceList";

/**
 * Function that resolves the data retention of the organization
 * @param account Account class
 * @param org_id Organization ID to resolve the data retention
 * @param plan_data_retention Data retention of the plan
 */
async function resolveDataRetentionByOrg(account: Account, org_id: string, plan_data_retention: string) {
  const device_list: DeviceListItem[] = await fetchDeviceList(account, [
    { key: "device_type", value: "device" },
    { key: "organization_id", value: org_id },
  ]);

  device_list.forEach(async (device_obj) => {
    // @ts-ignore: Unreachable code error
    await account.buckets.edit(device_obj.bucket, { data_retention: plan_data_retention === "0" ? "forever" : `${plan_data_retention} months` });

    const bucket_variables = await account.buckets.listVariables(device_obj.bucket);
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
    await account.buckets.edit(device_obj.bucket, { data_retention_ignore });
  });
}

/**
 * Function that updates the data retention of the application
 * @param context Context is a variable sent by the analysis
 */
async function updateDataRetention(context: TagoContext) {
  console.debug("Running");
  const env_vars = Utils.envToJson(context.environment);
  if (!env_vars.account_token) {
    throw console.debug("Missing account_token in the environment variables");
  }
  if (!env_vars.config_token) {
    throw console.debug("Missing config_token in the environment variables");
  }

  const account = new Account({ token: env_vars.account_token });

  const organization_list: DeviceListItem[] = await fetchDeviceList(account, [{ key: "device_type", value: "organization" }]);

  for (const org of organization_list) {
    const org_id = org.id;
    const org_param_list = await account.devices.paramList(org_id);
    const plan_data_retention = org_param_list.find((x) => x.key === "plan_data_retention")?.value || "";

    if (plan_data_retention !== "") {
      await resolveDataRetentionByOrg(account, org_id, plan_data_retention);
    }
  }

  console.debug("success");
}

/**
 * Function that starts the analysis
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 */
async function startAnalysis(context: TagoContext, scope: any) {
  await updateDataRetention(context)
    .then(() => {
      console.debug("Script end.");
    })
    .catch((e) => {
      console.debug(e);
      console.debug(e.message || JSON.stringify(e));
    });
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
