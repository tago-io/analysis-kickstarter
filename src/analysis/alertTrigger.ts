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
import { Utils, Services, Account, Device, Types, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { UserInfo } from "@tago-io/sdk/out/modules/Account/run.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import checkAndChargeUsage from "../services/plan/checkAndChargeUsage";
// import checkAndChargeUsage from "../services/plan/checkAndChargeUsage";

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
    console.debug((replace_details as any)[key]);
  }

  return message;
}

async function getUsers(account: Account, send_to: string[]) {
  const func_list = send_to.map((user_id) => account.run.userInfo(user_id).catch(() => null));

  return (await Promise.all(func_list)).filter((x) => x) as UserInfo[];
}

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
  const send_to = action_info.tags
    .find((x) => x.key === "send_to")
    ?.value?.replace(/;/g, ",")
    .split(",");
  const type = action_info.tags
    .find((x) => x.key === "action_type")
    ?.value?.replace(/;/g, ",")
    .split(",");
  // const alert_id = action_info.tags.find((x) => x.key === "action_id")?.value;
  const alert_id = action_id;

  // Get action message
  const org_id = action_info.tags.find((x) => x.key === "organization_id")?.value;
  const org_dev = await Utils.getDevice(account, org_id);
  const [message_var] = await org_dev.getData({ variables: ["action_list_message", "action_group_message"], groups: alert_id, qty: 1 });

  const trigger_variable = scope.find((x) => x.variable === (action_info.trigger[0] as any).variable);
  const device_id = scope[0].device;
  const device_info = await account.devices.info(device_id);

  const replace_details: IMessageDetail = {
    device_name: device_info?.name,
    device_id: device_info?.id,
    sensor_type: device_info?.tags?.find((tag) => tag.key === "sensor")?.value,
    value: String(trigger_variable?.value),
    variable: trigger_variable?.variable,
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
      const org_dev = await Utils.getDevice(account, org_id);
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
      const org_dev = await Utils.getDevice(account, org_id);
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

  return console.debug("Analysis Finished!");
}

export default new Analysis(analysisAlert, { token: "a7d727c6-2a5a-414a-bc4c-99a6a21bd174" });
