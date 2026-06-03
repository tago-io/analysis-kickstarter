/**
 * CRUD Organization Analysis
 *
 * Educational single-file Analysis that handles the full lifecycle of an
 * Organization resource in the TagoIO Kickstarter project: create, edit and
 * delete. This file is intentionally self-contained — it has no relative
 * imports.
 *
 * How it is triggered
 * -------------------
 * A dashboard sends Data points to this Analysis. The Analysis Router from
 * `@tago-io/sdk` inspects the scope and runs the matching handler:
 *
 *   - Input Form "create-org"          -> createOrganization
 *   - Custom Button "edit-org"         -> editOrganization
 *   - Device List action "delete-org"  -> deleteOrganization
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

import { Analysis, type Data, type DataToSend, type DeviceCreateInfo, type DeviceListScope } from "npm:@tago-io/sdk";
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
 * Tag key/value used to find the dashboard that manages a single
 * organization. The dashboard is matched by its `export_id` tag, which is
 * set when the dashboard template is imported into the account.
 */
const ORG_DASHBOARD_TAG_KEY = "export_id";

// ============================================================================
// Validation schema
// ============================================================================

/**
 * Address accepted as the already-normalized "lat,lng;label" string used by
 * the Device List widget on the Edit flow. The Create flow does not reach
 * this branch because it sends a TagoIO location Data point, which is
 * handled by `addressLocationSchema` below.
 */
const addressStringSchema = z
  .string()
  .min(3, { error: "Address must be at least 3 characters" })
  .max(200, { error: "Address must be less than 200 characters" });

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
      .min(3, { error: "Address must be at least 3 characters" })
      .max(200, { error: "Address must be less than 200 characters" })
      .optional(),
    location: z.object({
      coordinates: z
        .array(z.number(), { error: "Address Coordinates are required." })
        .length(2, { error: "Invalid coordinates" }),
    }),
  })
  .optional()
  .transform(convertLocationToString);

const orgModel = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(1, { error: "Name must be at least 1 character" })
    .max(40, { error: "Name must be less than 40 characters" }),
  address: z.union([addressStringSchema, addressLocationSchema]).optional(),
});

/**
 * Partial schema reused by the Edit flow — every field becomes optional so
 * we only validate what the Device List widget actually sent.
 */
const orgEditModel = orgModel.partial();

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
 * the per-organization management dashboard right after creation.
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
  const newOrgName = scope.find((item: Data) => item.variable === "new_organization_name")?.value;
  const newOrgAddress = scope.find((item: Data) => item.variable === "new_organization_address");

  return orgModel.parseAsync({
    name: newOrgName,
    address: newOrgAddress,
  });
}

/**
 * Creates the organization device on TagoIO and applies the identity tags
 * (`organization_id`, `device_type`). The device id is reused as the organization
 * id throughout the application.
 */
async function installOrganizationDevice(name: string): Promise<string> {
  const tags: TagsObj[] = [
    { key: "device_type", value: "organization" },
  ];

  const deviceData: DeviceCreateInfo = {
    name,
    type: "mutable",
    network: STORAGE_NETWORK_ID,
    connector: DATABASE_CONNECTOR_ID,
    tags,
  };

  const newDevice = await Resources.devices.create(deviceData);

  const newTags: TagsObj[] = tags.concat([
    { key: "organization_id", value: newDevice.device_id },
  ]);

  await Resources.devices.edit(newDevice.device_id, { tags: newTags });

  return newDevice.device_id;
}

/**
 * Handles the "create-org" Input Form submission.
 *
 * Steps:
 *   1. Confirm the scope is a Data array sent by the form.
 *   2. Read the session id so validation messages reach the right user.
 *   3. Validate form fields with Zod; surface the first issue if any.
 *   4. Reject duplicate organization names.
 *   5. Create the device, tag it, and store its params (URL + address).
 *   6. Send a success message back to the dashboard.
 */
