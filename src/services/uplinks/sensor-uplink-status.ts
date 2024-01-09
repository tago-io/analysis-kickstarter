import { Resources } from "@tago-io/sdk";

import { RouterConstructorData } from "../../types";

/**
 * Function that update the status history
 * @param sensor_dev
 * @param current_sensor_info Current information of the sensor
 */
const updateStatusHistory = async (sensor_id: string, current_sensor_info: any) => {
  const status_history = `# - Sensor reported a new status.`;

  await Resources.devices.sendDeviceData(sensor_id, { variable: "status_history", value: status_history.replace("#", String(current_sensor_info.desc).toUpperCase()) });
};

/**
 * Main function of receiving the uplink status
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function sensorUplinkStatus({ context, scope, environment }: RouterConstructorData) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }
  const { device: sensor_id } = scope[0];

  const sensor_info = await Resources.devices.info(sensor_id);

  const org_id = sensor_info.tags.find((x) => x.key === "organization_id")?.value;
  if (!org_id) {
    throw new Error("Organization not found in Tago");
  }

  const sensor_status = scope.find((x) => x.variable === "status");
  if (!sensor_status) {
    throw new Error("Missing Sensor status");
  }

  let current_sensor_info;

  if (sensor_status.value === "1" || sensor_status.value === 1 || sensor_status.value === "true") {
    current_sensor_info = { icon: "correct-symbol", color: "green" };
  } else if (sensor_status.value === "0" || sensor_status.value === 0 || sensor_status.value === "false") {
    current_sensor_info = { icon: "ban-circle-symbol", color: "red" };
  }

  if (!current_sensor_info) {
    return;
  } //"Different uplink message";

  await updateStatusHistory(sensor_id, current_sensor_info);

  const group_id = sensor_info.tags.find((x) => x.key === "group_id")?.value;

  if (!group_id) {
    return;
  } //"Skipped. No group addressed to the sensor."

  const layers = await Resources.devices.getDeviceData(group_id, { variables: "layers", qty: 9999 });

  const [dev_id] = await Resources.devices.getDeviceData(group_id, { variables: "dev_id", groups: sensor_id, qty: 1 });
  if (!dev_id.metadata) {
    throw new Error("dev_id.metadata not found in Tago");
  }
  const fixed_position_key = `${group_id}${sensor_id}`;
  const layer = layers.find((x) => (x?.metadata?.fixed_position as any)[fixed_position_key]);
  if (!layer) {
    return;
  } //"Device has no pin in layer yet."

  dev_id.metadata.color = current_sensor_info.color;
  dev_id.metadata.icon = current_sensor_info.icon;

  await Resources.devices.editDeviceData(group_id, { ...dev_id, metadata: dev_id.metadata });
}

export { sensorUplinkStatus };
