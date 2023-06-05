import { Utils, Account, Device, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import { fetchDeviceList } from "../lib/fetchDeviceList";

/**
 * Function to start the analysis and clear variables from devices of type organization
 * @param context
 * @param scope
 */
async function startAnalysis(context: TagoContext, scope: Data[]) {
  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  }
 else if (!environment.account_token) {
    throw "Missing account_token environment var";
  }
  const account = new Account({ token: environment.account_token });
  const deviceList = await fetchDeviceList(account, [{ key: "device_type", value: "organization" }]);

  for (const device of deviceList) {
    const dev = await Utils.getDevice(account, device.id);
    const result = await dev.deleteData({ variables: ["device_qty", "plan_usage"], qty: 9999 });
    console.debug(result);
  }
}


if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}