async function createOrganization({ environment, scope }: RouterConstructor & { scope: Data[] }) {
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

  // The session id is generated by the dashboard form and lets the
  // Validation widget filter messages to the user who triggered the run.
  const sessionID = z.string().parse(scope.find((item: Data) => item.variable === "create_organization_session_id")?.value);
  const validate = initializeValidation({ validationVariable: "create_organization_validation", deviceID: configDevID, sessionID });

  // Friendly "working on it" message while we hit the TagoIO API.
  await validate("#VAL.ADDING_ORGANIZATION_WAIT#", "warning").catch(console.log);

  // Validate the form. If Zod fails, surface the first issue to the user
  // and abort the run. The double `.catch` keeps the happy path readable.
  const formFields = await extractCreateFormFields(scope)
    .catch(getZodErrorMessage)
    .catch(async (error: Error) => {
      await validate(error.message, "danger");
      throw error;
    });

  // Reject duplicates before creating any device.
  const isNameInUse = await deviceExists({
    name: formFields.name,
    tags: [{ key: "device_type", value: "organization" }],
  });

  if (isNameInUse) {
    throw await validate(`#VAL.AN_ORGANIZATION# #VAL.WITH_NAME# ${formFields.name} #VAL.ALREADY_EXISTS#`, "danger");
  }

  // Create the device and tag it as an organization.
  const organizationID = await installOrganizationDevice(formFields.name);

  // Build the URL that opens the per-organization dashboard and store it
  // as a device param so the front-end can read it later.
  const dashboardID = await getDashboardIDByTag(ORG_DASHBOARD_TAG_KEY, "group-management");
  const dashboardURL = `/dashboards/info/${dashboardID}?settings=${configDevID}&org_dev=${organizationID}`;

  await Resources.devices.paramSet(organizationID, [
    { key: "dashboard_url", value: dashboardURL, sent: true },
    { key: "organization_address", value: formFields.address, sent: true },
  ]);

  const location = scope.find((x) => x.variable === "new_organization_address")?.location;
  const organizationAddressData: DataToSend = {
    variable: "organization_address",
    metadata: { label: formFields.name, url: dashboardURL, color: "#B0B0B0" },
    location: location,
    group: organizationID,
  };
  await Resources.devices.sendDeviceData(configDevID, organizationAddressData);

  return validate("#VAL.ORGANIZATION_SUCCESSFULLY_CREATED#", "success");
}

// ============================================================================
// EDIT flow
// ============================================================================

/**
 * Restores an organization device to its previous state when an edit
 * fails validation. The Device List widget includes the previous values
 * under `scope[0].old`, so we use that snapshot to roll back the change.
 *
 * Organization edits only touch `name` and `param.organization_address`,
 * so we handle both fields explicitly instead of using a generic resolver.
 */
async function undoOrganizationChanges(organizationID: string, scope: DeviceListScope[]): Promise<void> {
  const deviceScope = scope[0];
  const oldValues = deviceScope?.old ?? {};

  for (const key of Object.keys(deviceScope)) {
    // Roll back the device name.
    if (key === "name" && typeof oldValues[key] === "string") {
      await Resources.devices.edit(organizationID, { name: oldValues[key] as string });
      continue;
    }

    // Roll back any edited param. Only `organization_address` is exposed
    // on the UI today, but we keep the branch generic in case more params
    // are added later.
    if (key.startsWith("param.")) {
      const paramKey = key.replace("param.", "");
      const oldValue = oldValues[key] as string | undefined;
      if (oldValue === undefined) {
        continue;
      }

      // Look up the existing param entry so we keep its id when updating.
      const paramList = await Resources.devices.paramList(organizationID);
      const existing = paramList.find((p) => p.key === paramKey);
      await Resources.devices.paramSet(organizationID, {
        id: existing?.id,
        key: paramKey,
        value: oldValue,
        sent: true,
      });
    }
  }
}

/**
 * Handles the "edit-org" Custom Button on the Device List widget.
 *
 * The Device List sends both the new and the old value for each edited
 * field. We validate the new values, and on any failure we restore the
 * old ones and notify the user.
 */
