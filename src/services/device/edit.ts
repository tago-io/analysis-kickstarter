import { Resources } from "@tago-io/sdk";

import { parseTagoObject } from "../../lib/data.logic";
import { getDashboardByConnectorID } from "../../lib/find-resource";
import { RouterConstructorDevice } from "../../types";
import { sensor_status_false } from "./device-info";

/**
 * Function that validate parameters
 */
async function validateParams({ scope, environment }: RouterConstructorDevice) {
  if (!environment || !scope) {
    throw new Error("Missing parameters");
  }
  const dev_id = (scope[0] as any).device;
  if (!dev_id) {
    return;
  }
}

/**
 * Function that handle device name change
 */
async function handleDeviceNameChange(org_id: string, dev_id: string, new_dev_name: string, current_group_id: string) {
  if (new_dev_name && current_group_id) {
    const [old_dev_id] = await Resources.devices.getDeviceData(current_group_id, { variables: "dev_id", groups: dev_id, qty: 1 });
    const old_group_data = await Resources.devices.getDeviceData(current_group_id, { variables: "dev_id", groups: dev_id });
    const old_org_data = await Resources.devices.getDeviceData(org_id, { variables: "dev_id", groups: dev_id });

    await Resources.devices.editDeviceData(org_id, { ...old_group_data, ...old_dev_id });
    await Resources.devices.editDeviceData(current_group_id, { ...old_org_data, ...old_dev_id });
  }
}

/**
 * Function that handle group id change
 */
async function handleGroupIdChange(dev_id: string, new_group_id: string, current_group_id: string, org_id: string, type: string) {
  if (new_group_id || new_group_id === "") {
    const { name: current_device_name, tags: current_device_tags, connector } = await Resources.devices.info(dev_id);

    //removing data from the last group
    if (current_group_id && current_group_id !== "") {
      await Resources.devices.deleteDeviceData(current_group_id, { variables: "dev_id", groups: dev_id });
    }

    const new_device_tags = current_device_tags.filter((x) => x.key !== "group_id");
    new_device_tags.push({ key: "group_id", value: new_group_id });
    await Resources.devices.edit(dev_id, { tags: new_device_tags });

    const device_params = await Resources.devices.paramList(dev_id);
    const go_to_param = device_params.find((x) => x.key === "dashboard_url");

    const { id: dash_id } = await getDashboardByConnectorID(connector);

    const new_url = `https://admin.tago.io/dashboards/info/${dash_id}?org_dev=${org_id}&sensor=${dev_id}`;

    await Resources.devices.paramSet(dev_id, { ...go_to_param, value: new_url });

    const to_tago = parseTagoObject(
      {
        dev_id: {
          value: dev_id,
          metadata: {
            label: current_device_name,
            url: new_url,
            icon: sensor_status_false[type]?.icon || "wifi",
            status: "unknwon",
            type,
          },
        },
      },
      dev_id
    );

    await Resources.devices.sendDeviceData(new_group_id, to_tago);
  }
}

/**
 * Main function of editing devices
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function sensorEdit({ scope, environment }: RouterConstructorDevice) {
  await validateParams({ scope, environment });

  const dev_id = (scope[0] as any).device;
  const new_group_id = (scope[0] as any)["param.dev_group"];
  const new_dev_name = (scope[0] as any).name;

  const { tags: device_tags } = await Resources.devices.info(dev_id);

  const org_id = device_tags.find((x) => x.key === "organization_id")?.value;
  if (!org_id) {
    throw new Error("Organization not found");
  }

  const type = device_tags.find((x) => x.key === "sensor")?.value;
  if (!type) {
    throw new Error("Sensor type not found");
  }
  const current_group_id = device_tags.find((x) => x.key === "group_id")?.value as string;

  await handleDeviceNameChange(org_id, dev_id, new_dev_name, current_group_id);
  await handleGroupIdChange(dev_id, new_group_id, current_group_id, org_id, type);
}

export { sensorEdit };
