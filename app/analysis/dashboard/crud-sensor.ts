/**
 * CRUD Sensor Analysis
 *
 * Educational single-file Analysis that handles the full lifecycle of a
 * Sensor resource in the TagoIO Kickstarter project: create, edit and
 * delete. This file is intentionally self-contained — it has no relative
 * imports.
 *
 * How it is triggered
 * -------------------
 * A dashboard sends Data points to this Analysis. The Analysis Router from
 * `@tago-io/sdk` inspects the scope and runs the matching handler:
 *
 *   - Input Form "create-sensor"          -> createSensor
 *   - Custom Button "edit-sensor"         -> editSensor
 *   - Device List action "delete-sensor"  -> deleteSensor
 *
 * Required environment variables
 * ------------------------------
 *   - config_id          : ID of the configuration device that stores the
 *                          dashboard's per-organization data and is used to
 *                          publish validation messages back to the UI.
 *   - T_ANALYSIS_TOKEN   : Provided automatically by the TagoIO runtime.
 *
 * NOTE
 * ----
 * This file is optimized for clarity, not performance. The goal is for a
 * developer new to TagoIO to read it top-to-bottom and understand every step.
 */

import { Analysis, type Data, type DeviceCreateInfo, type DeviceListScope } from "npm:@tago-io/sdk";
import { Resources, type RouterConstructor, Services, type TagoContext, type TagsObj, Utils } from "npm:@tago-io/sdk";
import { DateTime } from "npm:luxon";
import z, { ZodError } from "npm:zod";

// ============================================================================
// Constants
// ============================================================================

/**
 * Tag key/value used to find the dashboard that opens a single sensor's
 * detail view. The dashboard is matched by its `export_id` tag, set when
 * the dashboard template is imported into the account.
 */
const SENSOR_DASHBOARD_TAG_KEY = "export_id";
const SENSOR_DASHBOARD_TAG_VALUE = "sensor-freezer-dash";

/**
 * Variable used on the group device to expose the sensor connectivity
 * summary (total registered, online, offline) that powers the Sensor
 * Status cards on the Sensors dashboard.
 */
const SUMMARY_VARIABLE = "device_connectivity_summary";

// ============================================================================
// Validation schema
// ============================================================================

const sensorModel = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(1, { error: "Name must be at least 1 character" })
    .max(40, { error: "Name must be less than 40 characters" }),
  eui: z
    .string({ error: "EUI is required" })
    .regex(/^[0-9a-fA-F]{16}$/, { error: "EUI must be 16 hexadecimal characters" }),
  network: z
    .string({ error: "Network is required" })
    .min(1, { error: "Network is required" }),
  connector: z
    .string({ error: "Connector is required" })
    .min(1, { error: "Connector is required" }),
});

/**
 * Partial schema reused by the Edit flow. The Device List widget only
 * exposes the name today, so every other field becomes optional and is
 * skipped when not present.
 */
const sensorEditModel = sensorModel.partial();

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
 *
 * Each call cleans up old validation entries (>1 minute) and writes a new
 * one with a small timestamp offset, so multiple messages from the same
 * run still appear in the correct order on the dashboard.
 */
