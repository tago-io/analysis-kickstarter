import { Resources } from "@tago-io/sdk";

import { RouterConstructorData } from "../../types";

/**
 * Main function of receiving the uplink temperature and humidity
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function sensorUplinkTempHum({ context, scope, environment }: RouterConstructorData) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }
  const { device: sensor_id } = scope[0];

  const sensor_temp = scope.find((x) => x.variable === "temperature");
  const sensor_hum = scope.find((x) => x.variable === "relative_humidity");
  if (!sensor_temp || !sensor_hum) {
    throw new Error("Missing temperature or humidity");
  }

  const status_history_value = `Temp: ${sensor_temp?.value ? sensor_temp?.value : "N/A"}${sensor_temp?.unit ? sensor_temp?.unit : ""} Hum: ${
    sensor_hum?.value ? sensor_hum?.value : "N/A"
  }${sensor_hum?.unit ? sensor_hum?.unit : ""}`;

  await Resources.devices.sendDeviceData(sensor_id, {
    variable: "status_history",
    value: status_history_value,
    group: sensor_temp.group,
  });
}

export { sensorUplinkTempHum };
