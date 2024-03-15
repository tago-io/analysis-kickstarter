/*
 * KickStarter Analysis
 * Alert Trigger
 *
 * The analysis runs every time a device uplink matches an alert and must send an email, sms or notification.
 */
import { Analysis, Resources, Services, Utils } from "@tago-io/sdk";
import { Conditionals, Data, DeviceInfo, TagoContext, UserInfo } from "@tago-io/sdk/lib/types";

import { checkAndChargeUsage } from "../services/plan/check-and-charge-usage";

interface IMessageDetail {
  device_name: string;
  device_id: string;
  sensor_type: string;
  value: string;
  variable: string;
}

type triggerType = {
  device: string;
  variable: string;
  is: Conditionals;
  value: string;
  second_value?: string;
  value_type: "string" | "number" | "boolean" | "*";
  unlock?: boolean;
};

/**
 * Notification messages to be sent
 * @param type Type of message to be sent
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID of the device that triggered the alert
 * @param to_dispatch_qty Number of messages to be sent
 * @param users_info Array of users to receive the message
 * @param message Message to be sent
 */
async function notificationMessages(type: string[], context: TagoContext, org_id: string, to_dispatch_qty: number, users_info: UserInfo[], message: string) {
  if (type.includes("notification_run")) {
    const has_service_limit = await checkAndChargeUsage(context, org_id, to_dispatch_qty, "notification_run");

    if (has_service_limit) {
      for (const user of users_info) {
        void Resources.run
          .notificationCreate(user.id, {
            message,
            title: "Alert Trigger",
          })
          .then(() => console.debug("Notification sent"));
      }
    } else {
      await Resources.devices.sendDeviceData(org_id, {
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No notification service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }
}

/**
 * Email messages to be sent
 * @param type Type of message to be sent
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID of the device that triggered the alert
 * @param to_dispatch_qty Number of messages to be sent
 * @param users_info Array of users to receive the message
 * @param device_info Device information
 * @param message Message to be sent
 */
async function emailMessages(type: string[], context: TagoContext, org_id: string, to_dispatch_qty: number, users_info: UserInfo[], device_info: any, message: string) {
  if (type.includes("email")) {
    const has_service_limit = await checkAndChargeUsage(context, org_id, to_dispatch_qty, "email");

    if (has_service_limit) {
      const email = new Services({ token: context.token }).email;

      void email
        .send({
          to: users_info.map((x) => x.email).join(","),
          template: {
            name: "email_alert",
            params: {
              device_name: device_info.name,
              alert_message: message,
            },
          },
        })
        .then((msg) => console.debug(msg));
    } else {
      await Resources.devices.sendDeviceData(org_id, {
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No email service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }
}

/**
 * Sms messages to be sent
 * @param type Type of message to be sent
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID of the device that triggered the alert
 * @param to_dispatch_qty Number of messages to be sent
 * @param users_info Array of users to receive the message
 * @param message Message to be sent
 */
async function smsMessages(type: string[], context: TagoContext, org_id: string, to_dispatch_qty: number, users_info: UserInfo[], message: string) {
  if (type.includes("sms")) {
    const has_service_limit = await checkAndChargeUsage(context, org_id, to_dispatch_qty, "sms");

    if (has_service_limit) {
      for (const user of users_info) {
        const smsService = new Services({ token: context.token }).sms;
        if (!user.phone) {
          throw "user.phone not found";
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

/**
 * Function that starts the analysis and handles the alert trigger and message dispatch
 * @param type Type of message to be sent
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID of the device that triggered the alert
 * @param to_dispatch_qty Number of messages to be sent
 * @param users_info Array of users to receive the message
 * @param message Message to be sent
 * @param device_info Device information
 */
async function dispatchMessages(type: string[], context: TagoContext, org_id: string, to_dispatch_qty: number, users_info: UserInfo[], message: string, device_info: DeviceInfo) {
  await notificationMessages(type, context, org_id, to_dispatch_qty, users_info, message);

  await emailMessages(type, context, org_id, to_dispatch_qty, users_info, device_info, message);

  await smsMessages(type, context, org_id, to_dispatch_qty, users_info, message);
}

/**
 * Function that replaces the message with the variables
 * @param message Message to be sent
 * @param replace_details Object with the variables to be replaced
 */
function replaceMessage(message: string, replace_details: IMessageDetail) {
  for (const key of Object.keys(replace_details)) {
    message = message.replaceAll(new RegExp(`#${key}#`, "g"), (replace_details as any)[key]);
    console.debug((replace_details as any)[key]);
  }

  return message;
}

/**
 * Function that get the users information
 * @param send_to Array of users to receive the message
 */
async function getUsers(send_to: string[]) {
  const func_list = send_to.map((user_id) => Resources.run.userInfo(user_id).catch(() => null));

  return (await Promise.all(func_list)).filter((x) => x) as UserInfo[];
}

/**
 * Function that starts the analysis and handles the alert trigger
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is an array of data sent by the analysis
 */
async function analysisAlert(context: TagoContext, scope: Data[]): Promise<void> {
  console.debug("Running Analysis");
  if (!scope[0]) {
    return console.debug("This analysis must be triggered by an action.");
  }

  console.debug(JSON.stringify(scope));
  // Get the environment variables.
  const environment_variables = Utils.envToJson(context.environment);

  const action_id = environment_variables._action_id;
  if (!action_id) {
    return console.debug("This analysis must be triggered by an action.");
  }

  // Get action details
  const action_info = await Resources.actions.info(action_id);
  if (!action_info.tags) {
    throw "action_info.tags not found";
  }

  if (!action_info.trigger) {
    throw "action_info.trigger not found";
  }

  const send_to = action_info.tags
    .find((x) => x.key === "send_to")
    ?.value?.replace(/;/g, ",")
    .split(",");
  const type = action_info.tags
    .find((x) => x.key === "action_type")
    ?.value?.replace(/;/g, ",")
    .split(",");

  if (!send_to) {
    throw "send_to not found";
  }

  if (!type) {
    throw "type not found";
  }
  // const alert_id = action_info.tags.find((x) => x.key === "action_id")?.value;
  const alert_id = action_id;

  // Get action message
  const org_id = action_info.tags.find((x) => x.key === "organization_id")?.value;

  if (!org_id) {
    throw "org_id not found";
  }
  const [message_var] = await Resources.devices.getDeviceData(org_id, { variables: ["action_list_message", "action_group_message"], groups: alert_id, qty: 1 });

  // Get the triggered variable
  const trigger = action_info.trigger as unknown as triggerType[];
  const trigger_variables = trigger?.filter((x) => !x.unlock).map((x) => x.variable);
  const trigger_variable = scope.find((x) => trigger_variables.includes(x.variable));

  if (!trigger_variable) {
    throw "trigger_variable.value not found";
  }

  const device_id = scope[0].device;
  const device_info = await Resources.devices.info(device_id);

  const sensor_type = device_info?.tags?.find((tag) => tag.key === "sensor")?.value;
  if (!sensor_type) {
    throw "sensoor_type not found";
  }

  const replace_details: IMessageDetail = {
    device_name: device_info?.name,
    device_id: device_info?.id,
    sensor_type: sensor_type,
    value: String(trigger_variable?.value),
    variable: trigger_variable?.variable,
  };

  const message = replaceMessage(message_var.value as string, replace_details);

  const users_info = await getUsers(send_to);

  const to_dispatch_qty = users_info.length;

  await dispatchMessages(type, context, org_id, to_dispatch_qty, users_info, message, device_info);

  return console.debug("Analysis Finished!");
}

if (!process.env.T_TEST) {
  Analysis.use(analysisAlert, { token: process.env.T_ANALYSIS_TOKEN });
}

export { analysisAlert };
