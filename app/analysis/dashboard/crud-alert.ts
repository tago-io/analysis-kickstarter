/**
 * CRUD Alert Analysis
 *
 * Educational single-file Analysis that handles the full lifecycle of an
 * Alert in the TagoIO Kickstarter project: create and delete. This
 * file is intentionally self-contained — it has no relative imports.
 *
 * What an "alert" is in this project
 * ----------------------------------
 * An alert is a rule the user sets up on the Alerts dashboard: "notify
 * these run users when these sensors report this condition". Internally
 * each alert is stored as a set of data rows on the organization device
 * (so the Alerts table widget can render it) PLUS — for temperature,
 * door and compressor models — a TagoIO Action that listens to the
 * sensor variable and runs the dispatcher Analysis when the condition is
 * met. For the "inactivity" model (no uplink for X hours) no Action is
 * created: the scheduled Inactivity Check Analysis picks the row up.
 *
 * How it is triggered
 * -------------------
 * A dashboard sends Data points to this Analysis. The Analysis Router
 * from `@tago-io/sdk` inspects the scope and runs the matching handler:
 *
 *   - Input Form "create-alert"      -> createAlert
 *   - Custom Button "edit-alert"         -> editAlert
 *   - Device List action "delete-alert"  -> deleteAlert
 *
 * Required environment variables
 * ------------------------------
 *   - config_id             : ID of the configuration device that stores the
 *                             validation messages displayed back to the UI.
 *   - alert_dispatcher_id   : ID of the `alert-dispatcher` Analysis. The
 *                             Actions created here call it on every match.
 *   - T_ANALYSIS_TOKEN      : Provided automatically by the TagoIO runtime.
 *
 * NOTE
 * ----
 * This file is optimized for clarity, not performance. The goal is for a
 * developer new to TagoIO to read it top-to-bottom and understand every step.
 */

import { Analysis, type Conditionals, type Data, type DeviceListScope, type TagsObj } from "npm:@tago-io/sdk";
import { Resources, type RouterConstructor, type TagoContext, Utils } from "npm:@tago-io/sdk";
import { DateTime } from "npm:luxon";
import z, { ZodError } from "npm:zod";

// ============================================================================
// Constants
// ============================================================================

/**
 * Variables written on the organization device, one row per column on the
 * Alert List widget table. Every variable for the same alert shares the
 * same `group` (the alert id), so editing/deleting can target the whole
 * row through that group filter.
 */
const VAR_DEVICES = "alert_management_devices"; // Sensor(s) column
const VAR_MODEL = "alert_management_type"; // Model column
const VAR_CONDITION = "alert_management_condition"; // Condition column
const VAR_VALUE = "alert_management_value"; // Value column
const VAR_SEND_TO = "alert_management_users"; // Send to column
const VAR_MESSAGE = "alert_management_message"; // Message column

/**
 * Form variable names sent by the Input Form widget. See
 * `alert-scope-creation.jsonc` at the repo root for the full reference.
 */
const FORM_SETUP_BY = "new_alert_selected_type";
const FORM_SENSORS = "new_alert_selected_sensors";
const FORM_MODEL = "new_alert_type";
const FORM_CONDITION = "new_alert_condition";
const FORM_TEMP_VALUE = "new_alert_temp_value";
const FORM_TEMP_VALUE_BETWEEN = "new_alert_temp_value_between";
const FORM_DOOR = "new_alert_door_enum";
const FORM_COMPRESSOR = "new_alert_compressor_enum";
const FORM_CHECKIN = "new_alert_inactivity_hours";
const FORM_USERS = "new_alert_users";
const FORM_MESSAGE = "new_alert_custom_message";

/** Tag identifiers stored on every TagoIO Action created by this CRUD. */
const ACTION_TAG_ALERT_ID = "alert_id";
const ACTION_TAG_ORG_ID = "organization_id";
const ACTION_TAG_TYPE = "action_type";
const ACTION_TAG_TYPE_VALUE = "alert";

/**
 * Tag pairs the Action uses to match sensor devices at trigger time.
 *
 * `device_type=device` is the project-wide marker that flags a sensor
 * (set by `crud-sensor.ts`). We use it for `all_sensors` alerts so the
 * Action automatically covers every sensor in the organization.
 *
 * `alert_id=<alertID>` is added to each selected sensor by this CRUD
 * when the user picks specific sensors. The Action then matches only
 * those sensors. The tag is removed on delete.
 */
