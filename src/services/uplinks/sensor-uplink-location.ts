import { Resources } from "@tago-io/sdk";

import { RouterConstructorData } from "../../types";

/**
 * Main function of receiving the uplink location
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function sensorUplinkLocation({ context, scope, environment }: RouterConstructorData) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }
  const { device: sensor_id } = scope[0];

  const sensor_info = await Resources.devices.info(sensor_id);

  const sensor_location = scope.find((x) => x.variable === "location");
  if (!sensor_location) {
    throw new Error("Missing location");
  }

  await Resources.devices.sendDeviceData(sensor_id, {
    variable: "status_history",
    value: `Lat: ${(sensor_location.location as any).coordinates[1]} Lng: ${(sensor_location.location as any).coordinates[0]}`,
    group: sensor_location.group,
  });

  const group_id = sensor_info.tags.find((x) => x.key === "group_id")?.value;

  if (!group_id) {
    return;
  } //"Skipped. No group addressed to the sensor."

  const [dev_id] = await Resources.devices.getDeviceData(group_id, { variables: "dev_id", groups: sensor_id, qty: 1 });

  await Resources.devices.editDeviceData(group_id, { ...dev_id, location: sensor_location.location });
}

export { sensorUplinkLocation };
