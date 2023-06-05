import { Utils } from "@tago-io/sdk";
import { RouterConstructorData } from "../../types";


/**
 * Main function of receiving the uplink location
 * @param config_dev Device of the configuration
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param account Account instanced class
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  if (!account || !environment || !scope || !config_dev || !context) {
    throw new Error("Missing parameters");
  }
  const { device: sensor_id } = scope[0];

  const sensor_dev = await Utils.getDevice(account, sensor_id);

  const sensor_info = await account.devices.info(sensor_id);

  const sensor_location = scope.find((x) => x.variable === "location");
  if (!sensor_location) {
    throw new Error("Missing location");
  }

  await sensor_dev.sendData({
    variable: "status_history",
    value: `Lat: ${(sensor_location.location as any).coordinates[1]} Lng: ${(sensor_location.location as any).coordinates[0]}`,
    group: sensor_location.group,
  });

  const group_id = sensor_info.tags.find((x) => x.key === "group_id")?.value;

  if (!group_id) {
    return;
  } //"Skipped. No group addressed to the sensor."

  const group_dev = await Utils.getDevice(account, group_id);

  const [dev_id] = await group_dev.getData({ variables: "dev_id", groups: sensor_id, qty: 1 });

  await group_dev.editData({ ...dev_id, location: sensor_location.location });
};
