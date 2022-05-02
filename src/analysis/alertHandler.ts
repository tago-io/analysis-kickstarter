/*
 * KickStarter Analysis
 * Alert Handler
 *
 * Work same as the handler analysis, but only for alerts.
 * This analysis handles most of buttons clickable by dashboard input form widgets such as dynamic table and input form widgets.
 *
 * Handles the following actions:
 * - Add, edit and delete an Alert
 *
 * How to setup this analysis
 * Make sure you have the following enviroment variables:
 * - config_token: the value must be a token from a HTTPs device, that stores general information of the application.
 * - account_token: the value must be a token from your profile. See how to generate account-token at: https://help.tago.io/portal/en/kb/articles/495-account-token.
 */
import { Account, Device, Analysis, Utils } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import { editAlert } from "../services/alerts/edit";
import { createAlert } from "../services/alerts/register";
import { deleteAlert } from "../services/alerts/remove";

async function startAnalysis(context: TagoContext, scope: Data[]): Promise<void> {
  if (!scope[0]) {
    return context.log("This analysis must be triggered by a widget.");
  }

  context.log(JSON.stringify(scope));
  context.log("Alert analysis started");

  // Get the environment variables.
  const environment = Utils.envToJson(context.environment);
  if (!environment.account_token) {
    return context.log('Missing "account_token" environment variable');
  } else if (environment.account_token.length !== 36) {
    return context.log('Invalid "account_token" in the environment variable');
  }

  // Instance the Account class
  const account = new Account({ token: environment.account_token });

  // Instance the device class using the device from scope variables.
  // device is always the device used in the widget to trigger the analysis.
  const device_id = scope[0].device;
  const device_token = await Utils.getTokenByName(account, device_id);
  const org_dev = new Device({ token: device_token });

  const router = new Utils.AnalysisRouter({ context, config_dev: org_dev, scope, environment, account });

  router.register(createAlert).whenInputFormID("create-alert-dev");
  router.register(editAlert).whenWidgetExec("edit");
  router.register(deleteAlert).whenWidgetExec("delete");

  const result = await router.exec();

  console.log("Script end. Functions that run:");
  console.log(result.services);
}

export default new Analysis(startAnalysis, { token: "0604d0ad-fad7-4739-bb9a-a2e90ca2a52b" });
