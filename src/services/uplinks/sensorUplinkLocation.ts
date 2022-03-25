import { Utils } from "@tago-io/sdk";
import { RouterConstructorData } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  const { device: sensor_id } = scope[0];

  const sensor_dev = await Utils.getDevice(account, sensor_id);

  const sensor_info = await account.devices.info(sensor_id);

  const sensor_location = scope.find((x) => x.variable === "location");

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
  await group_dev.deleteData({ variables: "dev_id", groups: sensor_id, qty: 1 }); //CONSIDER TO COMMENT THIS LINE IF CAUSING TROUB

  await group_dev.sendData({ ...dev_id, location: sensor_location.location });
};
