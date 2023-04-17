import { Account } from "@tago-io/sdk";
import { findAnalysisByExportID } from "../../lib/findResource";
import { ReportActionStructure } from "./create";

async function actionModel(account: Account, action_object: ReportActionStructure): Promise<any> {
  if(!account || !action_object.tags) {
    throw new Error("Missing parameters");
  }
  const script_id = await findAnalysisByExportID(account, "sendReport");

  const action_model = {
    name: `SENSOR REPORT ACTION / VAR. GROUP: ${action_object.group}`,
    active: action_object.active,
    type: "schedule",
    tags: [{ key: "organization_id", value: action_object.org_id }, ...action_object?.tags],
    trigger: [
      {
        cron: action_object.cron, //"00 08 */1 * Fri,Mon,Sat,Sun,Thu,Tue,Wed"
        timezone: "UTC", //UTC -> +0GMT
      },
    ],
    action: { script: [script_id], type: "script" },
  };

  return action_model;
}

export { actionModel };
