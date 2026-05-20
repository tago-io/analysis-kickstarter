/**
 * Uplink Handler Analysis
 *
 * Educational single-file Analysis that turns raw sensor uplinks into the
 * `cold_room_card_data` record consumed by the Cold Room dashboards.
 * This file is intentionally self-contained — it has no relative imports.
 *
 * What is an "uplink"?
 * --------------------
 * An "uplink" is one batch of data points a sensor pushes into TagoIO
 * (temperature, status, etc.). The platform stores it on the sensor device
 * and, if an Action is configured, also calls this Analysis with the same
 * data points in `scope`.
 *
 * How it is triggered
 * -------------------
 * By a TagoIO Action of type "Trigger by Variable" that:
 *   - Targets devices tagged `device_type=device` (the sensors).
 *   - Listens to the variables `temperature`, `compressor`, `door` and others.
 *   - Runs this Analysis when any of those variables is written.
 *
 * What it writes
 * --------------
 * For each uplink, the handler creates (or updates) one row of the variable
 * `cold_room_card_data` on TWO devices:
 *   - The parent group device, so the group-level Cold Room dashboard sees it.
 *   - The parent organization device, so the org-level Cold Room dashboard
 *     sees it too.
 * Each sensor owns one row on each device — the row is identified by the
 * data point's `group` field set to the sensor id.
 *
 * Required environment variables
 * ------------------------------
 *   - T_ANALYSIS_TOKEN : provided automatically by the TagoIO runtime.
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
 * Name of the variable written on the group and organization devices. The
 * Cold Room dashboards read this variable to render one card per sensor.
 */
const CARD_VARIABLE = "cold_room_card_data";

/**
 * Tag keys read from the sensor device. They tell us where the card record
 * should be written (group + organization).
 */
const TAG_DEVICE_TYPE = "device_type";
const TAG_GROUP_ID = "group_id";
const TAG_ORGANIZATION_ID = "organization_id";

/**
 * Tag value that marks a device as a sensor. Other device types (group,
 * organization, config) are skipped so this Analysis only reacts to real
 * sensor uplinks.
 */
const SENSOR_DEVICE_TYPE = "device";

/**
 * Names of the variables we expect inside the uplink. These are the
 * identifiers the decoder writes when it parses the sensor payload.
 */
const VAR_TEMPERATURE = "temperature";
const VAR_COMPRESSOR = "compressor";
const VAR_DOOR = "door";

// ============================================================================
// Validation schema
// ============================================================================

/**
 * Accepts a number or a numeric string and coerces it to a finite number.
 *
 * Decoders sometimes emit the temperature as a string (e.g. `"7.0"`) and
 * sometimes as a number (e.g. `7`). Normalising at this boundary keeps the
 * rest of the code simple — every caller can assume a real number.
 */
const numericLike = z.union([z.number(), z.string()]).transform((value, ctx) => {
  // Convert to number if it's a string; leave it alone if it's already a number.
  const parsed = typeof value === "number" ? value : Number(value);

  // Number(NaN), Infinity, and -Infinity are all invalid for our use case.
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: "custom", message: "not a finite number" });
    return z.NEVER;
  }

  return parsed;
});

/**
 * Shape of the cold-room card payload extracted from one uplink.
 *
 * Status fields are normalised (trim + lowercase) BEFORE checking against
 * the enum, so common decoder variants like "ON" or " Open " are accepted.
 * Without `.pipe`, `"ON"` would be rejected because the enum expects `"on"`.
 */
const cardPayloadModel = z.object({
  temperature_fahrenheit: numericLike,
  compressor_status: z.string().trim().toLowerCase().pipe(z.enum(["on", "off"], { error: "compressor must be on or off" })),
  door_status: z.string().trim().toLowerCase().pipe(z.enum(["open", "closed"], { error: "door must be open or closed" })),
});

// ============================================================================
// Types
// ============================================================================

/** Routing context extracted from the sensor's tags. */
interface SensorContext {
  sensorID: string;
  sensorName: string;
  groupID: string;
  groupName: string;
  organizationID: string;
}