const SENSOR_TAG_DEVICE_TYPE = "device_type";
const SENSOR_TAG_DEVICE_VALUE = "device";
const SENSOR_TAG_ALERT_ID = "alert_id";

/** Human-readable labels used in the metadata of the table rows. */
const MODEL_LABELS: Record<string, string> = {
  temperature: "Temperature",
  door: "Door Status",
  compressor: "Compressor Status",
  inactivity: "Inactivity",
};

const CONDITION_LABELS: Record<string, string> = {
  ">": "Greater than",
  "<": "Less than",
  "=": "Equal to",
  "!": "Different from",
  "><": "Between",
};

/** Maps each non-inactivity model to the sensor variable the Action listens to. */
const MODEL_VARIABLE: Record<string, string> = {
  temperature: "temperature",
  door: "door",
  compressor: "compressor",
};

// ============================================================================
// Validation schema
// ============================================================================

/**
 * Form fields shared by every model. The model-specific fields are
 * validated separately inside `parseFormFields`.
 */
const commonModel = z.object({
  setupAlertsBy: z.enum(["all_sensors", "sensors"], { error: "Setup alerts by is required" }),
  sensors: z.array(z.string()).optional(),
  recipients: z.array(z.string()).min(1, { error: "At least one recipient is required" }),
  message: z
    .string({ error: "Message is required" })
    .min(1, { error: "Message is required" })
    .max(500, { error: "Message must be 500 characters or fewer" }),
});

const temperatureModel = z.object({
  model: z.literal("temperature"),
  condition: z.enum(["<", ">", "=", "!", "><"], { error: "Condition is required" }),
  value: z.coerce.number({ error: "Value must be a number" }),
  secondValue: z.coerce.number({ error: "Second value must be a number" }).optional(),
});

const doorModel = z.object({
  model: z.literal("door"),
  value: z.enum(["open", "closed"], { error: "Door value must be open or closed" }),
});

const compressorModel = z.object({
  model: z.literal("compressor"),
  value: z.enum(["on", "off"], { error: "Compressor value must be on or off" }),
});

const inactivityModel = z.object({
  model: z.literal("inactivity"),
  inactivityHours: z.coerce
    .number({ error: "Inactivity hours must be a number" })
    .int({ error: "Inactivity hours must be a whole number" })
    .positive({ error: "Inactivity hours must be greater than zero" }),
});

const modelDiscriminator = z.discriminatedUnion("model", [
  temperatureModel,
  doorModel,
  compressorModel,
  inactivityModel,
]);

type CommonFields = z.infer<typeof commonModel>;
type ModelFields = z.infer<typeof modelDiscriminator>;
type AlertFields = CommonFields & ModelFields;

// ============================================================================
// Helpers — error handling
// ============================================================================

/**
 * Extracts a short, human-readable message from a Zod or generic error and
 * re-throws it as a plain `Error`. Only the first Zod issue is surfaced
 * to the user.
 */
function getZodErrorMessage(error: unknown): never {
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Validation error";
    throw new Error(message);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Unknown error occurred");
}

// ============================================================================
// Helpers — feedback to the dashboard
// ============================================================================

type ValidationLevel = "success" | "danger" | "warning";

interface ValidationConfig {
  validationVariable: string;
  deviceID: string;
  sessionID?: string;
}

/**
 * Creates a `validate(message, level)` function tied to a specific
 * validation variable on the configuration device. The dashboard listens
 * to this variable through a Validation widget and renders the messages
 * to the user.
 */
function initializeValidation(config: ValidationConfig) {
  let messageIndex = 0;

  return async (message: string, level: ValidationLevel = "success"): Promise<string> => {
    if (!message?.trim()) {
      throw new Error("Validation message cannot be empty");
    }

    const now = DateTime.now();
    const timeOffset = ++messageIndex * 200;

    await Promise.allSettled([
      Resources.devices.deleteDeviceData(config.deviceID, {
        variables: config.validationVariable,
        qty: 999,
        end_date: now.minus({ minutes: 1 }).toJSDate(),
      }),
      Resources.devices.sendDeviceData(config.deviceID, {
        variable: config.validationVariable,
        value: message,
        time: now.plus({ milliseconds: timeOffset }).toJSDate(),
        metadata: {
          type: level,
          session_id: config.sessionID,
          show_markdown: false,
        },
      }),
    ]);

    return message;
  };
}

