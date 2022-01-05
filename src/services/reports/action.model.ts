import { Account } from "@tago-io/sdk";
import { findAnalysisByExportID } from "../../lib/findResource";

async function actionModel(account: Account, org_id: string, action_serie: string, cron: string, active: boolean, tags?: [{ key: string; value: string }]): Promise<any> {
  const script_id = await findAnalysisByExportID(account, "sendReport");

  return {
    name: `SENSOR REPORT ACTION / SERIE: ${action_serie}`,
    active,
    type: "schedule",
    tags: [{ key: "organization_id", value: org_id }, ...tags],
    trigger: [
      {
        cron, //"00 08 */1 * Fri,Mon,Sat,Sun,Thu,Tue,Wed"
        timezone: "UTC", //UTC -> +0GMT
      },
    ],
    action: { script: [script_id], type: "script" },
  };
}

export { actionModel };