function initializeValidation(config: ValidationConfig) {
  let messageIndex = 0;

  return async (message: string, level: ValidationLevel = "success"): Promise<string> => {
    if (!message?.trim()) {
      throw new Error("Validation message cannot be empty");
    }

    const now = DateTime.now();
    // Each subsequent message is pushed 200ms forward so the dashboard
    // renders them in insertion order even if the API timestamps collide.
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

/**
 * Sends an in-app notification to the Run User who triggered the
 * Analysis. Falls back to a developer notification if no user can be
 * identified — useful for edit/delete flows where the dashboard doesn't
 * expose a Validation widget.
 */
async function sendNotificationFeedback(params: { environment: Record<string, string>; title?: string; message: string }): Promise<void> {
  const { environment, title, message } = params;
  const userID = environment?._user_id;

  if (!userID) {
    const services = new Services({ token: Deno.env.get("T_ANALYSIS_TOKEN") });
    await services.notification.send({ title: title || "#VAL.OPERATION_ERROR#", message });
    return;
  }

  const user = await Resources.run.userInfo(userID).catch(() => null);
  if (!user) {
    const services = new Services({ token: Deno.env.get("T_ANALYSIS_TOKEN") });
    await services.notification.send({ title: title || "#VAL.OPERATION_ERROR#", message });
    return;
  }

  await Resources.run.notificationCreate(userID, {
    title: title || "#VAL.OPERATION_ERROR#",
    message,
  });
}

// ============================================================================
// Helpers — resource lookups
// ============================================================================

/**
 * Checks whether a device with the given name and/or tags already exists.
 *
 * @param isEdit - During an edit, the device being modified is itself
 *   returned by the search, so we only consider it a duplicate when more
 *   than one device matches. During a create, any match is a duplicate.
 */
async function deviceExists(params: { name?: string; tags: { key: string; value: string }[]; isEdit?: boolean }): Promise<boolean> {
  const { name, tags, isEdit = false } = params;

  const found: { id: string }[] = [];
  for (let page = 1; page < 9999; page++) {
    const batch = await Resources.devices.list({
      page,
      amount: 100,
      fields: ["id", "name", "tags"],
      filter: { name, tags },
      resolveBucketName: false,
    });

    found.push(...batch);
    if (batch.length < 100) {
      break;
    }
  }

  if (isEdit) {
    return found.length > 1;
  }

  return found.length > 0;
}

/**
 * Finds a Dashboard ID by a tag value. Used to compose the URL that
 * opens the sensor detail dashboard right after creation.
 */
async function getDashboardIDByTag(tagKey: string, tagValue: string): Promise<string> {
  const [dashboard] = await Resources.dashboards.list({
    amount: 1,
    fields: ["id", "tags"],
    filter: { tags: [{ key: tagKey, value: tagValue }] },
  });

  if (!dashboard?.id) {
    throw new Error(`Dashboard with ${tagKey}=${tagValue} not found`);
  }

  return dashboard.id;
}

// ============================================================================
// Helpers — sensor summary
// ============================================================================

/**
 * Recounts the sensors registered under a group and upserts the
 * `device_connectivity_summary` data record on the group device. The
 * Sensor Status cards on the Sensors dashboard read this record.
 *
 * The total is always recomputed from a fresh device list so concurrent
 * create/delete runs do not drift the counter. If the record does not
 * exist yet, it is created. If it exists, only `total_registered` is
 * refreshed; `online` and `offline` are preserved.
 */
async function updateSensorSummary(groupID: string): Promise<void> {
  const sensors: { id: string }[] = [];
  for (let page = 1; page < 9999; page++) {
    const batch = await Resources.devices.list({
      page,
      amount: 100,
      fields: ["id"],
      filter: {
        tags: [
          { key: "group_id", value: groupID },
          { key: "device_type", value: "device" },
        ],
      },
      resolveBucketName: false,
    });

    sensors.push(...batch);
    if (batch.length < 100) {
      break;
    }
  }

  const totalRegistered = sensors.length;

  const [existing] = await Resources.devices.getDeviceData(groupID, {
    variables: SUMMARY_VARIABLE,
    qty: 1,
  });

  if (existing) {
    await Resources.devices.editDeviceData(groupID, {
      ...existing,
      value: totalRegistered,
      metadata: {
        ...existing.metadata,
        total_registered: totalRegistered,
      },
    });
    return;
  }

  await Resources.devices.sendDeviceData(groupID, {
    variable: SUMMARY_VARIABLE,
    value: totalRegistered,
    metadata: {
      total_registered: totalRegistered,
      online: undefined,
      offline: undefined,
    },
  });
}

// ============================================================================
// CREATE flow
// ============================================================================

/**
 * Reads the form fields sent by the dashboard from the scope and runs
 * them through the Zod schema.
 */
function extractCreateFormFields(scope: Data[]) {
  const newSensorName = scope.find((item: Data) => item.variable === "new_sensor_name")?.value;
  const newSensorEui = scope.find((item: Data) => item.variable === "new_sensor_eui")?.value;
  const newSensorNetwork = scope.find((item: Data) => item.variable === "new_sensor_network")?.value;
  const newSensorConnector = scope.find((item: Data) => item.variable === "new_sensor_connector")?.value;

  return sensorModel.parseAsync({
    name: newSensorName,
    eui: newSensorEui,
    network: newSensorNetwork,
    connector: newSensorConnector,
  });
}

/**
 * Creates the sensor device on TagoIO. The device is created with the
 * parent-org, group, eui and type tags already attached. A second edit
 * adds the `sensor_id` tag pointing to its own id, since the id is only
 * known after creation.
 */
interface InstallSensorParams {
  name: string;
  eui: string;
  network: string;
  connector: string;
  organizationID: string;
  groupID: string;
}

async function installSensorDevice(params: InstallSensorParams): Promise<string> {
  const tags: TagsObj[] = [
    { key: "organization_id", value: params.organizationID },
    { key: "group_id", value: params.groupID },
    { key: "device_eui", value: params.eui },
    { key: "device_type", value: "device" },
    { key: "sensor_type", value: "freezer" },
  ];

  const deviceData: DeviceCreateInfo = {
    name: params.name,
    type: "immutable",
    chunk_period: "month",
    chunk_retention: 1,
    serie_number: params.eui,
    network: params.network,
    connector: params.connector,
    tags,
  };

  const newDevice = await Resources.devices.create(deviceData);

  const newTags = tags.concat({ key: "sensor_id", value: newDevice.device_id });
  await Resources.devices.edit(newDevice.device_id, { tags: newTags });

  return newDevice.device_id;
}

/**
 * Handles the "create-sensor" Input Form submission.
 *
 * Steps:
 *   1. Confirm the scope is a Data array sent by the form.
 *   2. Read the session id so validation messages reach the right user.
 *   3. Validate form fields with Zod; surface the first issue if any.
 *   4. Reject duplicate sensor names within the parent group.
 *   5. Reject duplicate EUIs across the whole application.
 *   6. Create the device, tag it, and store its params (URL + EUI).
 *   7. Refresh the group's `device_connectivity_summary` record.
 *   8. Send a success message back to the dashboard.
 */
async function createSensor({ environment, scope }: RouterConstructor & { scope: Data[] }) {
  if (!("variable" in scope[0])) {
    console.error("Not a valid TagoIO Data");
    return;
  }

  const configDevID = environment.config_id;
  if (!configDevID) {
    throw "[Error] Missing config_id environment variable.";
  }

  // The form is rendered on the per-group Sensors dashboard, so the
  // group id is the device id stored in `scope[0].device`.
  const groupID = scope[0].device;
  if (!groupID) {
    throw "[Error] Missing group ID in scope.";
  }

  const sessionID = z.string().parse(scope.find((item: Data) => item.variable === "create_sensor_session_id")?.value);
  const validate = initializeValidation({ validationVariable: "create_sensor_validation", deviceID: configDevID, sessionID });

  // Friendly "working on it" message now that validation passed.
  await validate("#VAL.ADDING_SENSOR_WAIT#", "warning").catch(console.log);

  // Validate the form. If Zod fails, surface the first issue to the user
  // and abort the run.
  const formFields = await extractCreateFormFields(scope)
    .catch(getZodErrorMessage)
    .catch(async (error: Error) => {
      await validate(error.message, "danger");
      throw error;
    });

  // Reject duplicate names inside the same group.
  const isNameInUse = await deviceExists({
    name: formFields.name,
    tags: [
      { key: "group_id", value: groupID },
      { key: "device_type", value: "device" },
    ],
  });

  if (isNameInUse) {
    throw await validate(
      `#VAL.A_SENSOR# #VAL.WITH_NAME# ${formFields.name} #VAL.ALREADY_EXISTS# #VAL.WITHIN_THIS_GROUP#`,
      "danger",
    );
  }

  // Reject duplicate EUIs anywhere in the application.
  const isEuiInUse = await deviceExists({
    tags: [{ key: "device_eui", value: formFields.eui }],
  });

  if (isEuiInUse) {
    throw await validate(`#VAL.A_SENSOR# #VAL.WITH_EUI# ${formFields.eui} #VAL.ALREADY_EXISTS#`, "danger");
  }

  // The organization id lives on the parent group device's tags. We
  // need it so the new sensor inherits the same tenant scope.
  const groupInfo = await Resources.devices.info(groupID);
  const organizationID = z.string().parse(groupInfo.tags.find((x) => x.key === "organization_id")?.value);

  const sensorID = await installSensorDevice({
    name: formFields.name,
    eui: formFields.eui,
    network: formFields.network,
    connector: formFields.connector,
    organizationID,
    groupID,
  });

  // Build the URL that opens the sensor detail dashboard and store it
  // (plus the EUI) as device params for the front-end.
  const dashboardID = await getDashboardIDByTag(SENSOR_DASHBOARD_TAG_KEY, SENSOR_DASHBOARD_TAG_VALUE);
  const dashboardURL = `/dashboards/info/${dashboardID}?settings=${configDevID}&sensor_dev=${sensorID}`;

  // The simulator supports two types of freezers, each sending different data values.
  // By default, it uses type 1, so we randomly assign a different type to ensure
  // data variation across the sensors.
  const freezerType = Math.random() < 0.5 ? "1" : "2";

  await Resources.devices.paramSet(sensorID, [
    { key: "dashboard_url", value: dashboardURL, sent: true },
    { key: "sensor_eui", value: formFields.eui, sent: true },
    { key: "freezer", value: freezerType, sent: true },
  ]);

  // Refresh the group's connectivity summary so the Sensor Status cards
  // reflect the new total.
  await updateSensorSummary(groupID);

  await validate("#VAL.SENSOR_SUCCESSFULLY_CREATED#", "success");
}

// ============================================================================
// EDIT flow
// ============================================================================

/**
 * Restores a sensor device to its previous state when an edit fails
 * validation. The Device List widget includes the previous values under
 * `scope[0].old`, so we use that snapshot to roll back the change.
 *
 * Sensor edits only touch the `name` field today, but the loop is kept
 * generic so future params can be added without rewriting the rollback.
 */
async function undoSensorChanges(sensorID: string, scope: DeviceListScope[]): Promise<void> {
  const deviceScope = scope[0];
  const oldValues = deviceScope?.old ?? {};

  for (const key of Object.keys(deviceScope)) {
    if (key === "name" && typeof oldValues[key] === "string") {
      await Resources.devices.edit(sensorID, { name: oldValues[key] as string });
      continue;
    }

    if (key.startsWith("param.")) {
      const paramKey = key.replace("param.", "");
      const oldValue = oldValues[key] as string | undefined;
      if (oldValue === undefined) {
        continue;
      }

      const paramList = await Resources.devices.paramList(sensorID);
      const existing = paramList.find((p) => p.key === paramKey);
      await Resources.devices.paramSet(sensorID, {
        id: existing?.id,
        key: paramKey,
        value: oldValue,
        sent: true,
      });
    }
  }
}

/**
 * Handles the "edit-sensor" Custom Button on the Device List widget.
 *
 * The Device List sends both the new and the old value for each edited
 * field. We validate the new values, and on any failure we restore the
 * old ones and notify the user.
 */
async function editSensor({ scope, environment }: RouterConstructor & { scope: DeviceListScope[] }) {
  const sensorID = scope[0].device;
  if (!sensorID) {
    throw "[Error] Missing sensor ID in scope.";
  }

  const newName = scope[0]?.name;

  // Validate the partial payload. If Zod rejects it, undo the change and
  // notify the user — then bubble the error up so the run is logged.
  await sensorEditModel
    .parseAsync({ name: newName })
    .catch(getZodErrorMessage)
    .catch(async (error: Error) => {
      await undoSensorChanges(sensorID, scope);
      await sendNotificationFeedback({ environment, message: error.message });
      throw error;
    });

  // If the name changed, make sure no other sensor inside this group is
  // using it. We read the parent group from the sensor's tags.
  if (newName) {
    const sensorInfo = await Resources.devices.info(sensorID);
    const groupID = z
      .string()
      .parse(sensorInfo.tags.find((tag) => tag.key === "group_id")?.value);

    const isNameInUse = await deviceExists({
      name: newName,
      tags: [
        { key: "group_id", value: groupID },
        { key: "device_type", value: "device" },
      ],
      isEdit: true,
    });

    if (isNameInUse) {
      await undoSensorChanges(sensorID, scope);
      await sendNotificationFeedback({
        environment,
        message: `#VAL.A_SENSOR# #VAL.WITH_NAME# ${newName} #VAL.ALREADY_EXISTS# #VAL.WITHIN_THIS_GROUP#`,
      });
      throw `#VAL.A_SENSOR# #VAL.WITH_NAME# ${newName} #VAL.ALREADY_EXISTS# #VAL.WITHIN_THIS_GROUP#`;
    }
  }
}

// ============================================================================
// DELETE flow
// ============================================================================

/**
 * Handles the "delete-sensor" identifier on the Device List widget.
 *
 * Steps:
 *   1. Clean any rows the dashboard wrote to the config device keyed
 *      to this sensor.
 *   2. Capture the sensor info (name, organization id, group id) before
 *      the device is removed.
 *   3. Delete the sensor device.
 *   4. Clean any rows keyed to this sensor on the parent organization
 *      and group devices. Without these the org and group dashboards
 *      keep showing the removed sensor's rows.
 *   5. Refresh the group's `device_connectivity_summary` record.
 *   6. Notify the user.
 */
async function deleteSensor({ scope, environment }: RouterConstructor & { scope: DeviceListScope[] }) {
  const configDevID = environment.config_id;
  if (!configDevID) {
    throw "[Error] Missing config_id environment variable.";
  }

  const sensorID = scope[0].device;
  if (!sensorID) {
    throw "[Error] Missing sensor ID in scope.";
  }

  await Resources.devices.deleteDeviceData(configDevID, { groups: sensorID, qty: 9999 }).catch(console.error);

  const sensorInfo = await Resources.devices.info(sensorID);
  const organizationID = z.string().parse(sensorInfo.tags.find((tag) => tag.key === "organization_id")?.value);
  const groupID = z.string().parse(sensorInfo.tags.find((tag) => tag.key === "group_id")?.value);

  await Resources.devices.delete(sensorID).catch(console.log);

  await Resources.devices.deleteDeviceData(organizationID, { groups: sensorID, qty: 9999 }).catch(console.log);
  await Resources.devices.deleteDeviceData(groupID, { groups: sensorID, qty: 9999 }).catch(console.log);

  await updateSensorSummary(groupID);

  await sendNotificationFeedback({
    environment,
    title: "#VAL.SENSOR_REMOVED_TITLE#",
    message: "#VAL.SENSOR_SUCCESSFULLY_REMOVED#",
  });
}

// ============================================================================
// Router entrypoint
// ============================================================================

/**
 * Entrypoint invoked by the TagoIO Analysis runtime. Reads the scope and
 * environment, sets up the router, and dispatches to the matching CRUD
 * handler.
 */
async function startAnalysis(context: TagoContext, scope: Data[]): Promise<void> {
  console.log("Running CRUD Sensor Analysis");
  console.log("Scope:", scope);

  const environment = Utils.envToJson(context.environment);
  if (!environment.config_id) {
    throw "Missing config_id environment variable";
  }

  const router = new Utils.AnalysisRouter({ scope, context, environment });

  router.register(createSensor).whenInputFormID("create-sensor");
  router.register(editSensor).whenCustomBtnID("edit-sensor");
  router.register(deleteSensor).whenDeviceListIdentifier("delete-sensor");

  const result = await router.exec();
  console.log("Services found:", result.services);
}

// The Analysis runtime sets `T_TEST` during local tests so the handler is
// not wired up automatically. In production the runtime sets
// `T_ANALYSIS_TOKEN` and calls `Analysis.use` below.
if (!Deno.env.get("T_TEST")) {
  Analysis.use(startAnalysis, { token: Deno.env.get("T_ANALYSIS_TOKEN") });
}

export { startAnalysis };
