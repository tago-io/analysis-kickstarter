/**
 * CRUD Group Analysis
 *
 * Educational single-file Analysis that handles the full lifecycle of a
 * Group resource in the TagoIO Kickstarter project: create, edit and
 * delete. This file is intentionally self-contained — it has no relative
 * imports.
 *
 * How it is triggered
 * -------------------
 * A dashboard sends Data points to this Analysis. The Analysis Router from
 * `@tago-io/sdk` inspects the scope and runs the matching handler:
 *
 *   - Input Form "create-group"          -> createGroup
 *   - Custom Button "edit-group"         -> editGroup
 *   - Device List action "delete-group"  -> deleteGroup
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
 * Custom HTTPS Storage Network ID. Used by configuration devices that only
 * hold data (organizations, groups) instead of receiving real uplinks.
 */
const STORAGE_NETWORK_ID = "62336c32ab6e0d0012e06c04";

/**
 * Database Connector ID paired with the storage network above.
 */
const DATABASE_CONNECTOR_ID = "62333bd36977fc001a2990c8";

/**
 * Tag key/value used to find the dashboard that manages the sensors of a
 * single group. The dashboard is matched by its `export_id` tag, which is
 * set when the dashboard template is imported into the account.
 */
const GROUP_DASHBOARD_TAG_KEY = "export_id";
const GROUP_DASHBOARD_TAG_VALUE = "sensor-management";

// ============================================================================
// Validation schema
// ============================================================================

/**
 * Address accepted as the already-normalized "lat,lng;label" string used by
 * the Device List widget on the Edit flow.
 */
const addressStringSchema = z
  .string()
  .min(3, { error: "#VAL.ADDRESS_MIN_3#" })
  .max(200, { error: "#VAL.ADDRESS_MAX_200#" });

/**
 * Address schema for the Create form. The dashboard sends the address as a
 * TagoIO location Data point ({ value, location: { coordinates: [lng, lat] } }).
 * We accept it as an object and transform it into the "lat,lng;label" string
 * that TagoIO widgets expect when reading back the value from device params.
 */
const addressLocationSchema = z
  .object({
    value: z
      .string()
      .min(3, { error: "#VAL.ADDRESS_MIN_3#" })
      .max(200, { error: "#VAL.ADDRESS_MAX_200#" })
      .optional(),
    location: z.object({
      coordinates: z
        .array(z.number(), { error: "#VAL.COORDINATES_REQUIRED#" })
        .length(2, { error: "#VAL.COORDINATES_INVALID#" }),
    }),
  })
  .optional()
  .transform(convertLocationToString);

const groupModel = z.object({
  name: z
    .string({ error: "#VAL.NAME_REQUIRED#" })
    .min(1, { error: "#VAL.NAME_MIN_1#" })
    .max(40, { error: "#VAL.NAME_MAX_40#" }),
  address: z.union([addressStringSchema, addressLocationSchema]).optional(),
});

/**
 * Partial schema reused by the Edit flow — every field becomes optional so
 * we only validate what the Device List widget actually sent.
 */
const groupEditModel = groupModel.partial();

// ============================================================================
// Helpers — formatting and error handling
// ============================================================================

/**
 * Converts a TagoIO location Data point into the "lat,lng;label" string
 * format. Returns an empty string if the input is missing or malformed.
 *
 * The TagoIO `coordinates` array is stored as `[longitude, latitude]`, so
 * we swap them when building the human-readable string.
 */
function convertLocationToString(data?: { value?: string; location?: { coordinates: number[] } }): string {
  if (!data?.location?.coordinates || data.location.coordinates.length !== 2) {
    return "";
  }

  const [lng, lat] = data.location.coordinates;
  const label = data.value ?? "";
  return `${lat},${lng};${label}`;
}

/**
 * Extracts a short, human-readable message from a Zod or generic error and
 * re-throws it as a plain `Error`. This keeps the validation feedback
 * concise — only the first Zod issue is surfaced to the user.
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

  // No user context — notify the developer via the Analysis token.
  if (!userID) {
    const services = new Services({ token: Deno.env.get("T_ANALYSIS_TOKEN") });
    await services.notification.send({ title: title || "#VAL.OPERATION_ERROR#", message });
    return;
  }

  // Confirm the user still exists before sending an in-app notification.
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

  // Paginate through the device list with a comfortable page size. The
  // Kickstarter is unlikely to hit the upper bound, but we keep the cap
  // explicit for safety.
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
 * Finds a Dashboard ID by a tag value. Used to compose the URL that opens
 * the per-group management dashboard right after creation.
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
// CREATE flow
// ============================================================================

/**
 * Reads the form fields sent by the dashboard from the scope and runs
 * them through the Zod schema. The schema also transforms the location
 * Data point into a "lat,lng;label" string.
 */
function extractCreateFormFields(scope: Data[]) {
  const newGroupName = scope.find((item: Data) => item.variable === "new_group_name")?.value;
  const newGroupAddress = scope.find((item: Data) => item.variable === "new_group_address");

  return groupModel.parseAsync({
    name: newGroupName,
    address: newGroupAddress,
  });
}

