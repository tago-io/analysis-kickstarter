import { Resources } from "@tago-io/sdk";
import { fetchEntityList } from "../../lib/fetch-entity-list";
import { RouterConstructor } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { getPlanEntity } from "./register";
import { sendNotificationFeedback } from "../../lib/send-notification";

/**
 * Main function of deleting plan by admin account
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function planDel({ scope, environment }: RouterConstructor) {
  if (!scope || !environment) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const plan_id = scope[0].id;
  if (!plan_id) {
    const error = "Missing plan name to delete plan data from settings device";
    await sendNotificationFeedback({ environment, message: error });
    throw new Error(error);
  }

  const org_dev_list = await fetchEntityList({
    tags: [
      { key: "entity_type", value: "organization" },
      { key: "plan_group", value: plan_id },
    ],
  });

  //do not let the user delete the plan if there's an organization assigned to it.
  if (org_dev_list.length > 0) {
    const error = "Plan is assigned to an organization and cannot be deleted.";
    await sendNotificationFeedback({ environment, message: error });
    throw new Error(error);
  }

  const entity = await getPlanEntity().catch(async (error) => {
    await sendNotificationFeedback({ environment, message: error });
    throw new Error(error);
  });

  await Resources.entities.deleteEntityData(entity.id, { ids: [plan_id] });

  return console.debug("Plan deleted");
}

export { planDel };
