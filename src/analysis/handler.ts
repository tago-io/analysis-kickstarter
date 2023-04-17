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
 * - account_token: the value must be a token from your profile. See how to generate account-token at: https://help.tago.io/portal/en/kb/articles/495-account-token.
 */

import { Utils, Account, Device, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";

import { orgEdit } from "../services/organization/edit";
import { orgAdd } from "../services/organization/register";
import { orgDel } from "../services/organization/remove";

import { sensorAdd } from "../services/device/register";
import { sensorDel } from "../services/device/remove";
import { sensorEdit } from "../services/device/edit";
import sensorPlacement from "../services/device/placeSensor";

import { groupAdd } from "../services/group/register";
import { groupDel } from "../services/group/remove";
import { groupEdit } from "../services/group/edit";

import userAdd from "../services/user/register";
import userDel from "../services/user/remove";
import userEdit from "../services/user/edit";

import report from "../services/reports/create";
import reportDel from "../services/reports/remove";
import reportEdit from "../services/reports/edit";

import planAdd from "../services/plan/register";
import planDel from "../services/plan/remove";
import planEdit from "../services/plan/edit";

// import { createAlert } from "../services/alerts/register";
// import { deleteAlert } from "../services/alerts/remove";
// import { editAlert } from "../services/alerts/edit";

/**
 *
 * @param context
 * @param scope
 * @returns
 */
async function startAnalysis(context: TagoContext, scope: Data[]): Promise<void> {
  console.debug("SCOPE:", JSON.stringify(scope, null, 4));
  console.debug("CONTEXT:", JSON.stringify(context, null, 4));
  console.debug("Running Analysis");

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

  // Just a little hack to set the device_list_button_id that come sfrom the scope
  // and set it to the environment variables instead. It makes easier to use router function later.
  environment._input_id = (scope as any).find((x: any) => x.device_list_button_id)?.device_list_button_id;

  const config_dev = new Device({ token: environment.config_token });
  const account = new Account({ token: environment.account_token });

  // Instance the router classs of Utils.router
  const router = new Utils.AnalysisRouter({
    scope,
    context,
    environment,
    account,
    config_dev,
  });

  // Organization Routing
  router.register(orgAdd).whenInputFormID("create-org");
  router.register(orgDel).whenCustomBtnID("delete-org");
  router.register(orgEdit).whenCustomBtnID("edit-org");

  // Sensor routing
  router.register(sensorAdd).whenInputFormID("create-dev");
  router.register(sensorDel).whenCustomBtnID("delete-dev");
  router.register(sensorEdit).whenCustomBtnID("edit-dev");

  // Sensor uplink routing
  router.register(sensorPlacement).whenVariables(["set_dev_pin_id"]);

  // group routing
  router.register(groupAdd).whenInputFormID("create-group");
  router.register(groupDel).whenCustomBtnID("delete-group");
  router.register(groupEdit).whenCustomBtnID("edit-group");

  // User routing
  router.register(userAdd).whenInputFormID("create-user");
  router.register(userDel).whenVariableLike("user_").whenWidgetExec("delete");
  router.register(userEdit).whenVariableLike("user_").whenWidgetExec("edit");

  //Plan routing
  router.register(planAdd).whenInputFormID("create-plan");
  router.register(planDel).whenVariableLike("plan_").whenWidgetExec("delete");
  router.register(planEdit).whenVariableLike("plan_").whenWidgetExec("edit");

  // //Alert routing
  // router.register(createAlert).whenInputFormID("create-alert");
  // router.register(editAlert).whenVariableLike("action_").whenWidgetExec("edit");
  // router.register(deleteAlert).whenVariableLike("action_").whenWidgetExec("delete");

  // Report routing
  router.register(report).whenInputFormID("create-report");
  router.register(reportDel).whenVariableLike("report_").whenWidgetExec("delete");
  router.register(reportEdit).whenVariableLike("report_").whenWidgetExec("edit");

  await router.exec();
}
if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
