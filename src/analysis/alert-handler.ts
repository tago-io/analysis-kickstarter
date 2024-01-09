/*
 * KickStarter Analysis
 * Alert Handler
 *
 * Work same as the handler analysis, but only for alerts.
 * This analysis handles most of buttons clickable by dashboard input form widgets such as dynamic table and input form widgets.
 *
 * Handles the following actions:
 * - Add, edit and delete an Alert
 */
import { Analysis, Utils } from "@tago-io/sdk";
import { Data, TagoContext } from "@tago-io/sdk/lib/types";

import { editAlert } from "../services/alerts/edit";
import { createAlert } from "../services/alerts/register";
import { deleteAlert } from "../services/alerts/remove";

/**
 * Function that starts the analysis
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 */
async function startAnalysis(context: TagoContext, scope: Data[]): Promise<void> {
  if (!scope[0]) {
    return console.error("Not a valid TagoIO Data");
  }

  console.debug(JSON.stringify(scope));
  console.debug("Alert analysis started");

  // Get the environment variables.
  const environment = Utils.envToJson(context.environment);

  const router = new Utils.AnalysisRouter({
    environment,
    scope,
    context,
  });

  router.register(createAlert).whenInputFormID("create-alert-dev");
  router.register(editAlert).whenWidgetExec("edit");
  router.register(deleteAlert).whenWidgetExec("delete");

  const result = await router.exec();

  console.debug("Script end. Functions that run:");
  console.debug(result.services);
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
