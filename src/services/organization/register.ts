import { Resources } from "@tago-io/sdk";
import { DeviceCreateInfo } from "@tago-io/sdk/lib/types";

import { parseTagoObject } from "../../lib/data.logic";
import { deviceNameExists } from "../../lib/device-name-exists";
import { getDashboardByTagID } from "../../lib/find-resource";
import { initializeValidation } from "../../lib/validation";
import { RouterConstructorData } from "../../types";
import { userAdd } from "../user/register";
import { orgDel } from "./remove";

interface installDeviceParam {
  new_org_name: string;
  new_org_plan_group: string;
}
/**
 * Function that create organizations
 * @param new_org_name Organization name configured by the user
 * @param new_org_plan_group User configured plan
 */
async function installDevice({ new_org_name, new_org_plan_group }: installDeviceParam) {
  //structuring data
  const device_data: DeviceCreateInfo = {
    name: new_org_name,
    network: "5bbd0d144051a50034cd19fb",
    connector: "5f5a8f3351d4db99c40dece5",
    type: "mutable",
  };

  //creating new device
  const new_org = await Resources.devices.create(device_data);

  //inserting device id -> so we can reference this later
  await Resources.devices.edit(new_org.device_id, {
    tags: [
      { key: "organization_id", value: new_org.device_id },
      { key: "user_org_id", value: new_org.device_id },
      { key: "device_type", value: "organization" },
      { key: "plan_group", value: new_org_plan_group },
    ],
  });

  return new_org.device_id;
}

/**
 * Main function of creating organizations
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment is a variable sent by the analysis
 */
async function orgAdd({ context, scope, environment }: RouterConstructorData) {
  if (!("variable" in scope[0])) {
    return console.error("Not a valid TagoIO Data");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const validate = initializeValidation("org_validation", config_id);
  await validate("#VAL.RESGISTERING#", "warning").catch((error) => console.log(error));

  //Collecting data
  const new_org_name = scope.find((x) => x.variable === "new_org_name");
  const new_org_address = scope.find((x) => x.variable === "new_org_address");
  const new_org_plan = scope.find((x) => x.variable === "new_org_plan");

  const new_org_plan_group = scope.find((x) => x.variable === "new_org_plan_group");

  const new_user_name = scope.find((x) => x.variable === "new_orgadmin_name");
  const new_user_email = scope.find((x) => x.variable === "new_orgadmin_email");

  if (!new_org_plan && !new_org_plan_group) {
    throw await validate("Plan error, internal problem.", "danger").catch((error) => console.log(error));
  }

  if (new_user_email) {
    const [user_exists] = await Resources.run.listUsers({
      page: 1,
      amount: 1,
      filter: { email: new_user_email.value as string },
    });

    if (user_exists) {
      throw await validate("#VAL.USER_ALREADY_EXISTS#", "danger").catch((error) => console.log(error));
    }
  }

  if (!new_org_name) {
    throw await validate("Name field is empty", "danger").catch((error) => console.log(error));
  }

  let [plan_data] = await Resources.devices.getDeviceData(config_id, { variables: "plan_data", values: new_org_plan?.value, qty: 1 });

  //sign up route ~ place an environment variable "plan_group" on analysis [TagoIO] - User Signup
  if (new_org_plan_group) {
    [plan_data] = await Resources.devices.getDeviceData(config_id, { variables: "plan_data", groups: new_org_plan_group?.value as string, qty: 1 });
  }
  if (!plan_data || !plan_data?.metadata) {
    throw await validate("Plan error, internal problem.", "danger").catch((error) => console.log(error));
  }
  const plan_name = plan_data.value as string;

  if ((new_org_name.value as string).length < 3) {
    throw await validate("Name field is smaller than 3 character", "danger").catch((error) => console.log(error));
  }

  const is_device_name_exists = await deviceNameExists({ name: new_org_name.value as string, tags: [{ key: "device_type", value: "organization" }] });

  if (is_device_name_exists) {
    throw await validate(`The Organization with name ${new_org_name.value} already exists.`, "danger").catch(console.log);
  }

  const service_authorization = new Resources({ token: environment.ACCOUNT_TOKEN }).serviceAuthorization;
  const user_auth_token = await service_authorization.tokenCreate({
    name: `${new_org_name.value}_token`,
    permission: "full",
  });

  //need device id to configure group in parseTagoObject
  //creating new device
  const device_id = await installDevice({ new_org_name: new_org_name.value as string, new_org_plan_group: plan_data.group as string });

  const dash_organization_id = await getDashboardByTagID("dash_sensor_list");

  await Resources.devices.paramSet(device_id, {
    key: "dashboard_url",
    value: `https://admin.tago.io/dashboards/info/${dash_organization_id}?settings=${config_id}&org_dev=${device_id}`,
  });
  await Resources.devices.paramSet(device_id, { key: "org_address", value: (new_org_address?.value as string) || "N/A", sent: false });
  await Resources.devices.paramSet(device_id, { key: "org_auth_token", value: user_auth_token.token, sent: false });
  await Resources.devices.paramSet(device_id, { key: "_param", value: "", sent: false });
  await Resources.devices.paramSet(device_id, { key: "plan_name", value: plan_name, sent: false });
  await Resources.devices.paramSet(device_id, { key: "plan_email_limit", value: String(plan_data.metadata.email_limit), sent: false });
  await Resources.devices.paramSet(device_id, { key: "plan_sms_limit", value: String(plan_data.metadata.sms_limit), sent: false });
  await Resources.devices.paramSet(device_id, { key: "plan_notif_limit", value: String(plan_data.metadata.notif_limit), sent: false });
  await Resources.devices.paramSet(device_id, { key: "plan_data_retention", value: String(plan_data.metadata.data_retention), sent: false });
  await Resources.devices.paramSet(device_id, { key: "plan_email_limit_usage", value: "0", sent: false });
  await Resources.devices.paramSet(device_id, { key: "plan_sms_limit_usage", value: "0", sent: false });
  await Resources.devices.paramSet(device_id, { key: "plan_notif_limit_usage", value: "0", sent: false });

  const org_data = {
    org_id: { value: device_id, metadata: { label: new_org_name.value }, location: new_org_address?.location },
  };

  await Resources.devices.sendDeviceData(config_id, parseTagoObject(org_data, device_id));

  await Resources.devices.sendDeviceData(device_id, { ...plan_data });

  if (new_user_name?.value) {
    scope = scope.map((data) => ({ ...data, device: device_id }));
    await userAdd({ context, scope, environment }).catch(async (error) => {
      // @ts-expect-error - expected error.
      await orgDel({ scope: [{ device: device_id }] }).catch((error) => console.log(error));
      throw await validate(error, "danger").catch((error) => console.log(error));
    });
  }

  await validate("#VAL.ORGANIZATION_SUCCESSFULLY_CREATED#", "success").catch((error) => console.log(error));

  return device_id;
}

export { orgAdd };
