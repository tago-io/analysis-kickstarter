import { Resources, Services } from "@tago-io/sdk";
import { Data, TagoContext, UserInfo } from "@tago-io/sdk/lib/types";

import { checkAndChargeUsage } from "../plan/check-and-charge-usage";

interface IMessageDetail {
  device_name: string;
  device_id: string;
  sensor_type: string;
  value: string;
  variable: string;
}
/**
 * Function that replace the message variables
 * @param message Message that will be replaced
 * @param replace_details Object with the variables that will be replaced
 */
function replaceMessage(message: string, replace_details: IMessageDetail) {
  for (const key of Object.keys(replace_details)) {
    message = message.replaceAll(new RegExp(`#${key}#`, "g"), (replace_details as any)[key]);
  }

  return message;
}

/**
 * Function that get the users that will receive the alert
 * @param send_to List of users that will receive the alert
 */
async function getUsers(send_to: string[]) {
  const func_list = send_to.map((user_id) => Resources.run.userInfo(user_id).catch(() => null));

  return (await Promise.all(func_list)).filter((x) => x) as UserInfo[];
}

interface IAlertTrigger {
  action_id: string;
  data: Data;
  send_to: string[];
  type: string[];
  device: string;
}

/**
 * Function that send the alert to the users
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID that will be used to charge the usage
 * @param alert Alert that will be sent
 */
async function sendAlert(context: TagoContext, org_id: string, alert: IAlertTrigger) {
  const { data, action_id: alert_id, send_to, type, device } = alert;

  // Get action message
  const [message_var] = await Resources.devices.getDeviceData(device, { variables: ["action_list_message", "action_group_message"], groups: alert_id, qty: 1 });

  const device_id = data.device;
  const device_info = await Resources.devices.info(device_id);
  if (!device_info.tags) {
    throw new Error("Device tags not found");
  }
  const sensor_type = device_info?.tags?.find((tag) => tag.key === "sensor")?.value;
  if (!sensor_type) {
    throw new Error("Sensor type not found");
  }
  const replace_details: IMessageDetail = {
    device_name: device_info?.name,
    device_id: device_info?.id,
    sensor_type: sensor_type,
    value: String(data?.value),
    variable: data?.variable,
  };

  const message = replaceMessage(message_var.value as string, replace_details);

  const users_info = await getUsers(send_to);

  const to_dispatch_qty = users_info.length;

  if (type.includes("notification_run")) {
    const has_service_limit = await checkAndChargeUsage(context, org_id, to_dispatch_qty, "notification_run");

    if (has_service_limit) {
      for (const user of users_info) {
        void Resources.run.notificationCreate(user.id, {
          message,
          title: "Alert Trigger",
        });
      }
    } else {
      await Resources.devices.sendDeviceData(org_id, {
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No notification service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }

  if (type.includes("email")) {
    const has_service_limit = await checkAndChargeUsage(context, org_id, to_dispatch_qty, "email");

    if (has_service_limit) {
      const email = new Services({ token: context.token }).email;

      void email.send({
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
      await Resources.devices.sendDeviceData(org_id, {
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No email service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }

  if (type.includes("sms")) {
    const has_service_limit = await checkAndChargeUsage(context, org_id, to_dispatch_qty, "sms");

    if (has_service_limit) {
      for (const user of users_info) {
        const smsService = new Services({ token: context.token }).sms;
        if (!user.phone) {
          throw new Error("User phone not found");
        }
        void smsService
          .send({
            message,
            to: user.phone,
          })
          .then((msg) => console.debug(msg));
      }
    } else {
      await Resources.devices.sendDeviceData(org_id, {
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No SMS service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }
}

export { sendAlert, IAlertTrigger };
