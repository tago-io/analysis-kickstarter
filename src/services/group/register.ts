import { Device, Resources } from "@tago-io/sdk";
import { DeviceCreateInfo } from "@tago-io/sdk/lib/types";

import { parseTagoObject } from "../../lib/data.logic";
import { deviceNameExists } from "../../lib/device-name-exists";
import { fetchDeviceList } from "../../lib/fetch-device-list";
import { getDashboardByTagID } from "../../lib/find-resource";
import { initializeValidation } from "../../lib/validation";
import { DeviceCreated, RouterConstructorData } from "../../types";

interface installDeviceParam {
  new_group_name: string;
  org_id: string;
}
/**
 * Function that create groups
 * @param new_group_name Group name that will be created
 * @param org_id Organization id that the group will be created
 */
async function installDevice({ new_group_name, org_id }: installDeviceParam) {
  //structuring data
  const device_data: DeviceCreateInfo = {
    name: new_group_name,
    network: "5bbd0d144051a50034cd19fb",
    connector: "5f5a8f3351d4db99c40dece5",
    type: "mutable",
  };

  //creating new device
  const new_group = await Resources.devices.create(device_data);

  //inserting device id -> so we can reference this later
  await Resources.devices.edit(new_group.device_id, {
    tags: [
      { key: "group_id", value: new_group.device_id },
      { key: "organization_id", value: org_id },
      { key: "device_type", value: "group" },
    ],
  });

  //instantiating new device
  const new_org_dev = new Device({ token: new_group.token });

  //token, device_id, bucket_id
  return { ...new_group, device: new_org_dev } as DeviceCreated;
}

/**
 * Main function of creating groups
 * @param context Context is a variable sent by the analysis
 * @param scope Number of devices that will be listed
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function groupAdd({ context, scope, environment }: RouterConstructorData) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }
  const org_id = scope[0].device;

  const validate = initializeValidation("group_validation", org_id);
  await validate("#VAL.REGISTERING#", "warning").catch((error) => console.error(error));

  const group_qty = await fetchDeviceList({
    tags: [
      { key: "device_type", value: "group" },
      { key: "organization_id", value: org_id },
    ],
  });

  if (group_qty.length >= 2) {
    return await validate("#VAL.LIMIT_OF_2_GROUPS_REACHED#", "danger").catch((error) => console.error(error));
  }

  //Collecting data
  // const new_group_org = scope.find((x) => x.variable === "new_group_org");
  const new_group_name = scope.find((x) => x.variable === "new_group_name");
  const new_group_address = scope.find((x) => x.variable === "new_group_address");

  if (!new_group_name) {
    throw new Error("new_group_name is missing");
  }

  if ((new_group_name.value as string).length < 3) {
    throw await validate("#VAL.NAME_FIELD_IS_SMALLER_THAN_3_CHAR#", "danger").catch((error) => console.error(error));
  }

  const [group_exists] = await Resources.devices.getDeviceData(org_id, { variables: "group_name", values: new_group_name.value, qty: 1 }); /** */

  const is_device_name_exists = await deviceNameExists({
    name: new_group_name.value as string,
    tags: [
      { key: "device_type", value: "group" },
      { key: "organization_id", value: org_id },
    ],
  });

  if (is_device_name_exists) {
    throw await validate("#VAL.GROUP_ALREADY_EXISTS#", "danger").catch((error) => console.error(error));
  }

  if (group_exists) {
    throw await validate("#VAL.GROUP_ALREADY_EXISTS#", "danger").catch((error) => console.error(error));
  }

  const { device_id: group_id, device: group_dev } = await installDevice({ new_group_name: new_group_name.value as string, org_id });

  const group_data = {
    group_id: {
      value: group_id,
      metadata: {
        label: new_group_name.value,
      },
    },
  };

  const dash_organization_id = await getDashboardByTagID("dash_groupview");

  await Resources.devices.paramSet(group_id, {
    key: "dashboard_url",
    value: `https://admin.tago.io/dashboards/info/${dash_organization_id}?group_dev=${group_id}&org_dev=${org_id}`,
    sent: false,
  });
  await Resources.devices.paramSet(group_id, { key: "group_address", value: (new_group_address?.value as string) || "N/A", sent: false });

  //send to organization device
  await Resources.devices.sendDeviceData(org_id, parseTagoObject(group_data, group_id));

  //uploading a default layer
  await group_dev.sendData({
    value: "Layer #1",
    variable: "layers",
    metadata: {
      file: {
        path: "buckets/6127d8d10ceb400012b53fc3/layers/Floor Plan Right.png",
        url: "https://api.tago.io/file/61b2f46e561da800197a9c43/Floor%20Plan%20with%20Watermark.png",
        md5: "",
      },
    },
  });

  return validate("#VAL.GROUP_SUCCESSFULLY_CREATED#", "success");
}

export { groupAdd };
