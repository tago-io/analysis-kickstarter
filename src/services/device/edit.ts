import { Utils } from "@tago-io/sdk";
import getDevice from "@tago-io/sdk/out/modules/Utils/getDevice";
import { parseTagoObject } from "../../lib/data.logic";
import { findDashboardByConnectorID } from "../../lib/findResource";
import { RouterConstructorDevice } from "../../types";
import { sensor_status_false } from "./deviceInfo";

async function sensorEdit({ config_dev, context, scope, account, environment }: RouterConstructorDevice) {
  if (!account || !environment || !scope || !config_dev || !context) {
    throw new Error("Missing parameters");
  }
  const dev_id = (scope[0] as any).device;
  if (!dev_id) {
    return;
  }

  const new_group_id = (scope[0] as any)["param.dev_group"];
  const new_dev_name = (scope[0] as any).name;

  const { name: device_name, tags: device_tags } = await account.devices.info(dev_id);

  const org_id = device_tags.find((x) => x.key === "organization_id")?.value;
  if (!org_id) {
    throw new Error("Organization not found");
  }
  const org_dev = await getDevice(account, org_id);
  const type = device_tags.find((x) => x.key === "sensor")?.value;
  if (!type) {
    throw new Error("Sensor type not found");
  }
  const current_group_id = device_tags.find((x) => x.key === "group_id")?.value;

  //updating only the group's dev_id data
  if (new_dev_name && current_group_id) {
    const group_dev = await Utils.getDevice(account, current_group_id);
    const [old_dev_id] = await group_dev.getData({ variables: "dev_id", groups: dev_id, qty: 1 });
    const old_group_data = await group_dev.getData({ variables: "dev_id", groups: dev_id });
    const old_org_data = await org_dev.getData({ variables: "dev_id", groups: dev_id });

    await org_dev.editData({ ...old_group_data, ...old_dev_id });
    await group_dev.editData({ ...old_org_data, ...old_dev_id });
  }

  if (new_group_id || new_group_id === "") {
    const { name: current_device_name, tags: current_device_tags, connector } = await account.devices.info(dev_id);

    //removing data from the last group
    if (current_group_id && current_group_id !== "") {
      const old_group_dev = await Utils.getDevice(account, current_group_id);
      await old_group_dev.deleteData({ variables: "dev_id", groups: dev_id });
    }

    const new_device_tags = current_device_tags.filter((x) => x.key !== "group_id");
    new_device_tags.push({ key: "group_id", value: new_group_id });
    await account.devices.edit(dev_id, { tags: new_device_tags });

    const device_params = await account.devices.paramList(dev_id);
    const go_to_param = device_params.find((x) => x.key === "dashboard_url");

    const { id: dash_id } = await findDashboardByConnectorID(account, connector);

    const new_url = `https://admin.tago.io/dashboards/info/${dash_id}?org_dev=${org_id}&sensor=${dev_id}`;

    await account.devices.paramSet(dev_id, { ...go_to_param, value: new_url });

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

    const group_dev = await Utils.getDevice(account, new_group_id);
    await group_dev.sendData(to_tago);
  }
}

export { sensorEdit };
