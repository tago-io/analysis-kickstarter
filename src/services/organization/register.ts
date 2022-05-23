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
  new_org_plan_group: string;
}

async function installDevice({ account, new_org_name, new_org_plan_group }: installDeviceParam) {
  //structuring data
  const device_data: DeviceCreateInfo = {
    name: new_org_name,
    network: "5bbd0d144051a50034cd19fb",
    connector: "5f5a8f3351d4db99c40dece5",
    type: "mutable",
  };

  //creating new device
  const new_org = await account.devices.create(device_data);

  //inserting device id -> so we can reference this later
  await account.devices.edit(new_org.device_id, {
    tags: [
      { key: "organization_id", value: new_org.device_id },
      { key: "user_org_id", value: new_org.device_id },
      { key: "device_type", value: "organization" },
      { key: "plan_group", value: new_org_plan_group },
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

  const new_org_plan_group = scope.find((x) => x.variable === "new_org_plan_group");

  const new_user_name = scope.find((x) => x.variable === "new_orgadmin_name");
  const new_user_email = scope.find((x) => x.variable === "new_orgadmin_email");

  if (!new_org_plan && !new_org_plan_group) {
    throw validate("Plan error, internal problem.", "danger");
  }

  if (new_user_email) {
    const [user_exists] = await account.run.listUsers({
      page: 1,
      amount: 1,
      filter: { email: new_user_email.value as string },
    });

    if (user_exists) {
      throw validate("#VAL.USER_ALREADY_EXISTS#", "danger");
    }
  }

  let [plan_data] = await config_dev.getData({ variables: "plan_data", values: new_org_plan?.value, qty: 1 });

  //sign up route ~ place an environment variable "plan_group" on analysis [TagoIO] - User Signup
  if (new_org_plan_group) {
    [plan_data] = await config_dev.getData({ variables: "plan_data", groups: new_org_plan_group?.value as string, qty: 1 });
  }

  const plan_name = plan_data.value as string;

  if ((new_org_name.value as string).length < 3) {
    throw validate("Name field is smaller than 3 character", "danger");
  }

  const [org_exists] = await config_dev.getData({ variables: "org_name", values: new_org_name.value, qty: 1 }); /** */
  const { id: config_dev_id } = await config_dev.info();

  if (org_exists) {
    throw validate("#VAL.ORG_ALREADY_EXISTS#", "danger");
  }

  const user_auth_token = await account.ServiceAuthorization.tokenCreate({ name: `${new_org_name.value}_token`, permission: "full" });

  //need device id to configure group in parseTagoObject
  //creating new device
  const { device_id, device: org_dev } = await installDevice({ account, new_org_name: new_org_name.value as string, new_org_plan_group: plan_data.group as string });

  const dash_organization_id = await findDashboardByExportID(account, "dash_sensor_list");

  await account.devices.paramSet(device_id, {
    key: "dashboard_url",
    value: `https://admin.tago.io/dashboards/info/${dash_organization_id}?settings=${config_dev_id}&org_dev=${device_id}`,
  });
  await account.devices.paramSet(device_id, { key: "org_address", value: (new_org_address?.value as string) || "N/A", sent: false });
  await account.devices.paramSet(device_id, { key: "org_auth_token", value: user_auth_token.token, sent: false });
  await account.devices.paramSet(device_id, { key: "_param", value: "", sent: false });
  await account.devices.paramSet(device_id, { key: "plan_name", value: plan_name, sent: false });
  await account.devices.paramSet(device_id, { key: "plan_email_limit", value: String(plan_data.metadata.email_limit), sent: false });
  await account.devices.paramSet(device_id, { key: "plan_sms_limit", value: String(plan_data.metadata.sms_limit), sent: false });
  await account.devices.paramSet(device_id, { key: "plan_notif_limit", value: String(plan_data.metadata.notif_limit), sent: false });
  await account.devices.paramSet(device_id, { key: "plan_data_retention", value: String(plan_data.metadata.data_retention), sent: false });
  await account.devices.paramSet(device_id, { key: "plan_email_limit_usage", value: "0", sent: false });
  await account.devices.paramSet(device_id, { key: "plan_sms_limit_usage", value: "0", sent: false });
  await account.devices.paramSet(device_id, { key: "plan_notif_limit_usage", value: "0", sent: false });

  const org_data = {
    org_id: { value: device_id, metadata: { label: new_org_name.value }, location: new_org_address?.location },
  };

  await config_dev.sendData(parseTagoObject(org_data, device_id));

  await org_dev.sendData({ ...plan_data });

  if (new_user_name?.value) {
    scope = scope.map((data) => ({ ...data, device: device_id }));
    await registerUser({ config_dev, context, scope, account, environment }).catch((msg) => {
      return validate(msg, "danger");
    });
  }

  validate("#VAL.ORGANIZATION_SUCCESSFULLY_CREATED#", "success");

  return device_id;
};
