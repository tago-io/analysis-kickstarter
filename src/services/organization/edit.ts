import { Utils } from "@tago-io/sdk";
import { RouterConstructorDevice } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorDevice) => {
  const org_id = (scope[0] as any).device;
  const org_dev = await Utils.getDevice(account, org_id);

  const org_params = await account.devices.paramList(org_id);

  const org_auth_token_param = org_params.find((x) => x.key === "org_auth_token");
  const new_plan_name = (scope[0] as any)["param.plan_name"];
  const new_org_name = (scope[0] as any)["name"];

  const [org_id_data] = await config_dev.getData({ variables: "org_id", series: org_id, qty: 1 });

  if (new_org_name) {
    await config_dev.deleteData({ variables: "org_id", series: org_id });
    await config_dev.sendData({ ...org_id_data, metadata: { ...org_id_data.metadata, label: new_org_name } });
    await account.devices.edit(org_id, { name: new_org_name as string });
  }

  if (org_auth_token_param) {
    const [org_auth_token] = await config_dev.getData({ variables: "org_auth_token", qty: 1, series: org_id });
    if (org_auth_token?.value) {
      await account.ServiceAuthorization.tokenEdit(org_auth_token.value as string, org_auth_token_param.value as string);
    }
  }
  if (new_plan_name) {
    const [plan_data] = await config_dev.getData({ variables: "plan_data", values: new_plan_name, qty: 1 });
    await org_dev.deleteData({ variables: "plan_data", qty: 9999 });
    await org_dev.sendData({ ...plan_data });

    const org_params = await account.devices.paramList(org_id);
    const plan_name = org_params.find((x) => x.key === "plan_name") || { key: "plan_name", value: "", sent: false };
    const plan_email_limit = org_params.find((x) => x.key === "plan_email_limit") || { key: "plan_email_limit", value: "", sent: false };
    const plan_sms_limit = org_params.find((x) => x.key === "plan_sms_limit") || { key: "plan_sms_limit", value: "", sent: false };
    const plan_notif_limit = org_params.find((x) => x.key === "plan_notif_limit") || { key: "plan_notif_limit", value: "", sent: false };
    const plan_data_retention = org_params.find((x) => x.key === "plan_data_retention") || { key: "plan_data_retention", value: "", sent: false };

    const org_tags = (await org_dev.info()).tags;
    const new_org_tags = org_tags.filter((tag) => tag.key !== "plan_serie");
    await account.devices.edit(org_id, { tags: [...new_org_tags, { key: "plan_serie", value: plan_data.serie as string }] });

    await account.devices.paramSet(org_id, { ...plan_name, value: plan_data.value as string });
    await account.devices.paramSet(org_id, { ...plan_email_limit, value: String(plan_data.metadata.email_limit) });
    await account.devices.paramSet(org_id, { ...plan_sms_limit, value: String(plan_data.metadata.sms_limit) });
    await account.devices.paramSet(org_id, { ...plan_notif_limit, value: String(plan_data.metadata.notif_limit) });
    await account.devices.paramSet(org_id, { ...plan_data_retention, value: String(plan_data.metadata.data_retention) });
  }
  return console.log("edited!");
};
