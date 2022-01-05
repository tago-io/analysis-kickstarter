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
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";

import sensorUplinkStatus from "../services/uplinks/sensorUplinkStatus";
import sensorUplinkLocation from "../services/uplinks/sensorUplinkLocation";
import sensorUplinkTempHum from "../services/uplinks/sensorUplinkTempHum";

/**
 *
 * @param context
 * @param scope
 * @returns
 */
async function startAnalysis(context: TagoContext, scope: Data[]): Promise<void> {
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

  // Just a little hack to set the device_list_button_id that come sfrom the scope
  // and set it to the environment variables instead. It makes easier to use router function later.
  environment._input_id = (scope as any).find((x: any) => x.device_list_button_id)?.device_list_button_id;

  const config_dev = new Device({ token: environment.config_token });
  const account = new Account({ token: environment.account_token });

  // The router class will help you route the function the analysis must run
  // based on what had been received in the analysis.
  const router = new Utils.AnalysisRouter({ scope, context, environment, account, config_dev });

  // Sensor uplink routing
  router.register(sensorUplinkLocation).whenVariables(["location"]);
  router.register(sensorUplinkStatus).whenVariables(["status", "water_leakage_detected"]);
  router.register(sensorUplinkTempHum).whenVariables(["temperature", "relative_humidity"]);

  await router.exec();
}

export { startAnalysis };
export default new Analysis(startAnalysis, { token: "4528236f-de1d-4a48-8765-a4019aaad7e4" });
