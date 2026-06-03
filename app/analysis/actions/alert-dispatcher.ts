/**
 * Alert Dispatcher Analysis
 *
 * Educational single-file Analysis that runs every time a sensor variable
 * crosses the threshold of a user-configured alert. This file is
 * intentionally self-contained — it has no relative imports.
 *
 * What is an "alert dispatch"?
 * ---------------------------
 * The Alerts dashboard lets a user describe a condition ("temperature > 80°F",
 * "door = open", ...). Behind the scenes, the `crud-alert` Analysis stores
 * that rule on the organization device AND provisions a TagoIO Action that
 * evaluates the condition on every uplink. When the condition is met, the
 * Action calls this Analysis — one "dispatch" — so we can resolve the
 * recipients, render the message, and notify everyone in-app.
 *
 * What it does
 * ------------
 * 1. Reads the originating Action by id (`environment._action_id`) to find
 *    the `alert_id` and `organization_id` tags.
 * 2. Reads the persisted alert row from the organization device — the
 *    same row the Alerts table widget renders.
 * 3. Replaces the placeholder keywords (`#device_name#`, `#device_id#`,
 *    `#sensor_type#`, `#value#`, `#variable#`) with the values from the
 *    uplink that fired this alert.
 * 4. Sends an in-app notification to every recipient listed on the row.
 *
 * Required environment variables
 * ------------------------------
 *   - T_ANALYSIS_TOKEN  : provided automatically by the TagoIO runtime.
 *   - _action_id        : provided automatically when the Action calls
 *                         this Analysis.
 *
 * NOTE
 * ----
 * This file is optimized for clarity, not performance. The goal is for a
 * developer new to TagoIO to read it top-to-bottom and understand every step.
 */

import { Analysis, type Data, Resources, type TagoContext, Utils } from "npm:@tago-io/sdk";
import z from "npm:zod";

// ============================================================================
// Constants
// ============================================================================

/**
 * Tag keys carried by every alert Action. They tell us which row on the
 * organization device drives this dispatch.
 */
const ACTION_TAG_ALERT_ID = "alert_id";
const ACTION_TAG_ORG_ID = "organization_id";

/** Variables that make up one alert row on the organization device. */
const VAR_SEND_TO = "alert_management_users";
const VAR_MESSAGE = "alert_management_message";
const VAR_MODEL = "alert_management_type";

/** Sensor tag key used to populate the `#sensor_type#` placeholder. */
const TAG_SENSOR_TYPE = "sensor_type";

/** Title used on every in-app notification dispatched by this Analysis. */
const NOTIFICATION_TITLE = "#VAL.ALERT_TRIGGERED_TITLE#";

// ============================================================================
// Validation schema
// ============================================================================

/**
 * Shape of one data point inside the uplink batch we receive in `scope`.
 *
 * The Action only fires when the condition matches, but we still validate
 * to fail fast (and log a clear reason) if the runtime ever calls us with
 * an unexpected payload — that's safer than reading `undefined.variable`
 * deep inside the dispatch.
 */
