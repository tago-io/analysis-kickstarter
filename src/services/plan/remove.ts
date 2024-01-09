import { Resources } from "@tago-io/sdk";

import { fetchDeviceList } from "../../lib/fetch-device-list";
import { RouterConstructorData } from "../../types";

/**
 * Main function of deleting plan by admin account
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function planDel({ scope, environment }: RouterConstructorData) {
  if (!scope || !environment) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const plan_name = scope.find((x) => x.variable === "plan_data");
  if (!plan_name?.group) {
    throw new Error("Missing plan name to delete plan data from settings device");
  }

  const org_dev_list = await fetchDeviceList({
    tags: [
      { key: "device_type", value: "organization" },
      { key: "plan_group", value: plan_name?.group },
    ],
  });

  //do not let the user delete the plan if there's an organization assigned to it.
  if (org_dev_list.length > 0) {
    await Resources.devices.sendDeviceData(config_id, scope);
  }

  return console.debug("Plan deleted");
}

export { planDel };
