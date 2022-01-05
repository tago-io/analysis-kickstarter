import { Utils, Services, Account, Device, Types, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { RouterConstructorData } from "../../types";

const updateStatusHistory = async (sensor_dev: Device, dev_id_data: Data, sensor_status_serie: string, current_sensor_info: any) => {
  const status_history = `# - Sensor reported a new status.`;

  await sensor_dev.sendData({ variable: "status_history", value: status_history.replace("#", String(current_sensor_info.desc).toUpperCase()) });

  // await sensor_dev.sendData({ variable: "status_history", value: String(current_sensor_info.desc).toUpperCase(), serie: sensor_status_serie });
};

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  const { origin: sensor_id } = scope[0];

  const sensor_info = await account.devices.info(sensor_id);
  const sensor_dev = await Utils.getDevice(account, sensor_id);

  const org_id = sensor_info.tags.find((x) => x.key === "organization_id")?.value;
  const org_dev = await Utils.getDevice(account, org_id);
  const [dev_id_data] = await org_dev.getData({ variables: "dev_id", series: sensor_id, qty: 1 });

  const sensor_status = scope.find((x) => x.variable === "status");

  let current_sensor_info;

  if (sensor_status.value === "1" || sensor_status.value === 1 || sensor_status.value === "true") {
    current_sensor_info = { icon: "correct-symbol", color: "green" };
  } else if (sensor_status.value === "0" || sensor_status.value === 0 || sensor_status.value === "false") {
    current_sensor_info = { icon: "ban-circle-symbol", color: "red" };
  }

  if (!current_sensor_info) {
    return;
  } //"Different uplink message";

  await updateStatusHistory(sensor_dev, dev_id_data, sensor_status.serie, current_sensor_info);

  const group_id = sensor_info.tags.find((x) => x.key === "group_id")?.value;

  if (!group_id) {
    return;
  } //"Skipped. No group addressed to the sensor."

  const group_dev = await Utils.getDevice(account, group_id);

  const layers = await group_dev.getData({ variables: "layers", qty: 9999 });

  const [dev_id] = await group_dev.getData({ variables: "dev_id", series: sensor_id, qty: 1 });
  await group_dev.deleteData({ variables: "dev_id", series: sensor_id, qty: 1 }); //CONSIDER TO COMMENT THIS LINE IF CAUSING TROUB

  const fixed_position_key = `${group_id}${sensor_id}`;
  const layer = layers.find((x) => (x.metadata.fixed_position as any)[fixed_position_key]);
  if (!layer) {
    return;
  } //"Device has no pin in layer yet."

  dev_id.metadata.color = current_sensor_info.color;
  dev_id.metadata.icon = current_sensor_info.icon;
  delete dev_id.time;

  await group_dev.sendData({ ...dev_id });
};
