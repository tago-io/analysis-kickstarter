import { Device, Resources } from "@tago-io/sdk";
import { DeviceCreateInfo } from "@tago-io/sdk/lib/types";

import { createDashURL } from "../../lib/create-dash-url";
import { parseTagoObject } from "../../lib/data.logic";
import { fetchDeviceList } from "../../lib/fetch-device-list";
import { getDashboardByTagID } from "../../lib/find-resource";
import { initializeValidation } from "../../lib/validation";
import { DeviceCreated, RouterConstructorData } from "../../types";

interface installDeviceParam {
  new_dev_name: string;
  org_id: string;
  network_id: string;
  connector: string;
  new_device_eui: string;
  type: string;
  group_id?: string;
}

/**
 * Function that create devices
 * @param new_dev_name Name of the device
 * @param org_id Organization id that devices will be created
 * @param network_id Network id that devices will be created
 * @param connector Connector id that devices will be created
 * @param new_device_eui Device eui configured by the user
 * @param type Sensor type of the device
 * @param group_id Group id that devices will be created
 */
async function installDevice({ new_dev_name, org_id, network_id, connector, new_device_eui, type, group_id }: installDeviceParam) {
  //data retention set to 1 month
  const device_data: DeviceCreateInfo = {
    name: new_dev_name,
    network: network_id,
    serie_number: new_device_eui,
    connector,
    type: "immutable",
    chunk_period: "month",
    chunk_retention: 1,
  };

  //creating new device
  const new_dev = await Resources.devices.create(device_data);

  const new_tags = {
    tags: [
      { key: "device_id", value: new_dev.device_id },
      { key: "organization_id", value: org_id },
      { key: "device_type", value: "device" },
      { key: "sensor", value: type },
      { key: "dev_eui", value: new_device_eui },
    ],
  };

  if (group_id) {
    new_tags.tags.push({ key: "group_id", value: group_id });
  }

  await Resources.devices.edit(new_dev.device_id, new_tags);

  const new_org_dev = new Device({ token: new_dev.token });

  return { ...new_dev, device: new_org_dev } as DeviceCreated;
}

/**
 * Main function of creating devices
 * @param context Context is a variable sent by the analysis
 * @param scope Number of devices that will be listed
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function sensorAdd({ context, scope, environment }: RouterConstructorData) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }

  const org_id = scope[0].device;

  const validate = initializeValidation("dev_validation", org_id);
  await validate("#VAL.REGISTERING#", "warning").catch((error) => console.error(error));

  const sensor_qty = await fetchDeviceList({
    tags: [
      { key: "device_type", value: "device" },
      { key: "organization_id", value: org_id },
    ],
  });

  if (sensor_qty.length >= 5) {
    return validate("#VAL.LIMIT_OF_5_DEVICES_REACHED#", "danger");
  }
  //Collecting data
  const new_dev_name = scope.find((x) => x.variable === "new_dev_name");
  const new_dev_eui = scope.find((x) => x.variable === "new_dev_eui");
  const new_dev_group = scope.find((x) => x.variable === "new_dev_group");
  const new_dev_type = scope.find((x) => x.variable === "new_dev_type");
  const new_dev_network = scope.find((x) => x.variable === "new_dev_network");

  if (!new_dev_name || !new_dev_group || !new_dev_type || !new_dev_network) {
    throw new Error("Missing variables");
  }
  if ((new_dev_name?.value as string).length < 3) {
    throw validate("#VAL.NAME_FIELD_IS_SMALLER_THAN_3_CHAR#", "danger");
  }

  if (!new_dev_type?.value) {
    throw validate("#VAL.DEVICE_TYPE_NOT_FOUND_PLEASE_SELECT_AGAIN_THE_DEVICE_TYPE#", "danger");
  }

  //If choosing for the simulator, we generate a random EUI
  const dev_eui = (new_dev_eui?.value as string)?.toUpperCase() || String(Math.ceil(Math.random() * 10_000_000));

  const dev_exists = await fetchDeviceList({ tags: [{ key: "dev_eui", value: dev_eui }] });

  if (dev_exists.length > 0) {
    console.debug("Sensor EUI already in use.");
    return validate("Sensor EUI already in use.", "danger");
  }

  const group_id = new_dev_group?.value as string;

  const connector_id = new_dev_type.value as string;

  const dash_id = await getDashboardByTagID("hum_dashboard");

  const dash_info = await Resources.dashboards.info(dash_id);
  const type = dash_info.blueprint_devices.find((bp) => bp.conditions[0].key === "sensor");
  if (!type) {
    return validate("#VAL.ERROR__DASHBOARD_IS_MISSING_THE_BLUEPRINT_DEVICE_SENSOR#", "danger");
  }

  const { device_id } = await installDevice({
    new_dev_name: new_dev_name.value as string,
    org_id,
    network_id: new_dev_network.value as string,
    connector: connector_id,
    new_device_eui: dev_eui,
    type: type.conditions[0].value,
    group_id,
  });

  const url = createDashURL(dash_id, { org_dev: org_id, sensor: device_id });

  const dev_data = parseTagoObject(
    {
      dev_id: {
        value: device_id,
        metadata: {
          label: new_dev_name.value,
          url,
          status: "unknwon",
          type: dash_info.type,
        },
      },
    },
    device_id
  );

  await Resources.devices.paramSet(device_id, {
    key: "dashboard_url",
    value: url,
    sent: false,
  });

  await Resources.devices.paramSet(device_id, { key: "dev_eui", value: dev_eui, sent: false });
  await Resources.devices.paramSet(device_id, { key: "dev_group", value: (new_dev_group?.metadata?.label as string) || "", sent: false });
  await Resources.devices.paramSet(device_id, { key: "dev_lastcheckin", value: "-", sent: false });
  await Resources.devices.paramSet(device_id, { key: "dev_battery", value: "-", sent: false });

  const add_to_dropdown_list = parseTagoObject({ asset_list: new_dev_name.value }, device_id);
  await Resources.devices.sendDeviceData(org_id, dev_data.concat(add_to_dropdown_list));

  if (group_id) {
    await Resources.devices.sendDeviceData(new_dev_group.value as string, dev_data);
  }

  return validate("#VAL.DEVICE_CREATED_SUCCESSFULLY#", "success");
}

export { sensorAdd };
