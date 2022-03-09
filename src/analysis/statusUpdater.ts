import { Utils, Services, Account, Device, Types, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { ConfigurationParams, DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import moment from "moment-timezone";
import { parseTagoObject } from "../lib/data.logic";
import { checkinTrigger } from "../services/alerts/checkinAlerts";

const resolveOrg = async (account: Account, org: DeviceListItem) => {
  let total_qty = 0;
  let active_qty = 0;
  let inactivy_qty = 0;
  const org_id = org.id;

  const sensorList = await account.devices.list({
    page: 1,
    fields: ["id", "name", "tags", "last_input"],
    filter: {
      tags: [
        { key: "organization_id", value: org.id },
        { key: "device_type", value: "device" },
      ],
    },
    amount: 10000,
  });

  sensorList.forEach((sensor) => {
    const last_input = moment(sensor.last_input);
    const now = moment();
    const diff_time = now.diff(last_input, "hours");
    total_qty++;
    if (diff_time < 24) {
      active_qty++;
    } else {
      inactivy_qty++;
    }
  });

  const org_dev = await Utils.getDevice(account, org_id);

  const org_params = await account.devices.paramList(org_id);

  const plan_email_limit_usage = org_params.find((x) => x.key === "plan_email_limit_usage")?.value || "0";
  const plan_sms_limit_usage = org_params.find((x) => x.key === "plan_sms_limit_usage")?.value || "0";
  const plan_notif_limit_usage = org_params.find((x) => x.key === "plan_notif_limit_usage")?.value || "0";
  const plan_data_retention = org_params.find((x) => x.key === "plan_data_retention")?.value || "0";

  const to_tago = {
    total_qty,
    active_qty,
    inactivy_qty,
    plan_email_limit_usage,
    plan_sms_limit_usage,
    plan_notif_limit_usage,
    plan_data_retention,
  };
  //CONSIDER INSTEAD OF DELETEING VARIABLES, PLACE A DATA RETENTION RULE AND SHOW THEM IN A HISTORIC GRAPIHC ON THE WIDGET HEADER BUTTON
  await org_dev.deleteData({
    variables: ["total_qty", "active_qty", "inactivy_qty", "plan_email_limit_usage", "plan_sms_limit_usage", "plan_notif_limit_usage", "plan_data_retention"],
    qty: 9999,
  });
  await org_dev.sendData(parseTagoObject(to_tago));
};

const dispatchEmailAlert = async (account: Account, context: TagoContext, org_id: string, time: string, device_name: string) => {
  const emailService = new Services({ token: context.token }).email;

  const users = await account.run.listUsers({
    page: 1,
    fields: ["id", "name", "phone", "email", "tags"],
    filter: {
      tags: [{ key: "organization_id", value: org_id }],
    },
    amount: 10000,
  });

  users.forEach((user) => {
    emailService.send({ to: user.email, template: { name: "checkin_alert", params: { name: user.name, device_name, time, time_unit: "h" } } });
  });
};

const checkLocation = async (account: Account, device: Device) => {
  const [location_data] = await device.getData({ variables: "location", qty: 1 });

  if (!location_data) {
    return "No location sent by device";
  }

  const device_info = await device.info();
  const site_id = device_info.tags.find((x) => x.key === "site_id")?.value;

  if (!site_id) {
    return "No site addressed to the sensor";
  }

  const site_dev = await Utils.getDevice(account, site_id);
  const [dev_id] = await site_dev.getData({ variables: "dev_id", series: device_info.id, qty: 1 });
  if (
    (dev_id?.location as any).coordinates[0] === (location_data.location as any).coordinates[0] &&
    (dev_id?.location as any).coordinates[1] === (location_data.location as any).coordinates[1]
  ) {
    return "Same position";
  }
  await site_dev.deleteData({ variables: "dev_id", series: device_info.id, qty: 1 });
  dev_id.location = location_data.location;
  delete dev_id.time;

  await site_dev.sendData({ ...dev_id });
};

async function resolveDevice(context: TagoContext, account: Account, org_id: string, device_id: string) {
  const device = await Utils.getDevice(account, device_id);
  const org_dev = await Utils.getDevice(account, org_id);

  checkLocation(account, device);

  const device_info = await account.devices.info(device_id);

  const checkin_date = moment(device_info.last_input as Date);

  if (!checkin_date) {
    return "no data";
  }

  let diff_hours: string | number = moment().diff(checkin_date, "hours");

  if (diff_hours !== diff_hours) {
    diff_hours = "-";
  } //checking for NaN

  const device_params = await account.devices.paramList(device_id);
  const dev_lastcheckin_param = device_params.find((param) => param.key === "dev_lastcheckin") || { key: "dev_lastcheckin", value: String(diff_hours), sent: false };
  const dev_battery_param = device_params.find((param) => param.key === "dev_battery") || { key: "dev_battery", value: "-", sent: false };

  await checkinTrigger(account, context, org_id, { device_id, last_input: device_info.last_input });

  await account.devices.paramSet(device_id, { ...dev_lastcheckin_param, value: String(diff_hours), sent: diff_hours >= 24 ? true : false });

  const [dev_battery] = await device.getData({ variables: "battery_capacity", qty: 1 });

  if (dev_battery?.value) {
    await account.devices.paramSet(device_id, { ...dev_battery_param, value: String(dev_battery.value) });
  }
}

async function handler(context: TagoContext, scope: Data[]): Promise<void> {
  context.log("Running Analysis");

  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  } else if (!environment.config_token) {
    throw "Missing config_token environment var";
  } else if (!environment.account_token) {
    throw "Missing account_token environment var";
  }

  const config_dev = new Device({ token: environment.config_token });
  const account = new Account({ token: environment.account_token });

  const orgList = await account.devices.list({
    page: 1,
    fields: ["id", "name", "tags", "last_input"],
    filter: { tags: [{ key: "device_type", value: "organization" }] },
    amount: 10000,
  });

  orgList.map((org) => resolveOrg(account, org));

  const sensorList = await account.devices.list({
    page: 1,
    fields: ["id", "name", "tags", "last_input"],
    filter: { tags: [{ key: "device_type", value: "device" }] },
    amount: 10000,
  });

  sensorList.map((device) =>
    resolveDevice(context, account, device.tags.find((tag) => tag.key === "organization_id")?.value as string, device.tags.find((tag) => tag.key === "device_id")?.value as string)
  );
}

async function startAnalysis(context: TagoContext, scope: any) {
  try {
    await handler(context, scope);
    context.log("Analysis finished");
  } catch (error) {
    console.log(error);
    context.log(error.message || JSON.stringify(error));
  }
}

export default new Analysis(startAnalysis, { token: "cab6674c-69b2-412f-b82d-ad2d80a21fb8" });
