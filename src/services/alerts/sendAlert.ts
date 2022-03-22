import { Account, Services, Utils } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { UserInfo } from "@tago-io/sdk/out/modules/Account/run.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import { DataToSend } from "@tago-io/sdk/out/modules/Device/device.types";
import checkAndChargeUsage from "../plan/checkAndChargeUsage";

interface IMessageDetail {
  device_name: string;
  device_id: string;
  sensor_type: string;
  value: string;
  variable: string;
}

function replaceMessage(message: string, replace_details: IMessageDetail) {
  for (const key of Object.keys(replace_details)) {
    message = message.replace(new RegExp(`#${key}#`, "g"), (replace_details as any)[key]);
  }

  return message;
}

async function getUsers(account: Account, send_to: string[]) {
  const func_list = send_to.map((user_id) => account.run.userInfo(user_id).catch(() => null));

  return (await Promise.all(func_list)).filter((x) => x) as UserInfo[];
}

interface IAlertTrigger {
  action_id: string;
  data: Data;
  send_to: string[];
  type: string[];
  origin: string;
}

async function sendAlert(account: Account, context: TagoContext, org_id: string, alert: IAlertTrigger) {
  const { data, action_id: alert_id, send_to, type } = alert;
  const groupWithAlert = await Utils.getDevice(account, alert.origin);
  const org_dev = await Utils.getDevice(account, org_id);

  // Get action message
  const [message_var] = await groupWithAlert.getData({ variables: ["action_list_message", "action_group_message"], series: alert_id, qty: 1 });

  const device_id = data.origin;
  const device_info = await account.devices.info(device_id);

  const replace_details: IMessageDetail = {
    device_name: device_info?.name,
    device_id: device_info?.id,
    sensor_type: device_info?.tags?.find((tag) => tag.key === "sensor")?.value,
    value: String(data?.value),
    variable: data?.variable,
  };

  const message = replaceMessage(message_var.value as string, replace_details);

  const users_info = await getUsers(account, send_to);

  const to_dispatch_qty = users_info.length;

  if (type.includes("notification_run")) {
    const has_service_limit = await checkAndChargeUsage(account, context, org_id, to_dispatch_qty, "notification_run");

    if (has_service_limit) {
      users_info.forEach((user) => {
        account.run.notificationCreate(user.id, {
          message,
          title: "Alert Trigger",
        });
      });
    } else {
      await org_dev.sendData({
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No notification service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }

  if (type.includes("email")) {
    const has_service_limit = await checkAndChargeUsage(account, context, org_id, to_dispatch_qty, "email");

    if (has_service_limit) {
      const email = new Services({ token: context.token }).email;

      email.send({
        to: users_info.map((x) => x.email).join(","),
        template: {
          name: "email_alert",
          params: {
            device_name: device_info.name,
            alert_message: message,
          },
        },
      });
    } else {
      await org_dev.sendData({
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No email service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }

  if (type.includes("sms")) {
    const has_service_limit = await checkAndChargeUsage(account, context, org_id, to_dispatch_qty, "sms");

    if (has_service_limit) {
      users_info.forEach((user) => {
        const smsService = new Services({ token: context.token }).sms;
        smsService
          .send({
            message,
            to: user.phone,
          })
          .then((msg) => console.log(msg));
      });
    } else {
      await org_dev.sendData({
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No SMS service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }
}

export { sendAlert, IAlertTrigger };
