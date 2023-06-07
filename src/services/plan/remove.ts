import { fetchDeviceList } from "../../lib/fetchDeviceList";
import { RouterConstructorData } from "../../types";

/**
 * Main function of deleting plan by admin account
 * @param config_dev Device of the configuration
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param account Account instanced class
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  if (!account || !environment || !scope || !config_dev || !context) {
    throw new Error("Missing parameters");
  }
  const plan_name = scope.find((x) => x.variable === "plan_data");
  if(!plan_name?.group) {
    throw new Error("Missing plan name to delete plan data from config_dev");
  }

  const org_dev_list = await fetchDeviceList(account, [
    { key: "device_type", value: "organization" },
    { key: "plan_group", value: plan_name?.group },
  ]);

  //do not let the user delete the plan if there's an organization assigned to it.
  if (org_dev_list.length > 0) {
    await config_dev.sendData(scope);
  }

  return console.debug("Plan deleted");
};
