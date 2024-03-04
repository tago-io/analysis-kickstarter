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
 */

import { Analysis, Utils } from "@tago-io/sdk";
import { Data, TagoContext } from "@tago-io/sdk/lib/types";

import { sensorEdit } from "../services/device/edit";
import { sensorPlacement } from "../services/device/place-sensor";
import { sensorAdd } from "../services/device/register";
import { sensorDel } from "../services/device/remove";
import { groupEdit } from "../services/group/edit";
import { groupAdd } from "../services/group/register";
import { groupDel } from "../services/group/remove";
import { orgEdit } from "../services/organization/edit";
import { orgAdd } from "../services/organization/register";
import { orgDel } from "../services/organization/remove";
import { planEdit } from "../services/plan/edit";
import { planAdd } from "../services/plan/register";
import { planDel } from "../services/plan/remove";
import { reportAdd } from "../services/reports/create";
import { reportEdit } from "../services/reports/edit";
import { reportDel } from "../services/reports/remove";
import { userEdit } from "../services/user/edit";
import { userAdd } from "../services/user/register";
import { userDel } from "../services/user/remove";

// import { createAlert } from "../services/alerts/register";
// import { deleteAlert } from "../services/alerts/remove";
// import { editAlert } from "../services/alerts/edit";

/**
 * This function is the main function of the analysis.
 * @param context The context of the analysis, containing the environment variables and parameters.
 * @param scope The scope of the analysis, containing the data sent to the analysis.
 */
async function startAnalysis(context: TagoContext, scope: Data[]): Promise<void> {
  context.log("Running Analysis");
  console.log("Scope:", scope);

  // Convert the environment variables from [{ key, value }] to { key: value };
  const environment = Utils.envToJson(context.environment);
  console.log("Environment:", environment);

  // Check if all tokens needed for the application were provided.
  if (!environment.config_id) {
    throw "Missing config_id environment var";
  } else if (environment.config_id.length !== 24) {
    return context.log('Invalid "config_id" in the environment variable');
  }

  // Just a little hack to set the device_list_button_id that come from the scope
  // and set it to the environment variables instead. It makes easier to use router function later.
  environment._input_id = (scope as any).find((x: any) => x.device_list_button_id)?.device_list_button_id;

  // Instance the router class of Utils.router
  const router = new Utils.AnalysisRouter({ scope, context, environment });

  // Organization Routing
  router.register(orgAdd).whenInputFormID("create-org");
  router.register(orgDel).whenDeviceListIdentifier("delete-org");
  router.register(orgEdit).whenCustomBtnID("edit-org");

  // Sensor routing
  router.register(sensorAdd).whenInputFormID("create-dev");
  router.register(sensorDel).whenDeviceListIdentifier("delete-dev");
  router.register(sensorEdit).whenDeviceListIdentifier("edit-dev");

  // Sensor uplink routing
  router.register(sensorPlacement).whenVariables(["set_dev_pin_id"]);

  // group routing
  router.register(groupAdd).whenInputFormID("create-group");
  router.register(groupDel).whenDeviceListIdentifier("delete-group");
  router.register(groupEdit).whenCustomBtnID("edit-group");

  // User routing
  router.register(userAdd).whenInputFormID("create-user");
  router.register(userDel).whenUserListIdentifier("delete-user");
  router.register(userEdit).whenCustomBtnID("edit-user");

  //Plan routing
  router.register(planAdd).whenInputFormID("create-plan");
  router.register(planDel).whenVariableLike("plan_").whenWidgetExec("delete");
  router.register(planEdit).whenVariableLike("plan_").whenWidgetExec("edit");

  // //Alert routing
  // router.register(createAlert).whenInputFormID("create-alert");
  // router.register(editAlert).whenVariableLike("action_").whenWidgetExec("edit");
  // router.register(deleteAlert).whenVariableLike("action_").whenWidgetExec("delete");

  // Report routing
  router.register(reportAdd).whenInputFormID("create-report");
  router.register(reportDel).whenVariableLike("report_").whenWidgetExec("delete");
  router.register(reportEdit).whenVariableLike("report_").whenWidgetExec("edit");

  await router.exec();
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
