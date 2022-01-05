import { Device, Account, Types, Utils } from "@tago-io/sdk";
import { DeviceCreateInfo } from "@tago-io/sdk/out/modules/Account/devices.types";
import validation from "../../lib/validation";
import { DeviceCreated, RouterConstructorData } from "../../types";
import { parseTagoObject } from "../../lib/data.logic";
import { findDashboardByExportID } from "../../lib/findResource";

interface installDeviceParam {
  account: Account;
  new_group_name: string;
  org_id: string;
}

async function installDevice({ account, new_group_name, org_id }: installDeviceParam) {
  //structuring data
  const device_data: DeviceCreateInfo = {
    name: new_group_name,
  };

  //creating new device
  const new_group = await account.devices.create(device_data);

  //inserting device id -> so we can reference this later
  await account.devices.edit(new_group.device_id, {
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

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  const org_id = scope[0].origin as string;
  const org_dev = await Utils.getDevice(account, org_id);

  const validate = validation("group_validation", org_dev);
  validate("#VAL.REGISTERING#", "warning");

  const group_qty = await account.devices.list({
    page: 1,
    fields: ["id", "name"],
    filter: {
      tags: [
        { key: "device_type", value: "group" },
        { key: "organization_id", value: org_id },
      ],
    },
    amount: 10,
    resolveBucketName: false,
  });

  if (group_qty.length >= 2) {
    return validate("#VAL.LIMIT_OF_2_GROUPS_REACHED#", "danger");
  }

  //Collecting data
  // const new_group_org = scope.find((x) => x.variable === "new_group_org");
  const new_group_name = scope.find((x) => x.variable === "new_group_name");
  const new_group_address = scope.find((x) => x.variable === "new_group_address");

  if ((new_group_name.value as string).length < 3) {
    throw validate("#VAL.NAME_FIELD_IS_SMALLER_THAN_3_CHAR#", "danger");
  }

  const [group_exists] = await org_dev.getData({ variables: "group_name", values: new_group_name.value, qty: 1 }); /** */

  if (group_exists) {
    throw validate("#VAL.GROUP_ALREADY_EXISTS#", "danger");
  }

  const { device_id: group_id, device: group_dev } = await installDevice({ account, new_group_name: new_group_name.value as string, org_id });

  const group_data = {
    group_id: {
      value: group_id,
      metadata: {
        label: new_group_name.value,
      },
    },
  };

  const dash_organization_id = await findDashboardByExportID(account, "dash_groupview");

  await account.devices.paramSet(group_id, {
    key: "dashboard_url",
    value: `https://admin.tago.io/dashboards/info/${dash_organization_id}?group_dev=${group_id}&org_dev=${org_id}`,
    sent: false,
  });
  await account.devices.paramSet(group_id, { key: "group_address", value: (new_group_address?.value as string) || "N/A", sent: false });

  //send to organization device
  await org_dev.sendData(parseTagoObject(group_data, group_id));

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
};
