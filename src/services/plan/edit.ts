import { Resources } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/lib/types";

import { fetchDeviceList, FetchDeviceResponse } from "../../lib/fetch-device-list";
import { sendNotificationFeedback } from "../../lib/send-notification";
import { RouterConstructorData } from "../../types";

/**
 * Function that resolves the report of the organization and send it to the user
 */
const resolveOrg = async (org: FetchDeviceResponse, plan_data: Data) => {
  if (!org || !plan_data || !plan_data.metadata) {
    throw new Error("Missing parameters");
  }
  //changing plan_data variable
  const org_id = org.id;

  const old_plan_data = await Resources.devices.getDeviceData(org_id, { variables: "plan_data", query: "last_item" });

  await Resources.devices.editDeviceData(org_id, { ...old_plan_data, ...plan_data });

  //changing params
  const org_params = await Resources.devices.paramList(org_id);
  const plan_name = org_params.find((x) => x.key === "plan_name");
  const plan_email_limit = org_params.find((x) => x.key === "plan_email_limit") || { key: "plan_email_limit", value: "", sent: false };
  const plan_sms_limit = org_params.find((x) => x.key === "plan_sms_limit") || { key: "plan_sms_limit", value: "", sent: false };
  const plan_notif_limit = org_params.find((x) => x.key === "plan_notif_limit") || { key: "plan_notif_limit", value: "", sent: false };
  const plan_data_retention = org_params.find((x) => x.key === "plan_data_retention") || { key: "plan_data_retention", value: "", sent: false };

  await Resources.devices.paramSet(org_id, { ...plan_name, value: plan_data.value as string });
  await Resources.devices.paramSet(org_id, { ...plan_email_limit, value: String(plan_data.metadata.email_limit) });
  await Resources.devices.paramSet(org_id, { ...plan_sms_limit, value: String(plan_data.metadata.sms_limit) });
  await Resources.devices.paramSet(org_id, { ...plan_notif_limit, value: String(plan_data.metadata.notif_limit) });
  await Resources.devices.paramSet(org_id, { ...plan_data_retention, value: String(plan_data.metadata.data_retention) });
};

/**
 * Function that validates the limit values of the plan variables and throws an error if the value is invalid or negative integer
 */
async function _validateLimitValues(
  plan_email_limit: Data | undefined,
  plan_sms_limit: Data | undefined,
  plan_notif_limit: Data | undefined,
  plan_data_retention: Data | undefined
) {
  if (plan_email_limit && ((plan_email_limit.value as number) < 0 || !Number.isInteger(plan_email_limit.value))) {
    return Promise.reject("Email Limit must be a non-negative integer value");
  }
  if (plan_sms_limit && ((plan_sms_limit.value as number) < 0 || !Number.isInteger(plan_sms_limit.value))) {
    return Promise.reject("SMS Limit must be a non-negative integer value");
  }
  if (plan_notif_limit && ((plan_notif_limit.value as number) < 0 || !Number.isInteger(plan_notif_limit.value))) {
    return Promise.reject("Push Notification Limit must be a non-negative integer value");
  }
  if (plan_data_retention && ((plan_data_retention.value as number) < 0 || !Number.isInteger(plan_data_retention.value))) {
    return Promise.reject("Data Retention must be a non-negative integer value");
  }
}

/**
 * Undo Plan changes in the settings device.
 */
async function _undoPlanChanges(scope: Data[], config_id: string) {
  const groups = scope[0].group;
  const variables = await Resources.devices.getDeviceData(config_id, { variables: ["plan_email_limit", "plan_sms_limit", "plan_notif_limit", "plan_data_retention"], groups });
  for (const variable of variables) {
    const variableValue = variable.variable.replace(new RegExp("plan_" + "_?"), "");
    if (variable.variable === `plan_${variableValue}`) {
      variable.value = scope.find((x) => x.variable === `plan_${variableValue}`)?.metadata?.old_value ?? variable.value;
    }
  }
  await Resources.devices.editDeviceData(config_id, variables);
}

/**
 * Main function of editing plan by admin account
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function planEdit({ context, scope, environment }: RouterConstructorData) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const plan_name = scope.find((x) => x.variable === "plan_data");
  const plan_email_limit = scope.find((x) => x.variable === "plan_email_limit");
  const plan_sms_limit = scope.find((x) => x.variable === "plan_sms_limit");
  const plan_notif_limit = scope.find((x) => x.variable === "plan_notif_limit");
  const plan_data_retention = scope.find((x) => x.variable === "plan_data_retention");

  await _validateLimitValues(plan_email_limit, plan_sms_limit, plan_notif_limit, plan_data_retention).catch(async (error) => {
    await _undoPlanChanges(scope, config_id);
    await sendNotificationFeedback({ environment, message: error });
    throw error;
  });

  const plan_group = scope[0].group;

  const [plan_data] = await Resources.devices.getDeviceData(config_id, { variables: "plan_data", groups: plan_group, qty: 1 });

  if (!plan_data.value || !plan_data.metadata) {
    throw new Error("Plan not found");
  }

  const org_dev_list = await fetchDeviceList({
    tags: [
      { key: "device_type", value: "organization" },
      { key: "plan_group", value: plan_data.group as string },
    ],
  });

  //change plan_data
  if (plan_name) {
    plan_data.value = plan_name.value;
  }
  if (plan_email_limit) {
    plan_data.metadata.email_limit = plan_email_limit.value;
  }
  if (plan_sms_limit) {
    plan_data.metadata.sms_limit = plan_sms_limit.value;
  }
  if (plan_notif_limit) {
    plan_data.metadata.notif_limit = plan_notif_limit.value;
  }
  if (plan_data_retention) {
    plan_data.metadata.data_retention = plan_data_retention.value;
  }

  for (const org of org_dev_list) {
    await resolveOrg(org, plan_data);
  }

  //this line must always work synchronously
  await Resources.devices.deleteDeviceData(config_id, { variables: "plan_data", groups: plan_group, qty: 1 });

  await Resources.devices.sendDeviceData(config_id, plan_data);

  return console.debug("Plan edited!");
}

export { planEdit };