const triggerScopeModel = z.object({
  device: z.string().min(1, { error: "trigger is missing device id" }),
  variable: z.string().default(""),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

// ============================================================================
// Types
// ============================================================================

/** Everything we need to know about the alert that fired. */
interface AlertContext {
  alertID: string;
  organizationID: string;
  recipientIDs: string[];
  messageTemplate: string;
  triggerVariable: "temperature" | "door" | "inactivity" | string;
}

/** Everything we need to know about the uplink that fired the alert. */
interface TriggerContext {
  sensorID: string;
  sensorName: string;
  sensorType: string;
  variable: string;
  value: string;
}

/** Values substituted into the message template. */
interface RenderContext {
  deviceName: string;
  deviceID: string;
  sensorType: string;
  value: string;
  variable: string;
}

// ============================================================================
// Helpers — generic
// ============================================================================

/**
 * Splits a TagoIO comma-joined recipient list (e.g. `"id1, id2"`) into a
 * clean array of trimmed non-empty strings.
 */
function splitCsv(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

// ============================================================================
// Helpers — alert context lookup
// ============================================================================

/**
 * Loads the Action by id, reads its tags to know which alert fired, and
 * pulls the recipients + message template from the organization device.
 *
 * Returns undefined when any required piece is missing. The caller logs the
 * reason and exits cleanly — a misconfigured Action should not crash the
 * Analysis for other alerts that ARE configured correctly.
 */
async function loadAlertContext(actionID: string): Promise<AlertContext | undefined> {
  const action = await Resources.actions.info(actionID).catch(() => undefined);
  if (!action) {
    console.log(`Action ${actionID} not found; skipping`);
    return;
  }

  const alertID = action.tags?.find((tag) => tag.key === ACTION_TAG_ALERT_ID)?.value;
  const organizationID = action.tags?.find((tag) => tag.key === ACTION_TAG_ORG_ID)?.value;
  if (!alertID || !organizationID) {
    console.log(`Action ${actionID} is missing ${ACTION_TAG_ALERT_ID} or ${ACTION_TAG_ORG_ID} tag; skipping`);
    return;
  }

  // Recipients and message live on the organization device as two variables
  // sharing the same `group` (the alert id).
  const rows = await Resources.devices
    .getDeviceData(organizationID, { variables: [VAR_SEND_TO, VAR_MESSAGE, VAR_MODEL], groups: alertID, qty: 1 });

  const recipientsRecord = rows.find((row) => row.variable === VAR_SEND_TO)?.value;
  const messageRecord = rows.find((row) => row.variable === VAR_MESSAGE)?.value;
  const modelRecord = rows.find((row) => row.variable === VAR_MODEL)?.value;

  const recipientIDs = splitCsv(recipientsRecord);
  if (recipientIDs.length === 0) {
    console.log(`Alert ${alertID} has no recipients; skipping`);
    return;
  }

  const alertContext: AlertContext = {
    alertID,
    organizationID,
    recipientIDs,
    messageTemplate: String(messageRecord ?? ""),
    triggerVariable: String(modelRecord ?? ""),
  };

  return alertContext;
}

// ============================================================================
// Helpers — trigger context lookup
// ============================================================================

/**
 * Picks the data point that matches the alert's monitored variable out of
 * the uplink batch, then resolves the sensor's friendly name + type tag.
 *
 * The uplink batch (`scope`) carries every data point the sensor sent in
 * one push (e.g. `door`, `compressor`, `temperature`). We must filter to
 * the variable the alert actually watches — otherwise the `#value#` and
 * `#variable#` placeholders would render whatever happened to come first
 * in the array.
 *
 * The device lookup is tolerated to fail (the alert should still send even
 * if we only know the id). When that happens, the placeholders fall back
 * to the raw id, which keeps the notification useful.
 */
async function buildTriggerContext(scope: Data[], triggerVariable: string): Promise<TriggerContext | undefined> {
  const match = scope.find((item) => item.variable === triggerVariable);
  if (!match) {
    console.log(`Scope does not contain variable "${triggerVariable}"; skipping`);
    return;
  }

  const parsed = await triggerScopeModel.safeParseAsync(match);
  if (!parsed.success) {
    // `safeParseAsync` returns the issues instead of throwing, so we log
    // the first one and skip — calls without a real trigger are not
    // something the user can fix.
    console.log(`Skipping dispatch: ${parsed.error.issues[0]?.message ?? "trigger validation failed"}`);
    return;
  }

  const { device: sensorID, variable, value } = parsed.data;

  const sensorInfo = await Resources.devices.info(sensorID).catch(() => undefined);
  const sensorName = sensorInfo?.name ?? sensorID;
  const sensorType = sensorInfo?.tags.find((tag) => tag.key === TAG_SENSOR_TYPE)?.value ?? "";

  return {
    sensorID,
    sensorName,
    sensorType,
    variable,
    value: value === undefined ? "" : String(value),
  };
}

// ============================================================================
// Helpers — message rendering
// ============================================================================

/**
 * Replaces every supported `#keyword#` in the message with the matching
 * value from the uplink that fired the alert. Unknown keywords are left
 * untouched so the user gets a visible hint if they typed something wrong.
 */
function renderMessage(template: string, context: RenderContext): string {
  return template
    .replaceAll("#device_name#", context.deviceName)
    .replaceAll("#device_id#", context.deviceID)
    .replaceAll("#sensor_type#", context.sensorType)
    .replaceAll("#value#", context.value)
    .replaceAll("#variable#", context.variable);
}

// ============================================================================
// Helpers — notification dispatch
// ============================================================================

/**
 * Sends the rendered message to every recipient as an in-app notification.
 *
 * We dispatch serially (not in parallel) because TagoIO applies per-minute
 * rate limits on the notification endpoint, and a tight `Promise.all` is
 * the easiest way to trip them on a fan-out.
 */
async function dispatchNotifications(recipientIDs: string[], message: string): Promise<void> {
  for (const userID of recipientIDs) {
    await Resources.run
      .notificationCreate(userID, { title: NOTIFICATION_TITLE, message })
      .catch((error) => {
        console.error(`Failed to notify ${userID}: ${(error as Error).message ?? error}`);
      });
  }
}

// ============================================================================
// Entrypoint
// ============================================================================

/**
 * Entrypoint invoked by the TagoIO Analysis runtime.
 *
 * Steps:
 *   1. Read the Action id from the environment. Without it we have no way
 *      to know which alert fired.
 *   2. Load the alert context: the recipients and message template stored
 *      on the organization device. Skip when missing.
 *   3. Build the trigger context: the sensor name, type, variable, and
 *      value from the uplink that crossed the threshold. Skip when invalid.
 *   4. Render the message with the placeholder values and dispatch one
 *      in-app notification per recipient.
 */
async function startAnalysis(context: TagoContext, scope: Data[]) {
  console.log("Running Alert Dispatcher");

  const environment = Utils.envToJson(context.environment);

  // Step 1 — identify which Action invoked us.
  const actionID = environment._action_id;
  if (!actionID) {
    console.log("No _action_id in environment; skipping");
    return;
  }
  console.log(`Alert dispatch received: action=${actionID} scope_size=${scope?.length ?? 0}`);

  // Step 2 — load the alert row (recipients + message) for this Action.
  const alert = await loadAlertContext(actionID);
  if (!alert) {
    return;
  }

  // Step 3 — read the uplink data point that crossed the threshold.
  const trigger = await buildTriggerContext(scope, alert.triggerVariable);
  if (!trigger) {
    return;
  }

  // Step 4 — render the message and notify each recipient.
  const renderedMessage = renderMessage(alert.messageTemplate, {
    deviceName: trigger.sensorName,
    deviceID: trigger.sensorID,
    sensorType: trigger.sensorType,
    value: trigger.value,
    variable: trigger.variable,
  });

  await dispatchNotifications(alert.recipientIDs, renderedMessage);

  console.log(`Alert ${alert.alertID} dispatched to ${alert.recipientIDs.length} recipient(s)`);
}

// The Analysis runtime sets `T_TEST` during local tests so the handler is
// not wired up automatically. In production the runtime sets
// `T_ANALYSIS_TOKEN` and calls `Analysis.use` below.
if (!Deno.env.get("T_TEST")) {
  Analysis.use(startAnalysis, { token: Deno.env.get("T_ANALYSIS_TOKEN") });
}

export { startAnalysis };