// ============================================================================
// Helpers — form parsing
// ============================================================================

/**
 * Splits a TagoIO comma-joined value (e.g. `"id1, id2, id3"`) into a clean
 * array of trimmed non-empty strings. The form widget joins multi-select
 * values with `", "` so we normalize at this boundary.
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

/**
 * Reads the alert form from the scope and runs it through the Zod schemas.
 *
 * The form is variadic — different fields appear depending on the model.
 * We pick out everything we might need first, then hand it to a
 * discriminated union so each model only validates what's relevant.
 */
async function parseFormFields(scope: Data[]): Promise<AlertFields> {
  const setupAlertsBy = scope.find((item) => item.variable === FORM_SETUP_BY)?.value;
  const sensors = splitCsv(scope.find((item) => item.variable === FORM_SENSORS)?.value);
  const model = scope.find((item) => item.variable === FORM_MODEL)?.value;
  const condition = scope.find((item) => item.variable === FORM_CONDITION)?.value;
  const tempValue = scope.find((item) => item.variable === FORM_TEMP_VALUE)?.value;
  const tempValueBetween = scope.find((item) => item.variable === FORM_TEMP_VALUE_BETWEEN)?.value;
  const door = scope.find((item) => item.variable === FORM_DOOR)?.value;
  const compressor = scope.find((item) => item.variable === FORM_COMPRESSOR)?.value;
  const inactivity = scope.find((item) => item.variable === FORM_CHECKIN)?.value;
  const recipients = splitCsv(scope.find((item) => item.variable === FORM_USERS)?.value);
  const message = scope.find((item) => item.variable === FORM_MESSAGE)?.value;

  const common = await commonModel.parseAsync({
    setupAlertsBy,
    sensors: sensors.length > 0 ? sensors : undefined,
    recipients,
    message,
  });

  if (common.setupAlertsBy === "sensors" && (!common.sensors || common.sensors.length === 0)) {
    throw new Error("#VAL.SELECT_AT_LEAST_ONE_SENSOR#");
  }

  let modelFields: ModelFields;
  if (model === "temperature") {
    modelFields = await temperatureModel.parseAsync({
      model,
      condition,
      value: tempValue,
      secondValue: condition === "><" ? tempValueBetween : undefined,
    });
    if (modelFields.condition === "><" && modelFields.secondValue === undefined) {
      throw new Error("#VAL.SECOND_VALUE_REQUIRED_BETWEEN#");
    }
  } else if (model === "door") {
    modelFields = await doorModel.parseAsync({ model, value: door });
  } else if (model === "compressor") {
    modelFields = await compressorModel.parseAsync({ model, value: compressor });
  } else if (model === "inactivity") {
    modelFields = await inactivityModel.parseAsync({ model, inactivityHours: inactivity });
  } else {
    throw new Error("#VAL.MODEL_REQUIRED#");
  }

  return { ...common, ...modelFields };
}

// ============================================================================
// Helpers — sensor resolution
// ============================================================================

/**
 * Fetches every sensor that belongs to the organization, returning a tiny
 * shape with just `id` and `name`. The Action creation needs the ids; the
 * row metadata stores the names so the table renders human-readable chips.
 */
async function listOrganizationSensors(organizationID: string): Promise<{ id: string; name: string; tags: TagsObj[] }[]> {
  const sensors: { id: string; name: string; tags: TagsObj[] }[] = [];
  for (let page = 1; page < 9999; page++) {
    const batch = await Resources.devices.list({
      page,
      amount: 100,
      fields: ["id", "name", "tags"],
      filter: {
        tags: [
          { key: "organization_id", value: organizationID },
          { key: "device_type", value: "device" },
        ],
      },
      resolveBucketName: false,
    });

    for (const device of batch) {
      sensors.push({ id: device.id, name: device.name, tags: device.tags });
    }

    if (batch.length < 100) {
      break;
    }
  }

  return sensors;
}

