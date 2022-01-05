import { Utils, Services, Account, Device, Types, Analysis } from "@tago-io/sdk";
import { findDashboardByExportID } from "../../lib/findResource";
import validation from "../../lib/validation";
import { RouterConstructorData } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  const { origin: group_id } = scope[0];

  const sensor_id = scope.find((x) => x.variable === "set_dev_pin_id");
  const sensor_location = scope.find((x) => x.variable === "set_dev_pin_location");

  const group_dev = await Utils.getDevice(account, group_id);
  const validate = validation("placepin_validation", group_dev);
  validate("#VAL.PLACING_THE_PIN#", "warning");

  const [dev_id] = await group_dev.getData({ variables: "dev_id", series: sensor_id.value as string, qty: 1 });

  delete dev_id.time;
  await group_dev.sendData({ ...dev_id, location: sensor_location.location });

  const dash_id = await findDashboardByExportID(account, "dash_groupview");

  await account.dashboards.edit(dash_id, {});

  validate("#VAL.PIN_PLACED_SUCCESSFULLY#", "success");
};
