/*
 * KickStarter Analysis
 * Handler
 *
 * This analysis handles most of buttons clickable by dashboard input form widgets such as dynamic table and input form widgets.
 *
 * Handles the following actions:
 * - Add, edit and delete an Organization.
 * - Add, edit and delete a Group.
 * - Add, edit and delete a Sensor.
 * - Add, edit and delete a User.
 * - Add, edit and delete scheduled reports.
 *
 * How to setup this analysis
 * Make sure you have the following enviroment variables:
 * - config_token: the value must be a token from a HTTPs device, that stores general information of the application.
 * - account_token: the value must be a token from your profile. generated at My Settings of your developer's account.
 */

import { Utils, Account, Device, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { UserInfo } from "@tago-io/sdk/out/modules/Account/run.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
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

  const organization_scope: Data[] = parseTagoObject({
    new_org_name: scope[0].name,
    new_org_address: "N/A",
    new_org_plan: environment.plan,
  }).map((x) => ({ ...x, origin: " ", time: new Date() }));

  const org_id = await orgAdd({ config_dev, context, scope: organization_scope, account, environment });

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
