import { Device, Account, Services, Utils } from "@tago-io/sdk";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";

type CommunicationMean = "email" | "sms" | "notification_run";

const checkTagoPlan = async (account: Account, type: CommunicationMean) => {
  const { profile: profile_id } = await account.run.info();

  const tago_usage_statistic = await account.profiles.usageStatisticList(profile_id, { date: String(new Date()), timezone: "UTC" });
  const tago_usage_limit = await account.profiles.info(profile_id);

  if (!tago_usage_statistic || !tago_usage_limit) {
    console.log("INTERNAL ERROR - NO PROFILE INFO WAS CATCH");
    return true;
  }

  if (type === "email") {
    const email_tago_statistic = tago_usage_statistic[tago_usage_statistic.length - 1].email;
    const email_tago_limit = tago_usage_limit.limits.email;

    if (email_tago_limit === email_tago_statistic) {
      return false;
    }
  } else if (type === "sms") {
    const sms_tago_statistic = tago_usage_statistic[tago_usage_statistic.length - 1].sms;
    const sms_tago_limit = tago_usage_limit.limits.sms;

    if (sms_tago_limit === sms_tago_statistic) {
      return false;
    }
  }

  return true;
};

const sendLimitAlert = async (account: Account, context: TagoContext, org_id: string, current_email_usage: string, current_sms_usage: string, service_type: string) => {
  //guest will not receive the notification/email
  const users_list = await account.run.listUsers({ amount: 9999, fields: ["id", "name", "email"], filter: { tags: [{ key: "organization_id", value: org_id }] } });

  const org_dev = await Utils.getDevice(account, org_id);
  const [plan_data] = await org_dev.getData({ variables: "plan_data", qty: 1 });

  const email = new Services({ token: context.token }).email;

  const notif_string = `Your plan has exceed the ${service_type} service limit! Check your service usage at "Info" to learn more about your plan status.`;

  users_list.forEach(async (user) => {
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
    //   .catch((msg) => console.log(msg));

    await account.run.notificationCreate(user.id, { title: "Service Limit", message: notif_string }).catch((msg) => console.log(msg));
  });
};

const orgHasLimit = (plan_sms_limit: string, current_plan_count: number): boolean => {
  if (Number(plan_sms_limit) >= current_plan_count) {
    return true;
  } else {
    return false;
  }
};

export default async (account: Account, context: TagoContext, org_id: string, to_dispatch_qty: number, type: CommunicationMean): Promise<boolean> => {
  //id of the org device
  const org_params = await account.devices.paramList(org_id);

  const plan_email_limit = org_params.find((x) => x.key === "plan_email_limit");
  const plan_sms_limit = org_params.find((x) => x.key === "plan_sms_limit");
  const plan_notif_limit = org_params.find((x) => x.key === "plan_notif_limit");
  const plan_sms_limit_usage = org_params.find((x) => x.key === "plan_sms_limit_usage") || { key: "plan_sms_limit_usage", value: "0", sent: false };
  const plan_email_limit_usage = org_params.find((x) => x.key === "plan_email_limit_usage") || { key: "plan_email_limit_usage", value: "0", sent: false };
  const plan_notif_limit_usage = org_params.find((x) => x.key === "plan_notif_limit_usage") || { key: "plan_notif_limit_usage", value: "0", sent: false };

  //checking if the admin.tago.io profile has limit available
  if (!(await checkTagoPlan(account, type))) {
    return false;
  }
  if (type === "email") {
    const current_plan_count = Number(plan_email_limit_usage.value) + to_dispatch_qty;

    const org_has_limit = orgHasLimit(plan_email_limit.value, current_plan_count);

    if (org_has_limit) {
      await account.devices.paramSet(org_id, { ...plan_email_limit_usage, value: String(current_plan_count), sent: false }); //SET NEW SERVICE USAGE
      return true;
    } else if (!org_has_limit && !plan_email_limit_usage.sent) {
      await sendLimitAlert(account, context, org_id, plan_email_limit_usage.value, plan_sms_limit_usage.value, "email");

      await account.devices.paramSet(org_id, { ...plan_email_limit_usage, sent: true });

      return false;
    }

    return false;
  } else if (type === "sms") {
    const current_plan_count = Number(plan_sms_limit_usage.value) + to_dispatch_qty;

    const org_has_limit = orgHasLimit(plan_sms_limit.value, current_plan_count);

    if (org_has_limit) {
      await account.devices.paramSet(org_id, { ...plan_sms_limit_usage, value: String(current_plan_count), sent: false }); //SET NEW SERVICE USAGE
      return true;
    } else if (!org_has_limit && !plan_sms_limit_usage.sent) {
      await sendLimitAlert(account, context, org_id, plan_sms_limit_usage.value, plan_sms_limit_usage.value, "SMS");

      await account.devices.paramSet(org_id, { ...plan_sms_limit_usage, sent: true });

      return false;
    }

    return false;
  } else if (type === "notification_run") {
    const current_plan_count = Number(plan_notif_limit_usage.value) + to_dispatch_qty;

    const org_has_limit = orgHasLimit(plan_notif_limit.value, current_plan_count);

    if (org_has_limit) {
      await account.devices.paramSet(org_id, { ...plan_notif_limit_usage, value: String(current_plan_count), sent: false }); //SET NEW SERVICE USAGE
      return true;
    } else if (!org_has_limit && !plan_notif_limit_usage.sent) {
      await sendLimitAlert(account, context, org_id, plan_notif_limit_usage.value, plan_notif_limit_usage.value, "notification_run");

      await account.devices.paramSet(org_id, { ...plan_notif_limit_usage, sent: true });

      return false;
    }

    return false;
  }
};
