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
 */

import { Utils, Services, Account, Device, Analysis, Types } from "@tago-io/sdk";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";

async function resolveDataRetentionByOrg(account: Account, org_id: string, plan_data_retention: string) {
  const device_list = await account.devices.list({
    page: 1,
    fields: ["id", "bucket", "tags"],
    filter: {
      tags: [
        { key: "device_type", value: "device" },
        { key: "organization_id", value: org_id },
      ],
    },
    amount: 10000,
  });

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
  context.log("Running");
  const env_vars = Utils.envToJson(context.environment);
  if (!env_vars.account_token) {
    throw context.log("Missing account_token in the environment variables");
  }
  if (!env_vars.config_token) {
    throw context.log("Missing config_token in the environment variables");
  }

  const account = new Account({ token: env_vars.account_token });

  const organization_list = await account.devices.list({
    page: 1,
    fields: ["id", "bucket", "tags"],
    filter: {
      tags: [{ key: "device_type", value: "organization" }],
    },
    amount: 10000,
  });

  for (const org of organization_list) {
    const org_id = org.id;
    const org_param_list = await account.devices.paramList(org_id);
    const plan_data_retention = org_param_list.find((x) => x.key === "plan_data_retention")?.value || "";

    if (plan_data_retention !== "") {
      await resolveDataRetentionByOrg(account, org_id, plan_data_retention);
    }
  }

  context.log("success");
}

async function startAnalysis(context: TagoContext, scope: any) {
  await updateDataRetention(context)
    .then(() => {
      context.log("Script end.");
    })
    .catch((e) => {
      console.log(e);
      context.log(e.message || JSON.stringify(e));
    });
}
export default new Analysis(startAnalysis, { token: "5e190938-6fe1-4f0a-b680-d99a2b94cc47" });
