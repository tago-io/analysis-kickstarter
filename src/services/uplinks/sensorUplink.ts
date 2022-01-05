import { Utils } from "@tago-io/sdk";
import { RouterConstructorData } from "../../types";
import { sensor_status_true, sensor_status_false } from "../device/deviceInfo";

// interface Command {
//   motion: string;
//   leak: string;
//   door: string;
//   window: string;
// }

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  const { origin: sensor_id } = scope[0];

  const sensor_info = await account.devices.info(sensor_id);
  const sensor_dev = await Utils.getDevice(account, sensor_id);

  const group_id = sensor_info.tags.find((x) => x.key === "group_id").value;

  const group_dev = await Utils.getDevice(account, group_id);

  const layers = await group_dev.getData({ variables: "layers", qty: 9999 });

  const [dev_id] = await group_dev.getData({ variables: "dev_id", series: sensor_id, qty: 1 });

  const fixed_position_key = `${group_id}${sensor_id}`;
  const layer = layers.find((x) => (x.metadata.fixed_position as any)[fixed_position_key]);

  if (!layer) {
    return context.log("Device has no pin in layer yet.");
  }

  await group_dev.deleteData({ variables: "layers", series: layer.serie });

  // let status_color = "#FFDE38";
  // let status_icon = dev_id.metadata.icon;
  const status_history = `${dev_id.metadata.type} device reported a # status.`;
  const sensor_status = scope.find((x) => x.variable === "status" || x.variable === "water_leakage_detected");

  let current_sensor_info;

  if (sensor_status.value === "open" || sensor_status.value === "true") {
    current_sensor_info = sensor_status_true[dev_id.metadata.type];
  } else if (sensor_status.value === "close" || sensor_status.value === "false") {
    current_sensor_info = sensor_status_false[dev_id.metadata.type];
  }

  if (!current_sensor_info) {
    return context.log("Different uplink message");
  }

  (layer.metadata.fixed_position as any)[fixed_position_key].color = current_sensor_info.color;
  (layer.metadata.fixed_position as any)[fixed_position_key].icon = current_sensor_info.icon;

  context.log(current_sensor_info.icon);
  await group_dev.sendData(layer);
  await sensor_dev.sendData({ variable: "status_history", value: status_history.replace("#", current_sensor_info.desc) });
};
