/*
 * KickStarter Analysis
 * Status Updater
 *
 * This analysis is responsible to update organization's plan usage (displayed at Info Dashboard),
 * update the indicators from the organization (total, active and inactive),
 * update sensor's params (last checkin and battery) and update sensors location.
 *
 * Status Updater will run when:
 * - When the scheduled action (Status Updater Trigger) triggers this script. (Default 1 minute)
 *
 * How to setup this analysis
 * Make sure you have the following enviroment variables:
 * - account_token: the value must be a token from your profile. See how to generate account-token at: https://help.tago.io/portal/en/kb/articles/495-account-token.
 */

import { Utils, Account, Device, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import dayjs from "dayjs";
import { queue } from "async";
import { parseTagoObject } from "../lib/data.logic";
import { fetchDeviceList } from "../lib/fetchDeviceList";
import { checkinTrigger } from "../services/alerts/checkinAlerts";

/**
 * Function that update the organization's plan usage
 * @param account Account instance class
 * @param org Organization device
 */
async function resolveOrg(account: Account, org: DeviceListItem) {
  let total_qty = 0;
  let active_qty = 0;
  let inactivy_qty = 0;
  const org_id = org.id;

  const sensorList = await fetchDeviceList(account, [
    { key: "organization_id", value: org.id },
    { key: "device_type", value: "device" },
  ]);

  sensorList.forEach((sensor) => {
    const last_input = dayjs(sensor.last_input);
    const now = dayjs();
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
    device_qty: { value: total_qty, metadata: { total_qty: total_qty, active_qty: active_qty, inactive_qty: inactivy_qty } },
    plan_usage: {
      value: plan_email_limit_usage,
      metadata: {
        plan_email_limit_usage: plan_email_limit_usage,
        plan_sms_limit_usage: plan_sms_limit_usage,
        plan_notif_limit_usage: plan_notif_limit_usage,
        plan_data_retention: plan_data_retention,
      },
    },
  };
  //CONSIDER INSTEAD OF DELETEING VARIABLES, PLACE A DATA RETENTION RULE AND SHOW THEM IN A HISTORIC GRAPIHC ON THE WIDGET HEADER BUTTON
  const old_data = await org_dev.getData({
    variables: ["device_qty", "plan_usage"],
    query: "last_item",
  });
  console.log(old_data);
  const device_data = old_data.find((x) => x.variable === "device_qty");
  const plan_data = old_data.find((x) => x.variable === "plan_usage");
  const new_data = parseTagoObject(to_tago);

  if (!device_data || !plan_data) {
    await org_dev.sendData(new_data);
    return;
  }

  await org_dev.editData([
    { ...device_data, ...new_data[0] },
    { ...plan_data, ...new_data[1] },
  ]);
}

/**
 * Function that update the sensor's params (last checkin and battery)
 * @param account Account instance class
 * @param device Sensor device
 */
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
  const [dev_id] = await site_dev.getData({ variables: "dev_id", groups: device_info.id, qty: 1 });
  if (
    (dev_id?.location as any).coordinates[0] === (location_data.location as any).coordinates[0] &&
    (dev_id?.location as any).coordinates[1] === (location_data.location as any).coordinates[1]
  ) {
    return "Same position";
  }
  await site_dev.editData({ ...dev_id, location: location_data.location });
};

/**
 * Function that update the sensor's params (last checkin and battery)
 * @param context
 * @param account
 * @param org_id
 * @param device_id
 */
async function resolveDevice(context: TagoContext, account: Account, org_id: string, device_id: string) {
  const device = await Utils.getDevice(account, device_id).catch((msg) => console.debug(msg));

  if (!device) {
    throw "Device not found";
  }

  checkLocation(account, device);

  const device_info = await account.devices.info(device_id);
  if(!device_info.last_input){
    throw "Device not found";
  }

  console.log(device_info.last_input);

  const checkin_date = dayjs(device_info.last_input as Date);

  if (!checkin_date) {
    return "no data";
  }

  let diff_hours: string | number = dayjs().diff(checkin_date, "hours");

  if (diff_hours !== diff_hours) {
    diff_hours = "-";
  } //checking for NaN

  const device_params = await account.devices.paramList(device_id);
  const dev_lastcheckin_param = device_params.find((param) => param.key === "dev_lastcheckin") || { key: "dev_lastcheckin", value: String(diff_hours), sent: false };

  await checkinTrigger(account, context, org_id, { device_id, last_input: device_info.last_input });

  await account.devices.paramSet(device_id, { ...dev_lastcheckin_param, value: String(diff_hours), sent: (diff_hours as number) >= 24 ? true : false });
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

  const orgList = await fetchDeviceList(account, [{ key: "device_type", value: "organization" }]);

  orgList.map((org) => resolveOrg(account, org));

  const sensorList = await fetchDeviceList(account, [{ key: "device_type", value: "device" }]);

  //creating queue which will resolve the device

  const processSensorQueue = queue(async (sensorItem: DeviceListItem) => {
    resolveDevice(
      context,
      account,
      sensorItem.tags.find((tag) => tag.key === "organization_id")?.value as string,
      sensorItem.tags.find((tag) => tag.key === "device_id")?.value as string
    ).catch((msg) => console.debug(`${msg} - ${sensorItem.id}`));
  }, 1);

  //populating the queue

  for (const sensorItem of sensorList) {
    processSensorQueue.push(sensorItem);
  }

  //starting the queue

  processSensorQueue.drain();

  //throwing possible errors generated while running the queue

  processSensorQueue.error((error) => {
    console.debug(error);
    process.exit();
  });
}

async function startAnalysis(context: TagoContext, scope: any) {
  try {
    await handler(context, scope);
    context.log("Analysis finished");
  } catch (error) {
    console.debug(error);
    context.log(error.message || JSON.stringify(error));
  }
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
