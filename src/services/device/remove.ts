import { Account, Utils } from "@tago-io/sdk";

import { fetchDeviceList } from "../../lib/fetchDeviceList";
import { RouterConstructorDevice } from "../../types";

/**
 * Function that remove aggregation data from the organization
 * @param account Account instanced class
 * @param org_id Organization id that devices will be created
 */
async function removeAggregationData(account: Account, org_id: string) {
  const soil_devices = await fetchDeviceList(account, [
    { key: "device_type", value: "device" },
    { key: "sensor", value: "soil" },
    { key: "organization_id", value: org_id },
  ]);

  if (soil_devices.length === 0) {
    await account.devices.deleteDeviceData(org_id, { variables: ["temperature_maximum", "temperature_average", "temperature_minimum"], qty: 9999 });
  }
}

/**
 * Main function of deleting devices
 * @param config_dev Device of the configuration
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param account Account instanced class
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function sensorDel({ config_dev, context, scope, account, environment }: RouterConstructorDevice) {
  if (!account || !environment || !scope || !config_dev || !context) {
    throw new Error("Missing parameters");
  }
  const dev_id = (scope[0] as any).device;
  const device_info = await (await Utils.getDevice(account, dev_id)).info();
  if (!device_info?.tags) {
    throw new Error("Device not found");
  }

  const group_id = device_info.tags.find((tag) => tag.key === "group_id")?.value;
  const org_id = device_info.tags.find((tag) => tag.key === "organization_id")?.value;

  if (group_id) {
    const group_dev = await Utils.getDevice(account, group_id as string);
    await group_dev.deleteData({ groups: dev_id, qty: 9999 });
  }

  await config_dev.deleteData({ groups: dev_id, qty: 99999 });

  await account.devices.delete(dev_id);

  if (org_id) {
    const org_dev = await Utils.getDevice(account, org_id);
    await org_dev.deleteData({ groups: dev_id, qty: 9999 });
    await removeAggregationData(account, org_id);
  }
  return console.debug("Device deleted!");
}

export { sensorDel };
