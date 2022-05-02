/*
 * KickStarter Analysis
 * User Signup
 *
 * This analysis handles new users that register themselves in the application. It requires the RUN to have user auto-signup enabled.
 *
 *
 * How to setup this analysis
 * Make sure you have the following enviroment variables:
 * - config_token: the value must be a token from a HTTPs device, that stores general information of the application.
 * - account_token: the value must be a token from your profile. See how to generate account-token at: https://help.tago.io/portal/en/kb/articles/495-account-token.
 *
 * In the RUN Settings, enable user to auto-signup.
 * Create an Action of type Resource whenever an user is registered in the application to run this analysis.
 */

import { Utils, Account, Device, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { UserInfo } from "@tago-io/sdk/out/modules/Account/run.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import { DataToSend } from "@tago-io/sdk/out/modules/Device/device.types";
import { parseTagoObject } from "../lib/data.logic";

import orgAdd from "../services/organization/register";

/**
 *
 * @param context
 * @param scope
 * @returns
 */
async function startAnalysis(context: TagoContext, scope: UserInfo[]): Promise<void> {
  console.log("SCOPE:", JSON.stringify(scope, null, 4));
  console.log("CONTEXT:", JSON.stringify(context, null, 4));
  console.log("Running Analysis");

  // Convert the environment variables from [{ key, value }] to { key: value };
  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  }

  if (!environment.config_token) {
    throw "Missing config_token environment var";
  } else if (!environment.account_token) {
    throw "Missing account_token environment var";
  }

  const config_dev = new Device({ token: environment.config_token });
  const account = new Account({ token: environment.account_token });

  const organization_scope: any = parseTagoObject({
    new_org_name: scope[0].name,
    new_org_address: "N/A",
    new_org_plan_group: environment.plan_group,
  }).map((x) => ({ ...x, device: " ", time: new Date() }));

  let org_id = "";

  try {
    org_id = await orgAdd({ config_dev, context, scope: organization_scope, account, environment });
  } catch (error) {
    await account.run.userDelete(scope[0].id);
    return console.log(error);
  }

  await account.run.userEdit(scope[0].id, {
    tags: [
      { key: "organization_id", value: org_id },
      { key: "access", value: "orgadmin" },
    ],
  });

  const device = await Utils.getDevice(account, org_id);
  device.sendData({ variable: "user_id", value: scope[0].id, metadata: { label: `${scope[0].name} (${scope[0].email})` } });
}

export { startAnalysis };
export default new Analysis(startAnalysis, { token: "ad895591-54f9-4aed-b13e-6b7a0277e0c6" });
