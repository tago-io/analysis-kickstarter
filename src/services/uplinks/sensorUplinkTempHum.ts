import { Utils } from "@tago-io/sdk";
import { RouterConstructorData } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  if (!account || !environment || !scope || !config_dev || !context) {
    throw new Error("Missing parameters");
  }
  const { device: sensor_id } = scope[0];

  const sensor_dev = await Utils.getDevice(account, sensor_id);
  const sensor_temp = scope.find((x) => x.variable === "temperature");
  const sensor_hum = scope.find((x) => x.variable === "relative_humidity");
  if (!sensor_temp || !sensor_hum) {
    throw new Error("Missing temperature or humidity");
  }

  const status_history_value = `Temp: ${sensor_temp?.value ? sensor_temp?.value : "N/A"}${sensor_temp?.unit ? sensor_temp?.unit : ""} Hum: ${
    sensor_hum?.value ? sensor_hum?.value : "N/A"
  }${sensor_hum?.unit ? sensor_hum?.unit : ""}`;

  await sensor_dev.sendData({
    variable: "status_history",
    value: status_history_value,
    group: sensor_temp.group,
  });
};
