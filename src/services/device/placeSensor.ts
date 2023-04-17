import { Utils } from "@tago-io/sdk";
import { findDashboardByExportID } from "../../lib/findResource";
import validation from "../../lib/validation";
import { RouterConstructorData } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  if (!account || !environment || !scope || !config_dev || !context) {
    throw new Error("Missing parameters");
  }
  const { device: group_id } = scope[0];

  const sensor_id = scope.find((x) => x.variable === "set_dev_pin_id");
  const sensor_location = scope.find((x) => x.variable === "set_dev_pin_location");
  if(!sensor_id || !sensor_location) {
    throw new Error("Missing parameters sensor_id or sensor_location");
  }

  const group_dev = await Utils.getDevice(account, group_id);
  const validate = validation("placepin_validation", group_dev);
  validate("#VAL.PLACING_THE_PIN#", "warning");

  const [dev_id] = await group_dev.getData({ variables: "dev_id", groups: sensor_id.value as string, qty: 1 });

  await group_dev.editData({ ...dev_id, location: sensor_location.location })

  const dash_id = await findDashboardByExportID(account, "dash_groupview");

  await account.dashboards.edit(dash_id, {});

  validate("#VAL.PIN_PLACED_SUCCESSFULLY#", "success");
};
