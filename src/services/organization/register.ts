import { Device, Account, Types } from "@tago-io/sdk";
import { DeviceCreateInfo } from "@tago-io/sdk/out/modules/Account/devices.types";
import { parseTagoObject } from "../../lib/data.logic";
import { findDashboardByExportID } from "../../lib/findResource";
import validation from "../../lib/validation";
import { DeviceCreated, RouterConstructorData } from "../../types";
import registerUser from "../user/register";

interface installDeviceParam {
  account: Account;
  new_org_name: string;
}

async function installDevice({ account, new_org_name }: installDeviceParam) {
  //structuring data
  const device_data: DeviceCreateInfo = {
    name: new_org_name,
  };

  //creating new device
  const new_org = await account.devices.create(device_data);

  //inserting device id -> so we can reference this later
  await account.devices.edit(new_org.device_id, {
    tags: [
      { key: "organization_id", value: new_org.device_id },
      { key: "user_org_id", value: new_org.device_id },
      { key: "device_type", value: "organization" },
    ],
  });

  //instantiating new device
  const new_org_dev = new Device({ token: new_org.token });

  //token, device_id, bucket_id
  return { ...new_org, device: new_org_dev } as DeviceCreated;
}
export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  //validation
  const validate = validation("org_validation", config_dev);
  validate("#VAL.RESGISTERING#", "warning");

  //Collecting data
  const new_org_name = scope.find((x) => x.variable === "new_org_name");
  const new_org_address = scope.find((x) => x.variable === "new_org_address");
  const new_org_plan = scope.find((x) => x.variable === "new_org_plan");

  const new_user_name = scope.find((x) => x.variable === "new_orgadmin_name");

  const [plan_data] = await config_dev.getData({ variables: "plan_data", values: new_org_plan.value, qty: 1 });

  if (!plan_data) {
    throw validate("Plan not found, internally problem.", "danger");
  }

  if ((new_org_name.value as string).length < 3) {
    throw validate("Name field is smaller than 3 character", "danger");
  }

  const [org_exists] = await config_dev.getData({ variables: "org_name", values: new_org_name.value, qty: 1 }); /** */
  const { id: config_dev_id } = await config_dev.info();

  if (org_exists) {
    throw validate("#VAL.ORG_ALREADY_EXISTS#", "danger");
  }

  const user_auth_token = await account.ServiceAuthorization.tokenCreate({ name: `${new_org_name.value}_token`, permission: "full" });

  //need device id to configure serie in parseTagoObject
  //creating new device
  const { device_id, device: org_dev } = await installDevice({ account, new_org_name: new_org_name.value as string });

  const dash_organization_id = await findDashboardByExportID(account, "dash_sensor_list");

  await account.devices.paramSet(device_id, {
    key: "dashboard_url",
    value: `https://admin.tago.io/dashboards/info/${dash_organization_id}?settings=${config_dev_id}&org_dev=${device_id}`,
  });
  await account.devices.paramSet(device_id, { key: "org_address", value: (new_org_address?.value as string) || "N/A", sent: false });
  await account.devices.paramSet(device_id, { key: "org_auth_token", value: user_auth_token.token, sent: false });
  await account.devices.paramSet(device_id, { key: "_param", value: "", sent: false });
  await account.devices.paramSet(device_id, { key: "plan_name", value: new_org_plan.value as string, sent: false });
  await account.devices.paramSet(device_id, { key: "plan_email_limit", value: String(plan_data.metadata.email_limit), sent: false });
  await account.devices.paramSet(device_id, { key: "plan_sms_limit", value: String(plan_data.metadata.sms_limit), sent: false });
  await account.devices.paramSet(device_id, { key: "plan_data_retention", value: String(plan_data.metadata.data_retention), sent: false });

  const org_data = {
    org_id: { value: device_id, metadata: { label: new_org_name.value }, location: new_org_address?.location },
  };

  await config_dev.sendData(parseTagoObject(org_data, device_id));

  await org_dev.sendData({ ...plan_data });

  if (new_user_name?.value) {
    scope = scope.map((data) => ({ ...data, origin: device_id }));
    await registerUser({ config_dev, context, scope, account, environment });
  }

  validate("#VAL.ORGANIZATION_SUCCESSFULLY_CREATED#", "success");

  return device_id;
};
