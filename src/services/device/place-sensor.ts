import { Resources } from "@tago-io/sdk";

import { getDashboardByTagID } from "../../lib/find-resource";
import { initializeValidation } from "../../lib/validation";
import { RouterConstructorData } from "../../types";

/**
 * Place Sensor on the map
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function sensorPlacement({ scope, environment }: RouterConstructorData) {
  if (!environment || !scope) {
    throw new Error("Missing parameters");
  }
  const { device: group_id } = scope[0];

  const sensor_id = scope.find((x) => x.variable === "set_dev_pin_id");
  const sensor_location = scope.find((x) => x.variable === "set_dev_pin_location");
  if (!sensor_id || !sensor_location) {
    throw new Error("Missing parameters sensor_id or sensor_location");
  }

  const validate = initializeValidation("placepin_validation", group_id);
  await validate("#VAL.PLACING_THE_PIN#", "warning").catch((error) => console.error(error));

  const [dev_id] = await Resources.devices.getDeviceData(group_id, { variables: "dev_id", groups: sensor_id.value as string, qty: 1 });

  await Resources.devices.editDeviceData(group_id, { ...dev_id, location: sensor_location.location });

  const dash_id = await getDashboardByTagID("dash_groupview");

  await Resources.dashboards.edit(dash_id, {});

  await validate("#VAL.PIN_PLACED_SUCCESSFULLY#", "success").catch((error) => console.error(error));
}

export { sensorPlacement };