/**
 * Shape of the metadata stored on the `cold_room_card_data` record.
 *
 * Every field here ends up readable by the dashboard widget. Adding a field
 * is how we expose new information to the UI without changing the widget's
 * data source — for example, `group_id` and `group_name` let the Cold Room
 * (Organization) widget cluster cards by their parent group.
 */
interface CardMetadata {
  sensor_name: string;
  group_name: string;
  temperature_fahrenheit: number;
  compressor_status: "on" | "off";
  door_status: "open" | "closed";
}

/** Parameters required to create or update a card record. */
interface UpsertCardParam {
  readonly targetDeviceID: string;
  readonly sensorID: string;
  readonly metadata: CardMetadata;
  readonly time: Date;
}

// ============================================================================
// Helpers — sensor routing
// ============================================================================

/**
 * Loads the sensor device and pulls out the tags we need to route the card.
 *
 * If the device is not a sensor, or is missing one of the required tags,
 * we treat it as a configuration issue (not a runtime bug) and return null.
 * The caller logs the reason and exits cleanly so the Action keeps working
 * for the other sensors that ARE configured correctly.
 */
async function loadSensorContext(sensorID: string): Promise<SensorContext | null> {
  const sensorInfo = await Resources.devices.info(sensorID);

  // Skip anything that is not tagged as a sensor (group/organization/config
  // devices share the same Run so they could in theory trigger the Action).
  const deviceType = sensorInfo.tags.find((tag) => tag.key === TAG_DEVICE_TYPE)?.value;
  if (deviceType !== SENSOR_DEVICE_TYPE) {
    console.log(`Device ${sensorID} is not a sensor (${TAG_DEVICE_TYPE}=${deviceType ?? "missing"}); skipping`);
    return null;
  }

  const groupID = sensorInfo.tags.find((tag) => tag.key === TAG_GROUP_ID)?.value;
  if (!groupID) {
    console.log(`Sensor ${sensorID} has no ${TAG_GROUP_ID} tag; skipping`);
    return null;
  }

  const organizationID = sensorInfo.tags.find((tag) => tag.key === TAG_ORGANIZATION_ID)?.value;
  if (!organizationID) {
    console.log(`Sensor ${sensorID} has no ${TAG_ORGANIZATION_ID} tag; skipping`);
    return null;
  }

  const groupInfo = await Resources.devices.info(groupID);

  return {
    sensorID,
    sensorName: sensorInfo.name,
    groupID,
    groupName: groupInfo.name,
    organizationID,
  };
}

// ============================================================================
// Helpers — payload parsing
// ============================================================================

/**
 * Reads the three expected variables from the uplink scope and runs them
 * through the Zod schema.
 *
 * All three values must arrive in the same uplink. If any is missing or
 * fails validation, the function returns null and the upsert is skipped:
 * a partial card would publish stale state for the missing fields.
 */
async function buildCardMetadata(scope: Data[], sensor: SensorContext): Promise<CardMetadata | null> {
  const temperatureValue = scope.find((item) => item.variable === VAR_TEMPERATURE)?.value;
  const compressorValue = scope.find((item) => item.variable === VAR_COMPRESSOR)?.value;
  const doorValue = scope.find((item) => item.variable === VAR_DOOR)?.value;

  const parsed = await cardPayloadModel.safeParseAsync({
    temperature_fahrenheit: temperatureValue,
    compressor_status: compressorValue,
    door_status: doorValue,
  });

  if (!parsed.success) {
    // `safeParseAsync` returns the issues instead of throwing, so we just
    // log the first one and skip — uplinks are not user-driven and we don't
    // want to crash the whole Action because of one malformed message.
    console.log(`Skipping card upsert: ${parsed.error.issues[0]?.message ?? "validation failed"}`);
    return null;
  }

  return { sensor_name: sensor.sensorName, group_name: sensor.groupName, ...parsed.data };
}

/**
 * Resolves the timestamp the card record should carry.
 *
 * We prefer the uplink's own timestamp so the widget's "x minutes ago"
 * label reflects when the sensor produced the reading, not when this
 * Analysis ran. If the scope entry has no time we fall back to `now`.
 */
