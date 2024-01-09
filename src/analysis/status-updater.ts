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
 */

import async from "async";
import dayjs from "dayjs";

import { Analysis, Resources, Utils } from "@tago-io/sdk";
import { DeviceInfo, DeviceListItem, TagoContext } from "@tago-io/sdk/lib/types";

import { parseTagoObject } from "../lib/data.logic";
import { fetchDeviceList } from "../lib/fetch-device-list";
import { checkInTrigger } from "../services/alerts/check-in-alerts";

/**
 * Function that update the organization's plan usage
 * @param org Organization device
 */
async function resolveOrg(org: DeviceListItem) {
  let total_qty = 0;
  let active_qty = 0;
  let inactive_qty = 0;
  const org_id = org.id;

  const sensorList = await fetchDeviceList({
    tags: [
      { key: "organization_id", value: org.id },
      { key: "device_type", value: "device" },
    ],
  });

  for (const sensor of sensorList) {
    const last_input = dayjs(sensor.last_input);
    const now = dayjs();
    const diff_time = now.diff(last_input, "hours");
    total_qty++;
    if (diff_time < 24) {
      active_qty++;
    } else {
      inactive_qty++;
    }
  }

  const org_params = await Resources.devices.paramList(org_id);

  const plan_email_limit_usage = org_params.find((x) => x.key === "plan_email_limit_usage")?.value || "0";
  const plan_sms_limit_usage = org_params.find((x) => x.key === "plan_sms_limit_usage")?.value || "0";
  const plan_notif_limit_usage = org_params.find((x) => x.key === "plan_notif_limit_usage")?.value || "0";
  const plan_data_retention = org_params.find((x) => x.key === "plan_data_retention")?.value || "0";

  const to_tago = {
    device_qty: { value: total_qty, metadata: { total_qty: total_qty, active_qty: active_qty, inactive_qty: inactive_qty } },
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
  //CONSIDER INSTEAD OF DELETING VARIABLES, PLACE A DATA RETENTION RULE AND SHOW THEM IN A HISTORIC GRAPHIC ON THE WIDGET HEADER BUTTON
  const old_data = await Resources.devices.getDeviceData(org_id, {
    variables: ["device_qty", "plan_usage"],
    query: "last_item",
  });
  const device_data = old_data.find((x) => x.variable === "device_qty");
  const plan_data = old_data.find((x) => x.variable === "plan_usage");
  const new_data = parseTagoObject(to_tago);

  if (!device_data || !plan_data) {
    await Resources.devices.sendDeviceData(org_id, new_data);
    return;
  }

  await Resources.devices.editDeviceData(org_id, [
    { ...device_data, ...new_data[0] },
    { ...plan_data, ...new_data[1] },
  ]);
}

/**
 * Function that update the sensor's params (last checkin and battery)
 * @param sensor_info - Sensor information
 */
const checkLocation = async (sensor_info: DeviceInfo) => {
  const [location_data] = await Resources.devices.getDeviceData(sensor_info.id, { variables: "location", qty: 1 });

  if (!location_data) {
    return "No location sent by device";
  }

  const site_id = sensor_info.tags.find((x) => x.key === "site_id")?.value;

  if (!site_id) {
    return "No site addressed to the sensor";
  }

  const [dev_id] = await Resources.devices.getDeviceData(site_id, { variables: "dev_id", groups: sensor_info.id, qty: 1 });
  if (
    (dev_id?.location as any).coordinates[0] === (location_data.location as any).coordinates[0] &&
    (dev_id?.location as any).coordinates[1] === (location_data.location as any).coordinates[1]
  ) {
    return "Same position";
  }
  await Resources.devices.editDeviceData(site_id, { ...dev_id, location: location_data.location });
};

/**
 * Function that update the sensor's params (last checkin and battery)
 * @param context
 * @param org_id
 * @param device_id
 */
async function resolveDevice(context: TagoContext, org_id: string, device_id: string) {
  console.debug("Resolving device", device_id);
  const sensor_info = await Resources.devices.info(device_id);

  if (!sensor_info) {
    return Promise.reject("Device not found");
  }

  checkLocation(sensor_info).catch((error) => console.debug(error));

  const device_info = await Resources.devices.info(device_id);
  if (!device_info.last_input) {
    return Promise.reject("Device not found");
  }

  const checkin_date = dayjs(device_info.last_input);

  if (!checkin_date) {
    return "no data";
  }

  let diff_hours: string | number = dayjs().diff(checkin_date, "hours");

  if (diff_hours !== diff_hours) {
    diff_hours = "-";
  } //checking for NaN

  const device_params = await Resources.devices.paramList(device_id);
  const dev_lastcheckin_param = device_params.find((param) => param.key === "dev_lastcheckin") || { key: "dev_lastcheckin", value: String(diff_hours), sent: false };

  await checkInTrigger(context, org_id, { device_id, last_input: device_info.last_input });

  await Resources.devices.paramSet(device_id, { ...dev_lastcheckin_param, value: String(diff_hours), sent: (diff_hours as number) >= 24 ? true : false });

  console.debug("Device resolved", device_id);
}

async function handler(context: TagoContext): Promise<void> {
  console.debug("Running Analysis");

  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  }

  const orgList = await fetchDeviceList({ tags: [{ key: "device_type", value: "organization" }] });

  orgList.map((org) => resolveOrg(org));

  const sensorList = await fetchDeviceList({ tags: [{ key: "device_type", value: "device" }] });

  const processSensorQueue = async.queue(async function (sensorItem: DeviceListItem, callback) {
    const organization_id = sensorItem?.tags?.find((tag) => tag.key === "organization_id")?.value as string;
    const device_id = sensorItem?.tags?.find((tag) => tag.key === "device_id")?.value as string;
    await resolveDevice(context, organization_id, device_id).catch((error) => console.debug(`${error} - ${sensorItem.id}`));
    callback();
  }, 1);

  //populating the queue
  for (const sensorItem of sensorList) {
    void processSensorQueue.push(sensorItem);
  }

  // console.debug("Queue populated", processSensorQueue.length());

  await processSensorQueue.drain();

  //throwing possible errors generated while running the queue
  processSensorQueue.error((error) => {
    console.debug(error);
    process.exit();
  });
}

/**
 * Start the analysis
 */
async function startAnalysis(context: TagoContext) {
  try {
    await handler(context);
    console.debug("Analysis finished");
  } catch (error) {
    console.debug(error);
    console.debug(error.message || JSON.stringify(error));
  }
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