/**
 * Resolves the snapshot of sensors that the alert applies to.
 *
 * For `all_sensors` we list every sensor in the organization right now.
 * For `sensors` we look up the user-selected ids inside that list to grab
 * the display names. The names go on the chip metadata so the widget can
 * render labels even when the row is rendered offline.
 */
async function resolveTargetSensors(organizationID: string, fields: AlertFields): Promise<{ id: string; name: string; tags: TagsObj[] }[]> {
  const orgSensors = await listOrganizationSensors(organizationID);

  if (fields.setupAlertsBy === "all_sensors") {
    if (orgSensors.length === 0) {
      throw new Error("#VAL.ORG_HAS_NO_SENSORS#");
    }
    return orgSensors;
  }

  const wanted = new Set(fields.sensors ?? []);
  const matched = orgSensors.filter((sensor) => wanted.has(sensor.id));
  if (matched.length !== wanted.size) {
    throw new Error("#VAL.SENSORS_NOT_IN_ORGANIZATION#");
  }
  return matched;
}

// ============================================================================
// Helpers — recipient resolution
// ============================================================================

/**
 * Resolves run-user ids into `{ id, name }` pairs by listing every user in
 * the organization once and intersecting with the selection.
 */
async function resolveRecipients(organizationID: string, recipientIDs: string[]): Promise<{ id: string; name: string }[]> {
  const wanted = new Set(recipientIDs);
  const users = await Resources.run.listUsers({
    amount: 1000,
    fields: ["id", "name"],
    filter: { tags: [{ key: "organization_id", value: organizationID }] },
  });

  const matched: { id: string; name: string }[] = [];
  for (const user of users) {
    if (wanted.has(user.id)) {
      matched.push({ id: user.id, name: user.name });
    }
  }

  if (matched.length !== wanted.size) {
    throw new Error("#VAL.RECIPIENTS_NOT_IN_ORGANIZATION#");
  }
  return matched;
}

// ============================================================================
// Helpers — table-row persistence on the organization device
// ============================================================================

interface AlertRowPayload {
  organizationID: string;
  alertID: string;
  sensors: { id: string; name: string }[];
  recipients: { id: string; name: string }[];
  fields: AlertFields;
}

/**
 * Returns the value and human label that go into the `Value` column for the
 * resolved model. Temperature `between` joins both numbers; the enum
 * models map their value to a capitalized label.
 */
function buildValueColumn(fields: AlertFields): { value: string; label: string } {
  if (fields.model === "temperature") {
    if (fields.condition === "><" && fields.secondValue !== undefined) {
      return {
        value: `${fields.value},${fields.secondValue}`,
        label: `${fields.value} – ${fields.secondValue}`,
      };
    }
    return { value: String(fields.value), label: String(fields.value) };
  }
  if (fields.model === "door") {
    return { value: fields.value, label: fields.value === "open" ? "Open" : "Closed" };
  }
  if (fields.model === "compressor") {
    return { value: fields.value, label: fields.value === "on" ? "On" : "Off" };
  }
  return {
    value: String(fields.inactivityHours),
    label: `${fields.inactivityHours} hour${fields.inactivityHours === 1 ? "" : "s"}`,
  };
}

/**
 * Writes the six variables that make up one row on the Alert List widget.
 * Every variable shares the same `group` (the alert id) so edit and delete
 * can target the row through that group filter alone.
 */
