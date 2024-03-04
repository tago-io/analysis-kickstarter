import { Resources } from "@tago-io/sdk";
import { DeviceListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { AnalysisEnvironment, ConfigurationParams } from "@tago-io/sdk/lib/types";

import { deviceNameExists } from "../../lib/device-name-exists";
import { sendNotificationFeedback } from "../../lib/send-notification";
import { undoDeviceChanges } from "../../lib/undo-device-changes";
import { RouterConstructorDevice } from "../../types";

/**
 * Function that handle organization name change
 */
async function handleOrgNameChange(config_id: string, scope: DeviceListScope[], environment: AnalysisEnvironment, org_id: string) {
  const new_org_name = scope[0]["name"];
  if (new_org_name) {
    const is_device_name_exists = await deviceNameExists({ name: new_org_name, tags: [{ key: "device_type", value: "organization" }], isEdit: true });

    if (is_device_name_exists) {
      const orgInfo = await Resources.devices.info(org_id);
      await undoDeviceChanges({ deviceInfo: orgInfo, scope });
      await sendNotificationFeedback({ environment, message: `The organization with name ${new_org_name} already exists.` });
      throw `The organization with name ${new_org_name} already exists.`;
    }

    await Resources.devices.deleteDeviceData(config_id, { variables: "org_id", groups: org_id });
    const [org_id_data] = await Resources.devices.getDeviceData(config_id, { variables: "org_id", groups: org_id, qty: 1 });
    await Resources.devices.sendDeviceData(config_id, { ...org_id_data, metadata: { ...org_id_data.metadata, label: new_org_name } });
    await Resources.devices.edit(org_id, { name: new_org_name });
  }
}

/**
 * Function that handle auth token change
 */
async function handleAuthTokenChange(config_id: string, org_id: string, org_auth_token_param: ConfigurationParams) {
  if (org_auth_token_param) {
    const [org_auth_token] = await Resources.devices.getDeviceData(config_id, { variables: "org_auth_token", qty: 1, groups: org_id });
    if (org_auth_token?.value) {
      await Resources.serviceAuthorization.tokenEdit(org_auth_token.value as string, org_auth_token_param.value);
    }
  }
}

/**
 * Function that handle plan name change
 */
async function handlePlanNameChange(config_id: string, scope: DeviceListScope[], org_id: string) {
  const new_plan_name = scope[0]["param.plan_name"];
  if (new_plan_name) {
    const [plan_data] = await Resources.devices.getDeviceData(config_id, { variables: "plan_data", values: new_plan_name, qty: 1 });
    await Resources.devices.deleteDeviceData(org_id, { variables: "plan_data", qty: 9999 });
    await Resources.devices.sendDeviceData(org_id, { ...plan_data });

    const org_params = await Resources.devices.paramList(org_id);

    const plan_name = org_params.find((x) => x.key === "plan_name") || { key: "plan_name", value: "", sent: false };
    const plan_email_limit = org_params.find((x) => x.key === "plan_email_limit") || { key: "plan_email_limit", value: "", sent: false };
    const plan_sms_limit = org_params.find((x) => x.key === "plan_sms_limit") || { key: "plan_sms_limit", value: "", sent: false };
    const plan_notif_limit = org_params.find((x) => x.key === "plan_notif_limit") || { key: "plan_notif_limit", value: "", sent: false };
    const plan_data_retention = org_params.find((x) => x.key === "plan_data_retention") || { key: "plan_data_retention", value: "", sent: false };

    if (!plan_data.metadata) {
      throw "Plan not found";
    }

    const org_info = await Resources.devices.info(org_id);
    const org_tags = org_info.tags;
    const new_org_tags = org_tags.filter((tag) => tag.key !== "plan_group");
    await Resources.devices.edit(org_id, { tags: [...new_org_tags, { key: "plan_group", value: plan_data.group as string }] });

    await Resources.devices.paramSet(org_id, { ...plan_name, value: plan_data.value as string });
    await Resources.devices.paramSet(org_id, { ...plan_email_limit, value: String(plan_data.metadata.email_limit) });
    await Resources.devices.paramSet(org_id, { ...plan_sms_limit, value: String(plan_data.metadata.sms_limit) });
    await Resources.devices.paramSet(org_id, { ...plan_notif_limit, value: String(plan_data.metadata.notif_limit) });
    await Resources.devices.paramSet(org_id, { ...plan_data_retention, value: String(plan_data.metadata.data_retention) });
  }
}

/**
 * Function that handle org address change
 */
async function handleOrgAddressChange(config_id: string, scope: DeviceListScope[], org_id: string) {
  const new_org_address = scope[0]["param.org_address"];
  if (new_org_address) {
    const coordinates = (new_org_address as string).split(";")[0];
    const [org_id_data] = await Resources.devices.getDeviceData(config_id, { variables: "org_id", groups: org_id, qty: 1 });
    await Resources.devices.deleteDeviceData(config_id, { variables: "org_id", groups: org_id });
    await Resources.devices.sendDeviceData(config_id, {
      ...org_id_data,
      metadata: { ...org_id_data.metadata },
      location: { lat: Number(coordinates.split(",")[0]), lng: Number(coordinates.split(",")[1]) },
    });
  }
}

/**
 * Main function of editing organizations
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function orgEdit({ scope, environment }: RouterConstructorDevice & { scope: DeviceListScope[] }) {
  if (!scope || !environment) {
    throw "Missing Router parameter";
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  if (!scope[0]) {
    return console.error("Not a valid TagoIO Data");
  }

  const org_id = scope[0].device;
  const org_params = await Resources.devices.paramList(org_id);
  const org_auth_token_param = org_params.find((x) => x.key === "org_auth_token") as ConfigurationParams;

  await handleOrgNameChange(config_id, scope, environment, org_id);
  await handleAuthTokenChange(config_id, org_id, org_auth_token_param);
  await handlePlanNameChange(config_id, scope, org_id);
  await handleOrgAddressChange(config_id, scope, org_id);

  return console.debug("edited!");
}

export { orgEdit };