/**
 * Creates the group device on TagoIO and applies the identity tags
 * (`organization_id`, `group_id`, `device_type`). The device id is reused
 * as the group id throughout the application.
 *
 * The device is created with the parent-org and type tags, and then a
 * second edit adds the `group_id` tag pointing to its own id. This two
 * step approach is needed because the id is only known after creation.
 */
async function installGroupDevice(params: { name: string; organizationID: string }): Promise<string> {
  const tags: TagsObj[] = [
    { key: "organization_id", value: params.organizationID },
    { key: "device_type", value: "group" },
  ];

  const deviceData: DeviceCreateInfo = {
    name: params.name,
    type: "mutable",
    network: STORAGE_NETWORK_ID,
    connector: DATABASE_CONNECTOR_ID,
    tags,
  };

  const newDevice = await Resources.devices.create(deviceData);

  const newTags: TagsObj[] = tags.concat([
    { key: "group_id", value: newDevice.device_id },
  ]);

  await Resources.devices.edit(newDevice.device_id, { tags: newTags });

  return newDevice.device_id;
}

/**
 * Handles the "create-group" Input Form submission.
 *
 * Steps:
 *   1. Confirm the scope is a Data array sent by the form.
 *   2. Read the session id so validation messages reach the right user.
 *   3. Validate form fields with Zod; surface the first issue if any.
 *   4. Reject duplicate group names inside the parent organization.
 *   5. Create the device, tag it, and store its params (URL + address).
 *   6. Send a success message back to the dashboard.
 */
async function createGroup({ environment, scope }: RouterConstructor & { scope: Data[] }) {
  // The router can hand us non-Data scopes for other triggers, so we
  // double-check that the first element actually looks like Data.
  if (!("variable" in scope[0])) {
    console.error("Not a valid TagoIO Data");
    return;
  }

  const configDevID = environment.config_id;
  if (!configDevID) {
    throw "[Error] Missing config_id environment variable.";
  }

  // The form is rendered on the per-organization Groups dashboard, so the
  // organization id is the device id stored in `scope[0].device`.
  const organizationID = scope[0].device;
  if (!organizationID) {
    throw "[Error] Missing organization ID in scope.";
  }

  // The session id is generated by the dashboard form and lets the
  // Validation widget filter messages to the user who triggered the run.
  const sessionID = z.string().parse(scope.find((item: Data) => item.variable === "create_group_session_id")?.value);
  const validate = initializeValidation({ validationVariable: "create_group_validation", deviceID: configDevID, sessionID });

  // Friendly "working on it" message now that validation passed.
  await validate("#VAL.ADDING_GROUP_WAIT#", "warning").catch(console.log);

  // Validate the form. If Zod fails, surface the first issue to the user
  // and abort the run. The double `.catch` keeps the happy path readable.
  const formFields = await extractCreateFormFields(scope)
    .catch(getZodErrorMessage)
    .catch(async (error: Error) => {
      await validate(error.message, "danger");
      throw error;
    });

  // Reject duplicates within the same organization.
  const isNameInUse = await deviceExists({
    name: formFields.name,
    tags: [
      { key: "organization_id", value: organizationID },
      { key: "device_type", value: "group" },
    ],
  });

  if (isNameInUse) {
    throw await validate(
      `#VAL.A_GROUP# #VAL.WITH_NAME# ${formFields.name} #VAL.ALREADY_EXISTS# #VAL.WITHIN_THIS_ORGANIZATION#`,
      "danger",
    );
  }

  // Create the device and tag it as a group of the current organization.
  const groupID = await installGroupDevice({ name: formFields.name, organizationID });

  // Build the URL that opens the per-group sensors dashboard and store it
  // as a device param so the front-end can read it later.
  const dashboardID = await getDashboardIDByTag(GROUP_DASHBOARD_TAG_KEY, GROUP_DASHBOARD_TAG_VALUE);
  const dashboardURL = `/dashboards/info/${dashboardID}?settings=${configDevID}&group_dev=${groupID}`;

  await Resources.devices.paramSet(groupID, [
    { key: "dashboard_url", value: dashboardURL, sent: true },
    { key: "group_address", value: formFields.address, sent: true },
  ]);

  await validate("#VAL.GROUP_SUCCESSFULLY_CREATED#", "success");
}

// ============================================================================
// EDIT flow
// ============================================================================

/**
 * Restores a group device to its previous state when an edit fails
 * validation. The Device List widget includes the previous values under
 * `scope[0].old`, so we use that snapshot to roll back the change.
 *
 * Group edits only touch `name` and `param.group_address`, so we handle
 * both fields explicitly instead of using a generic resolver.
 */