function resolveCardTime(scope: Data[]): Date {
  const rawTime = scope[0]?.time;
  if (!rawTime) {
    return new Date();
  }
  return new Date(rawTime);
}

// ============================================================================
// Helpers — card upsert
// ============================================================================

/**
 * Creates or updates ONE cold-room card row on the target device.
 *
 * Each sensor owns exactly one row on each parent device. We discriminate
 * the rows by setting `group = sensorID` on the data point — TagoIO uses
 * the `group` field as a sub-record key, so editing the row with the same
 * `group` value updates that specific row instead of creating duplicates.
 *
 * On edit we set `time` explicitly. Spreading `existing` keeps the original
 * creation timestamp, which would prevent the widget's relative-time label
 * from ever advancing.
 */
async function upsertSensorCard({ targetDeviceID, sensorID, metadata, time }: UpsertCardParam): Promise<"created" | "updated"> {
  const [existing] = await Resources.devices.getDeviceData(targetDeviceID, {
    variables: CARD_VARIABLE,
    groups: sensorID,
    qty: 1,
  });

  if (existing) {
    await Resources.devices.editDeviceData(targetDeviceID, {
      ...existing,
      value: sensorID,
      group: sensorID,
      time,
      metadata: { ...existing.metadata, ...metadata },
    });
    return "updated";
  }

  await Resources.devices.sendDeviceData(targetDeviceID, {
    variable: CARD_VARIABLE,
    value: sensorID,
    group: sensorID,
    time,
    metadata,
  });
  return "created";
}

// ============================================================================
// Entrypoint
// ============================================================================

/**
 * Entrypoint invoked by the TagoIO Analysis runtime.
 *
 * Steps:
 *   1. Read the sensor id from the scope. Every uplink carries the device
 *      that produced it in `scope[0].device`.
 *   2. Load the sensor's routing context (group + organization). Skip when
 *      the device is not a sensor or has no routing tags.
 *   3. Build and validate the card metadata from the uplink. Skip when the
 *      payload is partial or invalid.
 *   4. Fan-out: write the card on both the group device and the
 *      organization device so dashboards at either level can render it.
 */
async function startAnalysis(context: TagoContext, scope: Data[]) {
  console.log("Running Uplink Handler");

  // `environment` is read so future versions can react to env flags
  // (e.g. a "dry run" mode). It is not used today.
  Utils.envToJson(context.environment);

  if (!scope || scope.length === 0) {
    console.log("No data in scope, skipping");
    return;
  }

  // Step 1 — identify which sensor produced this uplink.
  const sensorID = scope[0].device;
  console.log(`Uplink received: sensor=${sensorID} variables=[${scope.map((item) => item.variable).join(",")}]`);

  // Step 2 — load the sensor and check that it is routable.
  const sensor = await loadSensorContext(sensorID);
  if (!sensor) {
    return;
  }

  // Step 3 — extract the card payload from the uplink.
  const metadata = await buildCardMetadata(scope, sensor);
  if (!metadata) {
    return;
  }

  // Step 4 — fan-out: write the same card on the group AND the organization
  // device. Two writes are intentional: the dashboards at each level pull
  // data from the device that sits one hop above the sensor.
  const time = resolveCardTime(scope);

  const groupResult = await upsertSensorCard({ targetDeviceID: sensor.groupID, sensorID, metadata, time });
  console.log(`Card on group ${sensor.groupID}: ${groupResult}`);

  const orgResult = await upsertSensorCard({ targetDeviceID: sensor.organizationID, sensorID, metadata, time });
  console.log(`Card on organization ${sensor.organizationID}: ${orgResult}`);
}

// The Analysis runtime sets `T_TEST` during local tests so the handler is
// not wired up automatically. In production the runtime sets
// `T_ANALYSIS_TOKEN` and calls `Analysis.use` below.
if (!Deno.env.get("T_TEST")) {
  Analysis.use(startAnalysis, { token: Deno.env.get("T_ANALYSIS_TOKEN") });
}

export { startAnalysis };
