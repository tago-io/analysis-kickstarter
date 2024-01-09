import dayjs from "dayjs";

import { Resources } from "@tago-io/sdk";
import { TagoContext } from "@tago-io/sdk/lib/types";

import { IAlertTrigger, sendAlert } from "./send-alert";

interface ICheckInParam {
  device_id: string;
  last_input?: Date;
}

/**
 * Function used to trigger the checkin alert
 * @param context context is a variable sent by the analysis
 * @param org_id Id of the organization
 * @param params parameters parameters that will be used to trigger the checkin
 */
async function checkInTrigger(context: TagoContext, org_id: string, params: ICheckInParam) {
  const { last_input, device_id } = params;
  const checkin_date = dayjs(last_input);
  if (!checkin_date) {
    return "no data";
  }

  const paramList = await Resources.devices.paramList(device_id);

  const actionList = paramList.filter((param) => param.key.startsWith("checkin"));
  for (const param of actionList) {
    const [interval] = param.value.split(",");
    const diff_hours: string | number = dayjs().diff(checkin_date, "hours");

    if (diff_hours >= Number(interval) && !param.sent) {
      const action_id = param.key.replace("checkin", "");
      const action_info = await Resources.actions.info(action_id);
      if (!action_info.tags) {
        throw "Action not found";
      }

      const send_to = action_info.tags
        .find((x) => x.key === "send_to")
        ?.value?.replace(/;/g, ",")
        .split(",");
      const type = action_info.tags
        .find((x) => x.key === "action_type")
        ?.value?.replace(/;/g, ",")
        .split(",");
      const device = action_info.tags.find((x) => x.key === "device")?.value as string;

      if (!send_to || !type || !device) {
        throw "Action not found";
      }

      const mockData = {
        variable: "Inactivity",
        value: diff_hours,
        device: device_id,
        time: new Date(),
      };

      const alert: IAlertTrigger = {
        action_id,
        device,
        send_to,
        type,
        data: mockData as any,
      };

      await sendAlert(context, org_id, alert);
    } else if (diff_hours < Number(interval) && param.sent) {
      await Resources.devices.paramSet(device_id, { ...param, sent: true });
      await Resources.devices.paramSet(device_id, { ...param, sent: false });
    }
  }
}

/**
 * Add this function to alert Handler in order to add the needed variable for Checkin events
 * @param devToStoreAlert Organization/Group/Etc device that will have the event stored
 * @param action_id Id of the action
 * @param structure structure of the action
 */
async function checkInAlertSet(action_id: string, interval: number, device_ids: string[]) {
  for (const device_id of device_ids) {
    const paramList = await Resources.devices.paramList(device_id);
    const getParam = (key: string) => paramList.find((param) => param.key === key) || { key, value: "", sent: false };
    const actionParam = getParam(`checkin${action_id}`);

    actionParam.value = `${interval},${new Date().toISOString()}`;
    await Resources.devices.paramSet(device_id, actionParam);
  }
}

export { checkInAlertSet, checkInTrigger };
