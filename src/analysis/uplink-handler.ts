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

import { sensorUplinkLocation } from "../services/uplinks/sensor-uplink-location";
import { sensorUplinkStatus } from "../services/uplinks/sensor-uplink-status";
import { sensorUplinkTempHum } from "../services/uplinks/sensor-uplink-temp-hum";

/**
 *
 * @param context
 * @param scope
 * @returns
 */
async function startAnalysis(context: TagoContext, scope: Data[]): Promise<void> {
  context.log("Running Analysis");
  console.log("Scope:", scope);

  // Convert environment variables to a JSON.
  const environment = Utils.envToJson(context.environment);
  console.log("Environment:", environment);

  // Check if all tokens needed for the application were provided.
  if (!environment.config_id) {
    throw "Missing config_id environment var";
  } else if (environment.config_id.length !== 24) {
    return context.log('Invalid "config_id" in the environment variable');
  }

  // Just a little hack to set the device_list_button_id that come sfrom the scope
  // and set it to the environment variables instead. It makes easier to use router function later.
  environment._input_id = (scope as any).find((x: any) => x.device_list_button_id)?.device_list_button_id;

  // The router class will help you route the function the analysis must run
  // based on what had been received in the analysis.
  const router = new Utils.AnalysisRouter({ scope, context, environment });

  // Sensor uplink routing
  router.register(sensorUplinkLocation).whenVariables(["location"]);
  router.register(sensorUplinkStatus).whenVariables(["status", "water_leakage_detected"]);
  router.register(sensorUplinkTempHum).whenVariables(["temperature", "relative_humidity"]);

  await router.exec();
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
