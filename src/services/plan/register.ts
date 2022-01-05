import validation from "../../lib/validation";
import { parseTagoObject } from "../../lib/data.logic";
import { RouterConstructorData } from "../../types";

//registered by admin account.

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  //Collecting data
  const new_plan_name = scope.find((x) => x.variable === "new_plan_name");
  const new_plan_email_limit = scope.find((x) => x.variable === "new_plan_email_limit");
  const new_plan_sms_limit = scope.find((x) => x.variable === "new_plan_sms_limit");
  const new_plan_notif_limit = scope.find((x) => x.variable === "new_plan_notif_limit");
  const new_plan_data_retention = scope.find((x) => x.variable === "new_plan_data_retention");

  //validation
  const validate = validation("plan_validation", config_dev);

  const plan_exists = await config_dev.getData({ variables: "plan_data", values: new_plan_name.value });

  if (plan_exists.length > 0) {
    throw validate("Plan name already in use!", "danger");
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

  await config_dev.sendData(parseTagoObject(to_tago));

  return validate("New plan has been successfully created!", "success");
};
