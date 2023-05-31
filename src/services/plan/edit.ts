import { Account, Utils } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
import { fetchDeviceList } from "../../lib/fetchDeviceList";
import { RouterConstructorData } from "../../types";

const resolveOrg = async (account: Account, org: DeviceListItem, plan_data: Data) => {
  if(!org || !plan_data || !account || !plan_data.metadata){
    throw new Error("Missing parameters");
  }
  //changing plan_data variable
  const org_id = org.id;
  const org_dev = await Utils.getDevice(account, org_id);

  const old_plan_data = await org_dev.getData({ variables: "plan_data", query: "last_item" });

  await org_dev.editData({ ...old_plan_data, ...plan_data });

  //changing params
  const org_params = await account.devices.paramList(org_id);
  const plan_name = org_params.find((x) => x.key === "plan_name");
  const plan_email_limit = org_params.find((x) => x.key === "plan_email_limit") || { key: "plan_email_limit", value: "", sent: false };
  const plan_sms_limit = org_params.find((x) => x.key === "plan_sms_limit") || { key: "plan_sms_limit", value: "", sent: false };
  const plan_notif_limit = org_params.find((x) => x.key === "plan_notif_limit") || { key: "plan_notif_limit", value: "", sent: false };
  const plan_data_retention = org_params.find((x) => x.key === "plan_data_retention") || { key: "plan_data_retention", value: "", sent: false };

  await account.devices.paramSet(org_id, { ...plan_name, value: plan_data.value as string });
  await account.devices.paramSet(org_id, { ...plan_email_limit, value: String(plan_data.metadata.email_limit) });
  await account.devices.paramSet(org_id, { ...plan_sms_limit, value: String(plan_data.metadata.sms_limit) });
  await account.devices.paramSet(org_id, { ...plan_notif_limit, value: String(plan_data.metadata.notif_limit) });
  await account.devices.paramSet(org_id, { ...plan_data_retention, value: String(plan_data.metadata.data_retention) });
};

/**
 * Main function of editing plan by admin account
 * @param config_dev Device of the configuration
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param account Account instanced class
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  if(!account || !environment || !scope || !config_dev || !context){
    throw new Error("Missing parameters");
  }
  const plan_name = scope.find((x) => x.variable === "plan_data");
  const plan_email_limit = scope.find((x) => x.variable === "plan_email_limit");
  const plan_sms_limit = scope.find((x) => x.variable === "plan_sms_limit");
  const plan_notif_limit = scope.find((x) => x.variable === "plan_notif_limit");
  const plan_data_retention = scope.find((x) => x.variable === "plan_data_retention");

  const plan_group = scope[0].group;

  const [plan_data] = await config_dev.getData({ variables: "plan_data", groups: plan_group, qty: 1 });

  if (!plan_data.value || !plan_data.metadata) {
    throw new Error("Plan not found");
  }

  const org_dev_list = await fetchDeviceList(account, [
    { key: "device_type", value: "organization" },
    { key: "plan_group", value: plan_data.group as string },
  ]);

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
    await resolveOrg(account, org, plan_data);
  }

  //this line must always work synchroniously
  await config_dev.deleteData({ variables: "plan_data", groups: plan_group, qty: 1 });

  await config_dev.sendData(plan_data);

  return console.debug("Plan edited!");
};