async function persistAlertRow(payload: AlertRowPayload): Promise<void> {
  const { organizationID, alertID, sensors, recipients, fields } = payload;

  const devicesValue = fields.setupAlertsBy === "all_sensors" ? "all_sensors" : sensors.map((sensor) => sensor.id).join(", ");
  const devicesLabel = fields.setupAlertsBy === "all_sensors" ? "All Sensors" : sensors.map((sensor) => sensor.name).join(", ");
  const devicesChips = fields.setupAlertsBy === "all_sensors"
    ? [{ label: "All Sensors", value: "all_sensors" }]
    : sensors.map((sensor) => ({ label: sensor.name, value: sensor.id }));

  const condition = fields.model === "temperature" ? fields.condition : "";
  const conditionLabel = condition ? CONDITION_LABELS[condition] : "";

  const valueColumn = buildValueColumn(fields);

  const recipientsValue = recipients.map((user) => user.id).join(", ");
  const recipientsChips = recipients.map((user) => ({ label: user.name, value: user.id }));

  // We need each data point to share the SAME `group` (alertID) so widget
  // queries by group return the whole row. Tag the rows with the org id
  // and alert id metadata too — useful for downstream debugging.
  const commonMetadata = { alert_id: alertID, organization_id: organizationID };

  let unitForValue: { unit: string } | undefined = undefined;
  if (fields.model === "temperature") {
    unitForValue = { unit: "°F" };
  }
  if (fields.model === "inactivity") {
    unitForValue = { unit: "hour(s)" };
  }

  await Resources.devices.sendDeviceData(organizationID, [
    {
      variable: VAR_DEVICES,
      value: devicesValue,
      group: alertID,
      metadata: { ...commonMetadata, label: devicesLabel, sentValues: devicesChips },
    },
    {
      variable: VAR_MODEL,
      value: fields.model,
      group: alertID,
      metadata: { ...commonMetadata, label: MODEL_LABELS[fields.model] },
    },
    {
      variable: VAR_CONDITION,
      value: condition,
      group: alertID,
      metadata: { ...commonMetadata, label: conditionLabel },
    },
    {
      variable: VAR_VALUE,
      value: valueColumn.value,
      ...unitForValue,
      group: alertID,
      metadata: { ...commonMetadata, label: valueColumn.label },
    },
    {
      variable: VAR_SEND_TO,
      value: recipientsValue,
      group: alertID,
      metadata: { ...commonMetadata, sentValues: recipientsChips },
    },
    {
      variable: VAR_MESSAGE,
      value: fields.message,
      group: alertID,
      metadata: { ...commonMetadata },
    },
  ]);
}

/**
 * Deletes every data row that shares the alert id as group on the
 * organization device. Called from delete AND from edit (we re-create the
 * row from scratch on edit so we don't have to update six points
 * individually).
 */
async function deleteAlertRow(organizationID: string, alertID: string): Promise<void> {
  await Resources.devices.deleteDeviceData(organizationID, {
    groups: alertID,
    qty: 9999,
  });
}

// ============================================================================
// Helpers — TagoIO Action lifecycle
// ============================================================================

/** Subset of AlertFields that the Action layer can actually handle. */
type ActionableAlertFields = CommonFields & Exclude<ModelFields, { model: "inactivity" }>;

/**
 * Builds the trigger array for the TagoIO Action.
 *
 * The Action listens to a SENSOR variable on every device that matches a
 * tag pair. This way one Action covers many sensors at once, and new
 * sensors that match the tag are automatically included
 *
 * Two cases:
 *   - `setupAlertsBy === "all_sensors"` → match every sensor in this org
 *     by the project-wide marker tag `device_type=device`. The Action's
 *     own `organization_id` tag is what keeps it scoped to one tenant
 *     (see `createAlertAction`).
 *   - `setupAlertsBy === "sensors"`     → match sensors that carry the
 *     `alert_id` tag pointing at this alert. We add that tag to the
 *     selected sensors at create time (see `tagSensorsForAlert`).
 */
function buildTriggers(alertID: string, fields: ActionableAlertFields): Array<{
  tag_key: string;
  tag_value: string;
  variable: string;
  is: Conditionals;
  value: string;
  second_value?: string;
  value_type: "string" | "number" | "boolean" | "*";
}> {
  const variable = MODEL_VARIABLE[fields.model];

  const tagPair = fields.setupAlertsBy === "all_sensors"
    ? { tag_key: SENSOR_TAG_DEVICE_TYPE, tag_value: SENSOR_TAG_DEVICE_VALUE }
    : { tag_key: SENSOR_TAG_ALERT_ID, tag_value: alertID };

  if (fields.model === "temperature") {
    return [{
      ...tagPair,
      variable,
      is: fields.condition,
      value: String(fields.value),
      ...(fields.condition === "><" && fields.secondValue !== undefined ? { second_value: String(fields.secondValue) } : {}),
      value_type: "number",
    }];
  }

  // door + compressor — equality match on a string value.
  return [{
    ...tagPair,
    variable,
    is: "=",
    value: fields.value,
    value_type: "string",
  }];
}

