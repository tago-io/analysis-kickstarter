import { Utils, Device } from "@tago-io/sdk";
import { RouterConstructorData } from "../../types";

/**
 * Function that update the status history
 * @param sensor_dev Device of the sensor
 * @param current_sensor_info Current information of the sensor
 */
const updateStatusHistory = async (sensor_dev: Device, current_sensor_info: any) => {
  const status_history = `# - Sensor reported a new status.`;

  await sensor_dev.sendData({ variable: "status_history", value: status_history.replace("#", String(current_sensor_info.desc).toUpperCase()) });
};

/**
 * Main function of receiving the uplink status
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

  const sensor_info = await account.devices.info(sensor_id);
  const sensor_dev = await Utils.getDevice(account, sensor_id);

  const org_id = sensor_info.tags.find((x) => x.key === "organization_id")?.value;
  if (!org_id) {
    throw new Error("Organization not found in Tago");
  }
  const org_dev = await Utils.getDevice(account, org_id);
  const [dev_id_data] = await org_dev.getData({ variables: "dev_id", groups: sensor_id, qty: 1 });

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

  await updateStatusHistory(sensor_dev, current_sensor_info);

  const group_id = sensor_info.tags.find((x) => x.key === "group_id")?.value;

  if (!group_id) {
    return;
  } //"Skipped. No group addressed to the sensor."

  const group_dev = await Utils.getDevice(account, group_id);

  const layers = await group_dev.getData({ variables: "layers", qty: 9999 });

  const [dev_id] = await group_dev.getData({ variables: "dev_id", groups: sensor_id, qty: 1 });
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

  await group_dev.editData({ ...dev_id, metadata: dev_id.metadata });
};
