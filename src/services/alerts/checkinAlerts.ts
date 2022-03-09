import { Account, Device } from "@tago-io/sdk";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import moment from "moment";
import { ActionStructureParams } from "./register";
import { IAlertTrigger, sendAlert } from "./sendAlert";

interface ICheckinParam {
  device_id: string;
  last_input?: Date;
}

async function checkinTrigger(account: Account, context: TagoContext, org_id: string, params: ICheckinParam) {
  const { last_input, device_id } = params;
  const checkin_date = moment(last_input);
  if (!checkin_date) {
    return "no data";
  }

  const paramList = await account.devices.paramList(device_id);

  const actionList = paramList.filter((param) => param.key.startsWith("checkin"));
  for (const param of actionList) {
    const [interval, last_send] = param.value.split(",");
    const diff_hours: string | number = moment().diff(checkin_date, "hours");

    if (diff_hours >= Number(interval) && !param.sent) {
      const action_id = param.key.replace("checkin", "");
      const action_info = await account.actions.info(action_id);

      const send_to = action_info.tags
        .find((x) => x.key === "send_to")
        ?.value?.replace(/;/g, ",")
        .split(",");
      const type = action_info.tags
        .find((x) => x.key === "action_type")
        ?.value?.replace(/;/g, ",")
        .split(",");
      const origin = action_info.tags.find((x) => x.key === "origin")?.value as string;

      const mockData = {
        variable: "Inactivity",
        value: diff_hours,
        origin: device_id,
        time: new Date(),
      };

      const alert: IAlertTrigger = {
        action_id,
        origin,
        send_to,
        type,
        data: mockData,
      };

      await sendAlert(account, context, org_id, alert);
      account.devices.paramSet(device_id, { ...param, sent: true });
    } else if (diff_hours < Number(interval) && param.sent) {
      account.devices.paramSet(device_id, { ...param, sent: false });
    }
  }
}

/**
 * Add this function to alert Handler in order to add the needed variable for Checkin events
 * @param account Account
 * @param devToStoreAlert Organization/Group/Etc device that will have the event stored
 * @param action_id Id of the action
 * @param structure structure of the action
 */
async function checkinAlertSet(account: Account, action_id: string, interval: number, device_ids: string[]) {
  for (const device_id of device_ids) {
    const paramList = await account.devices.paramList(device_id);
    const getParam = (key: string) => paramList.find((param) => param.key === key) || { key, value: "", sent: false };
    const actionParam = getParam(`checkin${action_id}`);

    actionParam.value = `${interval},${new Date().toISOString()}`;
    account.devices.paramSet(device_id, actionParam);
  }
}

export { checkinAlertSet, checkinTrigger };