/**
 * Creates the TagoIO Action that watches the configured sensors and calls
 * the dispatcher Analysis on every match. Tags carry the alert id so we
 * can find this Action again on edit/delete.
 */
async function createAlertAction(params: {
  alertID: string;
  organizationID: string;
  dispatcherID: string;
  fields: AlertFields;
}): Promise<void> {
  const { alertID, organizationID, dispatcherID, fields } = params;

  if (fields.model === "inactivity") {
    return;
  }

  const triggers = buildTriggers(alertID, fields);

  // The SDK only types `condition` triggers with a `device` id, but the
  // TagoIO API also accepts `tag_key`/`tag_value` here — the platform
  // matches every device whose tags include the pair. We cast through
  // `unknown` to avoid silencing other shape errors.
  await Resources.actions.create({
    name: `[alert] ${alertID}`,
    active: true,
    type: "condition",
    tags: [
      { key: ACTION_TAG_ALERT_ID, value: alertID },
      { key: ACTION_TAG_ORG_ID, value: organizationID },
      { key: ACTION_TAG_TYPE, value: ACTION_TAG_TYPE_VALUE },
    ],
    trigger: triggers as unknown as any,
    action: { type: "script", script: [dispatcherID] },
  });
}

/**
 * Adds the `alert_id` tag to every selected sensor. The Action then picks
 * them up automatically via its `tag_key/tag_value` trigger. Existing tags
 * on each sensor are preserved.
 */
async function tagSensorsForAlert(alertID: string, sensorList: { id: string; tags: TagsObj[] }[]): Promise<void> {
  for (const sensor of sensorList) {
    const filteredTags = sensor.tags.filter((tag) => !(tag.key === SENSOR_TAG_ALERT_ID && tag.value === alertID));
    const nextTags = [...filteredTags, { key: SENSOR_TAG_ALERT_ID, value: alertID }];
    await Resources.devices.edit(sensor.id, { tags: nextTags }).catch((error) => {
      console.error(`Failed to tag sensor ${sensor.id}: ${(error as Error).message}`);
    });
  }
}

/**
 * Removes the `alert_id=alertID` tag from every sensor that currently
 * carries it. We discover the sensors with `Resources.devices.list`
 * filtered by the tag, so we do not need to remember which sensors were
 * picked at create time.
 */
async function untagSensorsForAlert(alertID: string): Promise<void> {
  const sensors = await Resources.devices.list({
    amount: 1000,
    fields: ["id", "tags"],
    filter: { tags: [{ key: SENSOR_TAG_ALERT_ID, value: alertID }] },
    resolveBucketName: false,
  });

  for (const sensor of sensors) {
    const nextTags = sensor.tags.filter((tag) => !(tag.key === SENSOR_TAG_ALERT_ID && tag.value === alertID));
    await Resources.devices.edit(sensor.id, { tags: nextTags }).catch((error) => {
      console.error(`Failed to untag sensor ${sensor.id}: ${(error as Error).message}`);
    });
  }
}

/**
 * Returns the id of the single Action tagged with the given alert id, or
 * null if none exists. Used by delete so we never operate on stale
 * references.
 */
async function findActionByAlertID(alertID: string): Promise<string | null> {
  const actions = await Resources.actions.list({
    amount: 10,
    fields: ["id", "tags"],
    filter: { tags: [{ key: ACTION_TAG_ALERT_ID, value: alertID }] },
  });

  const action = actions[0];
  return action ? action.id : null;
}

/** Deletes the TagoIO Action that backs the alert, if any. */
async function deleteAlertAction(alertID: string): Promise<void> {
  const actionID = await findActionByAlertID(alertID);
  if (actionID) {
    await Resources.actions.delete(actionID).catch(console.error);
  }
}

// ============================================================================
// CREATE flow
// ============================================================================

