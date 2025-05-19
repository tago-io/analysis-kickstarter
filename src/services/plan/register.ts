import { Resources } from "@tago-io/sdk";
import { initializeValidation } from "../../lib/validation";
import { RouterConstructor } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { EntityData } from "../../types";
import { planModel, IPlanModel } from "./plan.model";
import { getZodError } from "../../lib/get-zod-error";

/**
 * Retrieves the plan entity from TagoIO.
 *
 * @returns {Promise<Entity>} A promise that resolves to the plan entity
 * @throws {Error} If no plan entity is found
 */
async function getPlanEntity() {
  const [entity] = await Resources.entities.list({
    filter: {
      tags: [{ key: "entity_type", value: "plan" }],
    },
    amount: 1,
  });

  if (!entity) {
    throw new Error("Plan entity not found.");
  }

  return entity;
}

/**
 * Sends plan data to an entity in TagoIO.
 *
 * @param {string} id - The ID of the entity to send the plan data to
 * @param {IPlanModel} formFields - The validated plan data containing name, usage limits and data retention
 * @returns {Promise<void>} A promise that resolves when the data is sent successfully
 */
async function sendPlanData(id: string, formFields: IPlanModel) {
  const dataToSend = {
    name: formFields.name,
    email_usg_limit_qty_m: formFields.email_usg_limit_qty_m,
    sms_usg_limit_qty_m: formFields.sms_usg_limit_qty_m,
    push_notification_usg_limit_qty_m: formFields.push_notification_usg_limit_qty_m,
    data_retention_m: formFields.data_retention_m,
  };

  await Resources.entities.sendEntityData(id, dataToSend);
}

/**
 * Retrieves and parses form fields from the provided data scope.
 *
 * @param {Data[]} scope - An array of data objects containing form field information.
 * @returns {Promise<ParsedResult>} A promise that resolves to the parsed result of the form fields.
 *
 * @throws {Error} If parsing the form fields fails.
 */
async function getFormFields(scope: EntityData[]) {
  //Collecting data
  const newPlanName = scope.find((x) => x.new_plan_name)?.new_plan_name as string;
  const newPlanEmailLimit = scope.find((x) => x.new_plan_email_usage_limit_qty_month)?.new_plan_email_usage_limit_qty_month as number;
  const newPlanSmsLimit = scope.find((x) => x.new_plan_sms_usage_limit_qty_month)?.new_plan_sms_usage_limit_qty_month as number;
  const newPlanNotifLimit = scope.find((x) => x.new_plan_push_notif_usage_limit_qty_month)?.new_plan_push_notif_usage_limit_qty_month as number;
  const newPlanDataRetention = scope.find((x) => x.new_plan_data_retention_month)?.new_plan_data_retention_month as number;

  const result = await planModel.parseAsync({
    name: newPlanName,
    email_usg_limit_qty_m: newPlanEmailLimit,
    sms_usg_limit_qty_m: newPlanSmsLimit,
    push_notification_usg_limit_qty_m: newPlanNotifLimit,
    data_retention_m: newPlanDataRetention,
  });

  return result;
}

/**
 * Main function of registered plan by admin account
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function planAdd({ scope, environment }: RouterConstructor) {
  if (!scope) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  //Collecting data
  const validate = initializeValidation("plan_validation", config_id);
  await validate("#VAL.RESGISTERING#", "warning").catch((error) => console.log(error));

  const formFields = await getFormFields(scope)
    .catch(getZodError)
    .catch(async (error) => {
      await validate(error, "danger");
      throw error;
    });

  if (!formFields) {
    const error = "Form fields are required.";
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  }

  const entity = await getPlanEntity().catch(async (error) => {
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  });

  const plan_exists = await Resources.entities.getEntityData(entity.id, {
    filter: {
      name: formFields.name,
    },
    index: "name_index",
    amount: 1,
   });

  if (plan_exists.length > 0) {
    const error = "Plan name already in use!";
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  }

  await sendPlanData(entity.id, formFields).catch(async (error) => {
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  });

  return validate("New plan has been successfully created!", "success");
}

export { planAdd, getPlanEntity };
