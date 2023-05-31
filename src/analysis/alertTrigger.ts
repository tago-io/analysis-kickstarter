/*
 * KickStarter Analysis
 * Alert Trigger
 *
 * The analysis runs everytime a device uplink matches an alert and must send an email, sms or notification.
 *
 * How to setup this analysis
 * Make sure you have the following enviroment variables:
 * - config_token: the value must be a token from a HTTPs device, that stores general information of the application.
 * - account_token: the value must be a token from your profile. See how to generate account-token at: https://help.tago.io/portal/en/kb/articles/495-account-token.
 */
import { Utils, Services, Account, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { UserInfo } from "@tago-io/sdk/out/modules/Account/run.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import checkAndChargeUsage from "../services/plan/checkAndChargeUsage";

interface IMessageDetail {
  device_name: string;
  device_id: string;
  sensor_type: string;
  value: string;
  variable: string;
}
/**
 * Notification messages to be sent
 * @param type Type of message to be sent
 * @param account Account instanced class
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID of the device that triggered the alert
 * @param to_dispatch_qty Number of messages to be sent
 * @param users_info Array of users to receive the message
 * @param message Message to be sent
 */
async function notificationMessages(type: string[], account: Account, context: TagoContext, org_id: string, to_dispatch_qty: number, users_info: UserInfo[], message: string) {
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
      const org_dev = await Utils.getDevice(account, org_id);
      await org_dev.sendData({
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No notification service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }
}

/**
 * Email messages to be sent
 * @param type Type of message to be sent
 * @param account Account instanced class
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID of the device that triggered the alert
 * @param to_dispatch_qty Number of messages to be sent
 * @param users_info Array of users to receive the message
 * @param device_info Device information
 * @param message Message to be sent
 */
async function emailMessages(
  type: string[],
  account: Account,
  context: TagoContext,
  org_id: string,
  to_dispatch_qty: number,
  users_info: UserInfo[],
  device_info: any,
  message: string
) {
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
      const org_dev = await Utils.getDevice(account, org_id);
      await org_dev.sendData({
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No email service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }
}

/**
 * Sms messages to be sent
 * @param type Type of message to be sent
 * @param account Account instanced class
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID of the device that triggered the alert
 * @param to_dispatch_qty Number of messages to be sent
 * @param users_info Array of users to receive the message
 * @param message Message to be sent
 */
async function smsMessages(type: string[], account: Account, context: TagoContext, org_id: string, to_dispatch_qty: number, users_info: UserInfo[], message: string) {
  if (type.includes("sms")) {
    const has_service_limit = await checkAndChargeUsage(account, context, org_id, to_dispatch_qty, "sms");

    if (has_service_limit) {
      users_info.forEach((user) => {
        const smsService = new Services({ token: context.token }).sms;
        if (!user.phone) {
          throw "user.phone not found";
        }
        smsService
          .send({
            message,
            to: user.phone,
          })
          .then((msg) => console.debug(msg));
      });
    } else {
      const org_dev = await Utils.getDevice(account, org_id);
      await org_dev.sendData({
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} alert(s) was not successful. No SMS service limit available, check your service usage at "Info" to learn more about your plan status.`,
      });
    }
  }
}

/**
 * Function that starts the analysis and handles the alert trigger and message dispatch
 * @param type Type of message to be sent
 * @param account Account instanced class
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID of the device that triggered the alert
 * @param to_dispatch_qty Number of messages to be sent
 * @param users_info Array of users to receive the message
 * @param message Message to be sent
 * @param device_info Device information
 */
async function dispachMessages(
  type: string[],
  account: Account,
  context: TagoContext,
  org_id: string,
  to_dispatch_qty: number,
  users_info: UserInfo[],
  message: string,
  device_info
) {
  await notificationMessages(type, account, context, org_id, to_dispatch_qty, users_info, message);

  await emailMessages(type, account, context, org_id, to_dispatch_qty, users_info, device_info, message);

  await smsMessages(type, account, context, org_id, to_dispatch_qty, users_info, message);
}

/**
 * Function that replaces the message with the variables
 * @param message Message to be sent
 * @param replace_details Object with the variables to be replaced
 */
function replaceMessage(message: string, replace_details: IMessageDetail) {
  for (const key of Object.keys(replace_details)) {
    message = message.replace(new RegExp(`#${key}#`, "g"), (replace_details as any)[key]);
    console.debug((replace_details as any)[key]);
  }

  return message;
}

/**
 * Function that get the users information
 * @param account Account instanced class
 * @param send_to Array of users to receive the message
 */
async function getUsers(account: Account, send_to: string[]) {
  const func_list = send_to.map((user_id) => account.run.userInfo(user_id).catch(() => null));

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
  if (!environment_variables.account_token) {
    return console.debug('Missing "account_token" environment variable');
  } else if (environment_variables.account_token.length !== 36) {
    return console.debug('Invalid "account_token" in the environment variable');
  }

  // Instance the Account class
  const account = new Account({ token: environment_variables.account_token });

  const action_id = environment_variables._action_id;
  if (!action_id) {
    return console.debug("This analysis must be triggered by an action.");
  }

  // Get action details
  const action_info = await account.actions.info(action_id);
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
  const org_dev = await Utils.getDevice(account, org_id);
  const [message_var] = await org_dev.getData({ variables: ["action_list_message", "action_group_message"], groups: alert_id, qty: 1 });

  const trigger_variable = scope.find((x) => x.variable === (action_info.trigger[0] as any).variable);
  if (!trigger_variable?.value) {
    throw "trigger_variable.value not found";
  }

  const device_id = scope[0].device;
  const device_info = await account.devices.info(device_id);

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

  const users_info = await getUsers(account, send_to);

  const to_dispatch_qty = users_info.length;

  await dispachMessages(type, account, context, org_id, to_dispatch_qty, users_info, message, device_info);

  return console.debug("Analysis Finished!");
}

if (!process.env.T_TEST) {
  Analysis.use(analysisAlert, { token: process.env.T_ANALYSIS_TOKEN });
}

export { analysisAlert };
