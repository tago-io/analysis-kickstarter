import { Resources } from "@tago-io/sdk";
import { AnalysisEnvironment } from "@tago-io/sdk/lib/types";

import { getAnalysisByTagID } from "../../lib/find-resource";
import { ReportActionStructure } from "./create";

/**
 * Function that create the action model
 * @param action_object Object with the action data
 * @param timezone timezone string
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function actionModel(action_object: ReportActionStructure, timezone: string, environment: AnalysisEnvironment): Promise<any> {
  if (!action_object.tags) {
    throw new Error("Missing parameters");
  }

  if (!environment.ACCOUNT_TOKEN) {
    throw new Error("Missing secret environment ACCOUNT_TOKEN");
  }

  const resources = new Resources({ token: environment.ACCOUNT_TOKEN });
  const script_id = await getAnalysisByTagID(resources, "sendReport");

  const action_model = {
    name: `SENSOR REPORT ACTION / VAR. GROUP: ${action_object.group}`,
    active: action_object.active,
    type: "schedule",
    // eslint-disable-next-line no-unsafe-optional-chaining
    tags: [{ key: "organization_id", value: action_object.org_id }, ...action_object?.tags],
    trigger: [
      {
        cron: action_object.cron, //"00 08 */1 * Fri,Mon,Sat,Sun,Thu,Tue,Wed"
        timezone,
      },
    ],
    action: { script: [script_id], type: "script" },
  };

  return action_model;
}

export { actionModel };