async function editOrganization({ scope, environment }: RouterConstructor & { scope: DeviceListScope[] }) {
  const organizationID = scope[0].device;
  if (!organizationID) {
    throw "[Error] Missing organization ID in scope.";
  }

  const configDevID = environment.config_id;
  if (!configDevID) {
    throw "[Error] Missing config_id environment variable.";
  }

  const newName = scope[0]?.name;
  const newAddress = scope[0]?.["param.organization_address"] || undefined;

  // Validate the partial payload. If Zod rejects it, undo the change and
  // notify the user — then bubble the error up so the run is logged.
  await orgEditModel
    .parseAsync({ name: newName, address: newAddress })
    .catch(getZodErrorMessage)
    .catch(async (error: Error) => {
      await undoOrganizationChanges(organizationID, scope);
      await sendNotificationFeedback({ environment, message: error.message });
      throw error;
    });

  // If the name changed, make sure no other organization is using it.
  if (newName) {
    const isNameInUse = await deviceExists({
      name: newName,
      tags: [{ key: "device_type", value: "organization" }],
      isEdit: true,
    });

    if (isNameInUse) {
      await undoOrganizationChanges(organizationID, scope);
      await sendNotificationFeedback({
        environment,
        message: `#VAL.AN_ORGANIZATION# #VAL.WITH_NAME# ${newName} #VAL.ALREADY_EXISTS#`,
      });
      throw `#VAL.AN_ORGANIZATION# #VAL.WITH_NAME# ${newName} #VAL.ALREADY_EXISTS#`;
    }
  }

  // Keep the `organization_address` row on the config device in sync with
  // the edited values. This is what powers the Organization List and the
  // Map View on the Organizations dashboard.
  const [orgAddressData] = await Resources.devices.getDeviceData(configDevID, {
    variables: "organization_address",
    groups: organizationID,
    qty: 1,
  });

  if (orgAddressData) {
    const [locationValue] = (newAddress ?? "").split(";");
    const [latString, lngString] = locationValue.split(",");

    await Resources.devices.editDeviceData(configDevID, {
      ...orgAddressData,
      metadata: {
        ...orgAddressData.metadata,
        label: newName || orgAddressData.metadata?.label,
      },
      location: { lat: Number(latString), lng: Number(lngString) },
    });
  }
}

// ============================================================================
// DELETE flow
// ============================================================================

/**
 * Deletes every Run User tagged with this organization.
 */
async function deleteOrganizationUsers(organizationID: string): Promise<void> {
  // Paginate through every user tagged with this organization id.
  const users: { id: string }[] = [];
  for (let page = 1; page < 9999; page++) {
    const batch = await Resources.run.listUsers({
      page,
      amount: 40,
      fields: ["id"],
      filter: { tags: [{ key: "organization_id", value: organizationID }] },
    });

    users.push(...batch);
    if (batch.length < 40) {
      break;
    }
  }

  for (const user of users) {
    await Resources.run.userDelete(user.id).catch(console.log);
  }
}

/**
 * Deletes every device that belongs to the organization (groups, sensors,
 * dummy devices, etc.). The organization device itself is removed by the
 * caller after this function returns.
 */
async function deleteOrganizationDevices(organizationID: string): Promise<void> {
  const devices = await Resources.devices.list({
    amount: 9999,
    page: 1,
    fields: ["id"],
    filter: { tags: [{ key: "organization_id", value: organizationID }] },
  });

  for (const device of devices) {
    await Resources.devices.delete(device.id).catch(console.log);
  }
}

/**
 * Handles the "delete-org" identifier on the Device List widget.
 *
 * Cascades:
 *   1. Wipe the organization's data row in the config device.
 *   2. Delete all related Run Users.
 *   3. Delete all related devices (groups, sensors, ...).
 *   4. Delete the organization device itself.
 *   5. Notify the user.
 */
async function deleteOrganization({ scope, environment }: RouterConstructor & { scope: DeviceListScope[] }) {
  const configDevID = environment.config_id;
  if (!configDevID) {
    throw "[Error] Missing config_id environment variable.";
  }

  const organizationID = scope[0].device;
  if (!organizationID) {
    throw "[Error] Missing organization ID in scope.";
  }

  // Remove the organization's row from the config device storage.
  await Resources.devices.deleteDeviceData(configDevID, { groups: organizationID, qty: 9999 });

  // Delete the organization device itself.
  await Resources.devices.delete(organizationID).catch(console.log);

  // Cascade into child resources.
  await deleteOrganizationUsers(organizationID);
  await deleteOrganizationDevices(organizationID);

  await sendNotificationFeedback({
    environment,
    title: "#VAL.ORGANIZATION_REMOVED_TITLE#",
    message: "#VAL.ORGANIZATION_SUCCESSFULLY_REMOVED#",
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
  console.log("Running CRUD Organization Analysis");
  console.log("Scope:", scope);

  const environment = Utils.envToJson(context.environment);
  if (!environment.config_id) {
    throw "Missing config_id environment variable";
  }

  const router = new Utils.AnalysisRouter({ scope, context, environment });

  router.register(createOrganization).whenInputFormID("create-organization");
  router.register(editOrganization).whenCustomBtnID("edit-organization");
  router.register(deleteOrganization).whenDeviceListIdentifier("delete-organization");

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
