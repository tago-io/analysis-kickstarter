import { Resources } from "@tago-io/sdk";
import { sendNotificationFeedback } from "../../lib/send-notification";
import { RouterConstructor } from "@tago-io/sdk/lib/modules/Utils/router/router";
import { IPlanModelEdit, planModelEdit } from "./plan.model";
import { EntityData } from "../../types";
import { getZodError } from "../../lib/get-zod-error";
import { getPlanEntity } from "./register";
import { fetchEntityList, FetchEntityResponse } from "../../lib/fetch-entity-list";
import { TagResolver } from "../../lib/edit.tag";

/**
 * Function that resolves the report of the organization and send it to the user
 */
const resolveOrg = async (org: FetchEntityResponse, plan_data: IPlanModelEdit) => {
  if (!org || !plan_data) {
    throw new Error("Missing parameters");
  }
  //changing tags
  const orgInfo = await Resources.entities.info(org.id);
  const tagResolver = TagResolver(orgInfo.tags, false, "entity");
  tagResolver.setTag("plan_name", plan_data.name as string);
  tagResolver.setTag("plan_email_limit", String(plan_data.email_usg_limit_qty_m));
  tagResolver.setTag("plan_sms_limit", String(plan_data.sms_usg_limit_qty_m));
  tagResolver.setTag("plan_notif_limit", String(plan_data.push_notification_usg_limit_qty_m));
  tagResolver.setTag("plan_data_retention", String(plan_data.data_retention_m));
  await tagResolver.apply(org.id);
};

/**
 * Undo Plan changes
 */
async function _undoPlanChanges(scope: EntityData[]) {
  if (!scope || scope.length === 0) {
    throw new Error("Missing parameters");
  }

  const dataId = scope[0].id as string;
  const entityPlan = await getPlanEntity();
  let [plan_data] = await Resources.entities.getEntityData(entityPlan.id, {
    filter: {
      id: dataId,
    },
    index: "id_idx",
    amount: 1,
   });

  if (!plan_data) {
    throw new Error("Plan data not found.");
  }

  plan_data.name = scope.find((x) => x.old?.name)?.old.name as string;
  plan_data.email_usg_limit_qty_m = scope.find((x) => x.old?.email_usg_limit_qty_m)?.old.email_usg_limit_qty_m as number;
  plan_data.sms_usg_limit_qty_m = scope.find((x) => x.old?.sms_usg_limit_qty_m)?.old.sms_usg_limit_qty_m as number;
  plan_data.push_notification_usg_limit_qty_m = scope.find((x) => x.old?.push_notification_usg_limit_qty_m)?.old.push_notification_usg_limit_qty_m as number;
  plan_data.data_retention_m = scope.find((x) => x.old?.data_retention_m)?.old.data_retention_m as number;

  await Resources.entities.editEntityData(entityPlan.id, [plan_data]);
}

async function getFormFields(scope: EntityData[]) {
  //Collecting data
  const newPlanName = scope.find((x) => x.name)?.name as string;
  const newPlanEmailLimit = scope.find((x) => x.email_usg_limit_qty_m)?.email_usg_limit_qty_m as number;
  const newPlanSmsLimit = scope.find((x) => x.sms_usg_limit_qty_m)?.sms_usg_limit_qty_m as number;
  const newPlanNotifLimit = scope.find((x) => x.push_notification_usg_limit_qty_m)?.push_notification_usg_limit_qty_m as number;
  const newPlanDataRetention = scope.find((x) => x.data_retention_m)?.data_retention_m as number;

  const result = await planModelEdit.parseAsync({
    name: newPlanName,
    email_usg_limit_qty_m: newPlanEmailLimit,
    sms_usg_limit_qty_m: newPlanSmsLimit,
    push_notification_usg_limit_qty_m: newPlanNotifLimit,
    data_retention_m: newPlanDataRetention,
  });

  return result;
}

/**
 * Main function of editing plan by admin account
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function planEdit({ context, scope, environment }: RouterConstructor) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }

  const dataId = scope[0].id as string;

  const formFields = await getFormFields(scope)
    .catch(getZodError)
    .catch(async (error) => {
      await _undoPlanChanges(scope);
      await sendNotificationFeedback({ environment, message: error });
      throw error;
    });

  if (!formFields) {
    const error = "Form fields are required.";
    await sendNotificationFeedback({ environment, message: error });
    throw new Error(error);
  }

  const orgEntityList = await fetchEntityList({
    tags: [
      { key: "entity_type", value: "organization" },
      { key: "plan_group", value: dataId },
    ],
  });

  const entityPlan = await getPlanEntity();
  let [plan_data] = await Resources.entities.getEntityData(entityPlan.id, {
    filter: {
      id: dataId,
    },
    index: "id_idx",
    amount: 1,
   });

  if (!plan_data) {
    throw new Error("Plan data not found.");
  }

  for (const org of orgEntityList) {
    await resolveOrg(org, {
      name: plan_data.name,
      email_usg_limit_qty_m: plan_data.email_usg_limit_qty_m,
      sms_usg_limit_qty_m: plan_data.sms_usg_limit_qty_m,
      push_notification_usg_limit_qty_m: plan_data.push_notification_usg_limit_qty_m,
      data_retention_m: plan_data.data_retention_m
    });
  }

  return console.debug("Plan edited!");
}

export { planEdit };
