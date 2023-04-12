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

import { Utils, Services, Account, Device, Analysis, Types } from "@tago-io/sdk";
import { DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import { fetchDeviceList } from "../lib/fetchDeviceList";

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
export default new Analysis(startAnalysis, { token: "5e190938-6fe1-4f0a-b680-d99a2b94cc47" });