async function createAlert({ context, environment, scope }: RouterConstructor & { scope: Data[] }) {
  console.log("[createAlert] start");

  if (!("variable" in scope[0])) {
    console.error("Not a valid TagoIO Data");
    return;
  }
  if (!context) {
    throw "[Error] Missing analysis context.";
  }

  const configDevID = environment.config_id;
  const dispatcherID = environment.alert_dispatcher_id;

  const organizationID = scope[0].device;
  if (!organizationID) {
    throw "[Error] Missing organization ID in scope.";
  }

  const sessionID = z.string().parse(scope.find((item) => item.variable === "create_alert_session_id")?.value);
  const validate = initializeValidation({ validationVariable: "create_alert_validation", deviceID: configDevID, sessionID });

  await validate("#VAL.CREATING_ALERT_WAIT#", "warning").catch(console.log);

  const fields = await parseFormFields(scope)
    .catch(getZodErrorMessage)
    .catch(async (error: Error) => {
      await validate(error.message, "danger");
      throw error;
    });

  // Resolve sensors and recipients against the live tenant data so we can
  // store labels and reject ids that don't belong to this organization.
  const sensors = await resolveTargetSensors(organizationID, fields).catch(async (error: Error) => {
    await validate(error.message, "danger");
    throw error;
  });

  const recipients = await resolveRecipients(organizationID, fields.recipients).catch(async (error: Error) => {
    await validate(error.message, "danger");
    throw error;
  });

  // The data point id of the first row becomes the alert id. We generate
  // it ourselves by deriving from `Date.now()` so it's predictable inside
  // this function (Resources.devices.sendDeviceData does not return the
  // generated id in the array shape).
  const alertID = `alert_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;

  await persistAlertRow({ organizationID, alertID, sensors, recipients, fields });

  // When the user picked specific sensors, write the `alert_id` tag on each
  // one BEFORE creating the Action — the Action's `tag_key/tag_value`
  // trigger needs the tags to be already in place to match.
  if (fields.setupAlertsBy === "sensors") {
    await tagSensorsForAlert(alertID, sensors);
  }

  await createAlertAction({
    alertID,
    organizationID,
    dispatcherID,
    fields,
  }).catch(async (error: Error) => {
    // Rollback the table row AND the sensor tags if Action creation fails.
    // The user shouldn't see a half-created alert.
    await deleteAlertRow(organizationID, alertID).catch(console.error);
    if (fields.setupAlertsBy === "sensors") {
      await untagSensorsForAlert(alertID).catch(console.error);
    }
    console.error("Failed to create alert action:", error);
    await validate("#VAL.FAILED_TO_CREATE_ALERT_ACTION#", "danger");
    throw error;
  });

  await validate("#VAL.ALERT_SUCCESSFULLY_CREATED#", "success");
}

// ============================================================================
// DELETE flow
// ============================================================================

async function deleteAlert({ scope }: RouterConstructor & { scope: DeviceListScope[] }) {
  console.log("[deleteAlert] start");

  const entry = scope[0];
  const alertID = entry?.group;
  const organizationID = entry?.device;

  if (!alertID) {
    throw "[Error] Missing alert id (group) in scope.";
  }
  if (!organizationID) {
    throw "[Error] Missing organization ID in scope.";
  }

  await deleteAlertRow(organizationID, alertID);
  await deleteAlertAction(alertID);
  // Strip the `alert_id` tag from any sensor that still carries it.
  // No-op for `all_sensors` alerts (we never tagged anything in that case).
  await untagSensorsForAlert(alertID);
}

// ============================================================================
// Router entrypoint
// ============================================================================

async function startAnalysis(context: TagoContext, scope: Data[]): Promise<void> {
  console.log("Running CRUD Alert Analysis");
  console.log("Scope:", scope);

  const environment = Utils.envToJson(context.environment);
  if (!environment.config_id) {
    throw "Missing config_id environment variable";
  }
  if (!environment.alert_dispatcher_id) {
    throw "Missing alert_dispatcher_id environment variable";
  }

  const router = new Utils.AnalysisRouter({ scope, context, environment });

  router.register(createAlert).whenInputFormID("create-alert");
  router.register(deleteAlert).whenVariableLike("alert_management_").whenWidgetExec("delete");

  const result = await router.exec();
  console.log("Services found:", result.services);
}

if (!Deno.env.get("T_TEST")) {
  Analysis.use(startAnalysis, { token: Deno.env.get("T_ANALYSIS_TOKEN") });
}

export { startAnalysis };
