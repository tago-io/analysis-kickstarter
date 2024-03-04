import { Resources, Utils } from "@tago-io/sdk";
import { AnalysisEnvironment, ConfigurationParams, TagoContext } from "@tago-io/sdk/lib/types";

type CommunicationMean = "email" | "sms" | "notification_run";
/**
 * Function that check if the user has exceeded the limit of the plan
 * @param type Type of communication mean that will be checked
 * @param environment Environment of the analysis
 */
const checkTagoPlan = async (type: CommunicationMean, environment: AnalysisEnvironment) => {
  // This should be made because the Access Management doesn't have permissions
  const resources = new Resources({ token: environment.ACCOUNT_TOKEN });
  const { profile: profile_id } = await resources.run.info();

  const tago_usage_statistic = await resources.profiles.usageStatisticList(profile_id, { date: String(new Date()), timezone: "UTC" });
  const tago_usage_limit = await resources.profiles.info(profile_id);

  if (!tago_usage_statistic || !tago_usage_limit) {
    console.debug("INTERNAL ERROR - NO PROFILE INFO WAS CATCH");
    return true;
  }

  if (type === "email") {
    const email_tago_statistic = (tago_usage_statistic.at(-1) as any).email;
    const email_tago_limit = (tago_usage_limit as any).allocation.email;

    if (email_tago_limit === email_tago_statistic) {
      return false;
    }
  } else if (type === "sms") {
    const sms_tago_statistic = (tago_usage_statistic.at(-1) as any).sms;
    const sms_tago_limit = (tago_usage_limit as any).allocation.sms;

    if (sms_tago_limit === sms_tago_statistic) {
      return false;
    }
  } else if (type === "notification_run") {
    const notification_tago_statistic = (tago_usage_statistic.at(-1) as any).push_notification;
    const notification_tago_limit = (tago_usage_limit as any).allocation.push_notification;

    if (notification_tago_limit === notification_tago_statistic) {
      return false;
    }
  }

  return true;
};
/**
 * Function that send limit alert to the user
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID that will be used to check the plan
 * @param current_email_usage Current email usage of the organization
 * @param current_sms_usage Current sms usage of the organization
 * @param service_type Type of service that will be checked
 */
const sendLimitAlert = async (context: TagoContext, org_id: string, current_email_usage: string, current_sms_usage: string, service_type: string) => {
  //guest will not receive the notification/email
  const users_list = await Resources.run.listUsers({ amount: 9999, fields: ["id", "name", "email"], filter: { tags: [{ key: "organization_id", value: org_id }] } });

  // const [plan_data] = await Resources.devices.getDeviceData(org_id, { variables: "plan_data", qty: 1 });

  // const email = new Services({ token: context.token }).email;

  const notif_string = `Your plan has exceed the ${service_type} service limit! Check your service usage at "Info" to learn more about your plan status.`;

  for (const user of users_list) {
    //UNCOMENT THOSE LINES TO WARN USE THROUGH EMAIL AS WELL!

    // await email
    //   .send({
    //     to: user.email,
    //     template: {
    //       name: "plan_alert",
    //       params: {
    //         name: user.name,
    //         plan: plan_data.value as string,
    //         email_limit: plan_data.metadata.email_limit,
    //         email_usage: current_email_usage,
    //         sms_limit: plan_data.metadata.sms_limit,
    //         sms_usage: current_sms_usage,
    //         service_type,
    //       },
    //     },
    //   })
    //   .catch((msg) => console.debug(msg));

    await Resources.run.notificationCreate(user.id, { title: "Service Limit", message: notif_string }).catch((error) => console.debug(error));
  }
};

/**
 * Function that check if the organization has exceeded the limit of the plan
 * @param plan_sms_limit The limit of the plan
 * @param current_plan_count The current count of the plan
 */
const orgHasLimit = (plan_sms_limit: string, current_plan_count: number): boolean => {
  if (Number(plan_sms_limit) >= current_plan_count) {
    return true;
  } else {
    return false;
  }
};

