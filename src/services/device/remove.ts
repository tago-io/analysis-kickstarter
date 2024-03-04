import { Resources } from "@tago-io/sdk";
import { DeviceListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";

import { fetchDeviceList } from "../../lib/fetch-device-list";
import { RouterConstructorDevice } from "../../types";

/**
 * Function that remove aggregation data from the organization
 * @param org_id Organization id that devices will be created
 */
async function removeAggregationData(org_id: string) {
  const soil_devices = await fetchDeviceList({
    tags: [
      { key: "device_type", value: "device" },
      { key: "sensor", value: "soil" },
      { key: "organization_id", value: org_id },
    ],
  });

  if (soil_devices.length === 0) {
    await Resources.devices.deleteDeviceData(org_id, { variables: ["temperature_maximum", "temperature_average", "temperature_minimum"], qty: 9999 });
  }
}

/**
 * Main function of deleting devices
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function sensorDel({ scope, environment }: RouterConstructorDevice & { scope: DeviceListScope[] }) {
  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const dev_id = scope[0].device;
  const device_info = await Resources.devices.info(dev_id);
  if (!device_info?.tags) {
    throw new Error("Device not found");
  }

  const group_id = device_info.tags.find((tag) => tag.key === "group_id")?.value;
  const org_id = device_info.tags.find((tag) => tag.key === "organization_id")?.value;

  if (group_id) {
    await Resources.devices.deleteDeviceData(group_id, { groups: dev_id, qty: 9999 });
  }

  await Resources.devices.deleteDeviceData(config_id, { groups: dev_id, qty: 9999 });

  await Resources.devices.delete(dev_id);

  if (org_id) {
    await Resources.devices.deleteDeviceData(org_id, { groups: dev_id, qty: 9999 });
    await removeAggregationData(org_id);
  }
  return console.debug("Device deleted!");
}

export { sensorDel };