async function undoGroupChanges(groupID: string, scope: DeviceListScope[]): Promise<void> {
  const deviceScope = scope[0];
  const oldValues = deviceScope?.old ?? {};

  for (const key of Object.keys(deviceScope)) {
    // Roll back the device name.
    if (key === "name" && typeof oldValues[key] === "string") {
      await Resources.devices.edit(groupID, { name: oldValues[key] as string });
      continue;
    }

    // Roll back any edited param. Only `group_address` is exposed on the
    // UI today, but we keep the branch generic in case more params are
    // added later.
    if (key.startsWith("param.")) {
      const paramKey = key.replace("param.", "");
      const oldValue = oldValues[key] as string | undefined;
      if (oldValue === undefined) {
        continue;
      }

      // Look up the existing param entry so we keep its id when updating.
      const paramList = await Resources.devices.paramList(groupID);
      const existing = paramList.find((p) => p.key === paramKey);
      await Resources.devices.paramSet(groupID, {
        id: existing?.id,
        key: paramKey,
        value: oldValue,
        sent: true,
      });
    }
  }
}

/**
 * Handles the "edit-group" Custom Button on the Device List widget.
 *
 * The Device List sends both the new and the old value for each edited
 * field. We validate the new values, and on any failure we restore the
 * old ones and notify the user.
 */
async function editGroup({ scope, environment }: RouterConstructor & { scope: DeviceListScope[] }) {
  const groupID = scope[0].device;
  if (!groupID) {
    throw "[Error] Missing group ID in scope.";
  }

  const newName = scope[0]?.name;
  const newAddress = scope[0]?.["param.group_address"] || undefined;

  // Validate the partial payload. If Zod rejects it, undo the change and
  // notify the user — then bubble the error up so the run is logged.
  await groupEditModel
    .parseAsync({ name: newName, address: newAddress })
    .catch(getZodErrorMessage)
    .catch(async (error: Error) => {
      await undoGroupChanges(groupID, scope);
      await sendNotificationFeedback({ environment, message: error.message });
      throw error;
    });

  // If the name changed, make sure no other group inside this organization
  // is using it. We read the parent organization from the group's tags.
  if (newName) {
    const groupInfo = await Resources.devices.info(groupID);
    const organizationID = z
      .string()
      .parse(groupInfo.tags.find((tag) => tag.key === "organization_id")?.value);

    const isNameInUse = await deviceExists({
      name: newName,
      tags: [
        { key: "organization_id", value: organizationID },
        { key: "device_type", value: "group" },
      ],
      isEdit: true,
    });

    if (isNameInUse) {
      await undoGroupChanges(groupID, scope);
      await sendNotificationFeedback({
        environment,
        message: `#VAL.A_GROUP# #VAL.WITH_NAME# ${newName} #VAL.ALREADY_EXISTS# #VAL.WITHIN_THIS_ORGANIZATION#`,
      });
      throw `#VAL.A_GROUP# #VAL.WITH_NAME# ${newName} #VAL.ALREADY_EXISTS# #VAL.WITHIN_THIS_ORGANIZATION#`;
    }
  }
}

// ============================================================================
// DELETE flow
// ============================================================================

/**
 * Deletes every device tagged with this group (sensors and any dummy
 * device that carries the `group_id` tag of this group, except the group
 * device itself, which has already been removed by the caller).
 */
async function deleteGroupDevices(groupID: string): Promise<void> {
  const devices = await Resources.devices.list({
    amount: 9999,
    page: 1,
    fields: ["id"],
    filter: { tags: [{ key: "group_id", value: groupID }] },
  });

  for (const device of devices) {
    await Resources.devices.delete(device.id).catch(console.log);
  }
}

/**
 * Handles the "delete-group" identifier on the Device List widget.
 *
 * Cascades:
 *   1. Wipe the group's data row in the config device.
 *   2. Capture the group's name before the device is gone.
 *   3. Delete the group device itself.
 *   4. Delete every sensor (and dummy device) that carried this group_id.
 *   5. Notify the user.
 */
async function deleteGroup({ scope, environment }: RouterConstructor & { scope: DeviceListScope[] }) {
  const configDevID = environment.config_id;
  if (!configDevID) {
    throw "[Error] Missing config_id environment variable.";
  }

  const groupID = scope[0].device;
  if (!groupID) {
    throw "[Error] Missing group ID in scope.";
  }

  // Remove the group's row from the config device storage.
  await Resources.devices.deleteDeviceData(configDevID, { groups: groupID, qty: 9999 });

  // Delete the group device itself first so the cascade below does not
  // need to filter it out.
  await Resources.devices.delete(groupID).catch(console.log);

  // Cascade into child resources (sensors and any dummy device sharing
  // the same `group_id` tag).
  await deleteGroupDevices(groupID);

  await sendNotificationFeedback({
    environment,
    title: "#VAL.GROUP_REMOVED_TITLE#",
    message: "#VAL.GROUP_SUCCESSFULLY_REMOVED#",
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
  console.log("Running CRUD Group Analysis");
  console.log("Scope:", scope);

  const environment = Utils.envToJson(context.environment);
  if (!environment.config_id) {
    throw "Missing config_id environment variable";
  }

  const router = new Utils.AnalysisRouter({ scope, context, environment });

  router.register(createGroup).whenInputFormID("create-group");
  router.register(editGroup).whenCustomBtnID("edit-group");
  router.register(deleteGroup).whenDeviceListIdentifier("delete-group");

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