/**
 * Function that check if the organization has exceeded the limit of the plan
 * @param context Context is a variable sent by the analysis
 * @param org_id Organization ID that will be used to check the plan
 * @param to_dispatch_qty Quantity of the dispatches that will be sent
 * @param type Type of communication mean that will be checked
 */
async function checkAndChargeUsage(context: TagoContext, org_id: string, to_dispatch_qty: number, type: CommunicationMean) {
  //id of the org device
  const org_params = await Resources.devices.paramList(org_id);

  const plan_email_limit = org_params.find((x) => x.key === "plan_email_limit") as ConfigurationParams;
  const plan_sms_limit = org_params.find((x) => x.key === "plan_sms_limit") as ConfigurationParams;
  const plan_notif_limit = org_params.find((x) => x.key === "plan_notif_limit") as ConfigurationParams;
  const plan_sms_limit_usage = org_params.find((x) => x.key === "plan_sms_limit_usage") || { key: "plan_sms_limit_usage", value: "0", sent: false };
  const plan_email_limit_usage = org_params.find((x) => x.key === "plan_email_limit_usage") || { key: "plan_email_limit_usage", value: "0", sent: false };
  const plan_notif_limit_usage = org_params.find((x) => x.key === "plan_notif_limit_usage") || { key: "plan_notif_limit_usage", value: "0", sent: false };

  const environment = Utils.envToJson(context.environment);

  //checking if the admin.tago.io profile has limit available
  if (!(await checkTagoPlan(type, environment))) {
    return false;
  }
  if (type === "email") {
    const current_plan_count = Number(plan_email_limit_usage.value) + to_dispatch_qty;

    const org_has_limit = orgHasLimit(plan_email_limit.value, current_plan_count);

    if (org_has_limit) {
      await Resources.devices.paramSet(org_id, { ...plan_email_limit_usage, value: String(current_plan_count), sent: false }); //SET NEW SERVICE USAGE
      return true;
    } else if (!org_has_limit && !plan_email_limit_usage.sent) {
      await sendLimitAlert(context, org_id, plan_email_limit_usage.value, plan_sms_limit_usage.value, "email");

      await Resources.devices.paramSet(org_id, { ...plan_email_limit_usage, sent: true });

      return false;
    }

    return false;
  } else if (type === "sms") {
    const current_plan_count = Number(plan_sms_limit_usage.value) + to_dispatch_qty;

    const org_has_limit = orgHasLimit(plan_sms_limit.value, current_plan_count);

    if (org_has_limit) {
      await Resources.devices.paramSet(org_id, { ...plan_sms_limit_usage, value: String(current_plan_count), sent: false }); //SET NEW SERVICE USAGE
      return true;
    } else if (!org_has_limit && !plan_sms_limit_usage.sent) {
      await sendLimitAlert(context, org_id, plan_sms_limit_usage.value, plan_sms_limit_usage.value, "SMS");

      await Resources.devices.paramSet(org_id, { ...plan_sms_limit_usage, sent: true });

      return false;
    }

    return false;
  } else if (type === "notification_run") {
    const current_plan_count = Number(plan_notif_limit_usage.value) + to_dispatch_qty;

    const org_has_limit = orgHasLimit(plan_notif_limit.value, current_plan_count);

    if (org_has_limit) {
      await Resources.devices.paramSet(org_id, { ...plan_notif_limit_usage, value: String(current_plan_count), sent: false }); //SET NEW SERVICE USAGE
      return true;
    } else if (!org_has_limit && !plan_notif_limit_usage.sent) {
      await sendLimitAlert(context, org_id, plan_notif_limit_usage.value, plan_notif_limit_usage.value, "notification_run");

      await Resources.devices.paramSet(org_id, { ...plan_notif_limit_usage, sent: true });

      return false;
    }

    return false;
  }
}

export { checkAndChargeUsage };
