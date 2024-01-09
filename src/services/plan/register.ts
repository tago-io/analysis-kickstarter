import { Resources } from "@tago-io/sdk";

import { parseTagoObject } from "../../lib/data.logic";
import { initializeValidation } from "../../lib/validation";
import { RouterConstructorData } from "../../types";

/**
 * Main function of registered plan by admin account
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function planAdd({ scope, environment }: RouterConstructorData) {
  if (!scope) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  //Collecting data
  const new_plan_name = scope.find((x) => x.variable === "new_plan_name");
  const new_plan_email_limit = scope.find((x) => x.variable === "new_plan_email_limit");
  const new_plan_sms_limit = scope.find((x) => x.variable === "new_plan_sms_limit");
  const new_plan_notif_limit = scope.find((x) => x.variable === "new_plan_notif_limit");
  const new_plan_data_retention = scope.find((x) => x.variable === "new_plan_data_retention");

  if (!new_plan_name || !new_plan_email_limit || !new_plan_sms_limit || !new_plan_notif_limit || !new_plan_data_retention) {
    throw new Error("Missing variables in scope array to create new plan");
  }

  const validate = initializeValidation("plan_validation", config_id);

  const plan_exists = await Resources.devices.getDeviceData(config_id, { variables: "plan_data", values: new_plan_name.value });

  if (plan_exists.length > 0) {
    throw await validate("Plan name already in use!", "danger").catch((error) => console.log(error));
  }

  const to_tago = {
    plan_data: {
      value: new_plan_name.value,
      metadata: {
        email_limit: new_plan_email_limit.value,
        sms_limit: new_plan_sms_limit.value,
        notif_limit: new_plan_notif_limit.value,
        data_retention: new_plan_data_retention.value,
      },
    },
    plan_email_limit: new_plan_email_limit.value,
    plan_sms_limit: new_plan_sms_limit.value,
    plan_notif_limit: new_plan_notif_limit.value,
    plan_data_retention: new_plan_data_retention.value,
  };

  await Resources.devices.sendDeviceData(config_id, parseTagoObject(to_tago));

  return validate("New plan has been successfully created!", "success");
}

export { planAdd };
