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

import { Analysis, Resources, Utils } from "@tago-io/sdk";
import { TagoContext, UserInfo } from "@tago-io/sdk/lib/types";

import { parseTagoObject } from "../lib/data.logic";
import { orgAdd } from "../services/organization/register";

/**
 *
 * @param context
 * @param scope
 * @returns
 */
async function startAnalysis(context: TagoContext, scope: UserInfo[]): Promise<void> {
  console.debug("SCOPE:", JSON.stringify(scope, null, 4));
  console.debug("CONTEXT:", JSON.stringify(context, null, 4));
  console.debug("Running Analysis");

  // Convert the environment variables from [{ key, value }] to { key: value };
  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const organization_scope: any = parseTagoObject({
    new_org_name: scope[0].name,
    new_org_address: "N/A",
    new_org_plan_group: environment.plan_group,
  }).map((x) => ({ ...x, device: " ", time: new Date() }));

  let org_id: string | void = "";

  try {
    org_id = await orgAdd({ context, scope: organization_scope, environment });
  } catch (error) {
    await Resources.run.userDelete(scope[0].id);
    return console.debug(error);
  }

  if (!org_id) {
    throw "Error creating organization";
  }

  await Resources.run.userEdit(scope[0].id, {
    tags: [
      { key: "organization_id", value: org_id },
      { key: "access", value: "orgadmin" },
    ],
  });

  await Resources.devices.sendDeviceData(org_id, { variable: "user_id", value: scope[0].id, metadata: { label: `${scope[0].name} (${scope[0].email})` } });
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
