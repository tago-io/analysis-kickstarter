/**
 * Check Inactive Sensors Analysis
 *
 * Educational single-file Analysis that scans every sensor in the
 * application, marks the ones that have not reported within the configured
 * threshold as offline, and refreshes the connectivity summary used by the
 * Sensors dashboard. This file is intentionally self-contained — it has no
 * relative imports.
 *
 * How it is triggered
 * -------------------
 * By a TagoIO Scheduled Action (cron). The recommended cadence is hourly:
 * the inactivity threshold itself is configured in hours, so running more
 * often just creates extra load without changing the outcome.
 *
 * Execution model
 * ---------------
 * The hot path is "no sensor changed state". We exploit that by short-
 * circuiting: after fetching the sensor list we ask whether any sensor is
 * even capable of producing a notification or recovery transition this
 * run. The cheapest sufficient condition is "(sensor's last_input is older
 * than one hour) OR (sensor already carries the inactivity_notified tag)"
 * — because the smallest configurable threshold is one hour, and recovery
 * only matters when the notified tag is present. When no sensor matches
 * that, we skip loading the global config AND the per-org Checkin rules
 * entirely and only refresh `last_uplink` plus the connectivity summary.
 *
 * Per-organization Checkin rules are now loaded lazily and cached per
 * organization id during a single execution. An organization without any
 * Checkin rule is cached as an empty array so we never re-query it.
 *
 * What it reads
 * -------------
 * From the configuration device (`environment.config_id`), under the
 * `global-inactivity` group — used as a fallback when no per-organization
 * Checkin rule applies:
 *   - `global_alert_value` (number, e.g. `2`) — how many units of time
 *     without uplink mean "inactive".
 *   - `global_alert_value` `unit` field — must be `"hour"` today.
 *   - `global_alert_message` (string) — text used in the in-app
 *     notification sent to organization users. Optional; falls back to
 *     the dictionary key `#VAL.DEVICE_INACTIVITY_DETECTED#`.
 *
 * From each organization device (tag `device_type=organization`) WHEN
 * one of its sensors is a candidate this run:
 *   - The Checkin alert rows persisted by `crud-alert.ts`. Each rule
 *     overrides the global threshold and recipients for the sensors it
 *     covers (or for every sensor in the org when `all_sensors` was
 *     selected at creation time).
 *
 * What it writes
 * --------------
 *   - On every sensor: the `last_uplink` device parameter, set to the
 *     integer number of hours since the last uplink. The Sensor List
 *     widget reads this to render the `Last seen(h)` column.
 *   - On every group device that owns at least one sensor: the
 *     `device_connectivity_summary` row, with `online` and `offline`
 *     counts inside `metadata`. `total_registered` is owned by the
 *     sensor CRUD analysis and preserved on edit.
 *   - On the sensors that just went inactive: the tag
 *     `inactivity_notified=true`. This is what stops the next run from
 *     re-notifying the same sensor every hour.
 *   - To the users tagged with the sensor's `organization_id`: an in-app
 *     notification announcing the inactivity.
 *
 * Required environment variables
 * ------------------------------
 *   - config_id          : ID of the configuration device that stores the
 *                          inactivity threshold and alert message.
 *   - T_ANALYSIS_TOKEN   : provided automatically by the TagoIO runtime.
 */

import { Analysis, type Data, type DeviceListItem, type DeviceQuery, Resources, type TagoContext, type TagsObj, type UserInfo, type UserQuery, Utils } from "npm:@tago-io/sdk";
import z from "npm:zod";

// ============================================================================
// Constants
// ============================================================================

const CONFIG_GROUP = "global-inactivity";
const SUMMARY_VARIABLE = "device_connectivity_summary";
const NOTIFIED_TAG = "inactivity_notified";
const LAST_UPLINK_PARAM = "last_uplink";
const DEFAULT_ALERT_MESSAGE = "#VAL.DEVICE_INACTIVITY_DETECTED#";
const NOTIFICATION_TITLE = "#VAL.DEVICE_INACTIVITY_TITLE#";

const ALERT_VAR_MODEL = "alert_management_type";
const ALERT_VAR_DEVICES = "alert_management_devices";
const ALERT_VAR_VALUE = "alert_management_value";
const ALERT_VAR_SEND_TO = "alert_management_users";
const ALERT_VAR_MESSAGE = "alert_management_message";

const CONFIG_VAR_VALUE = "global_alert_value";
const CONFIG_VAR_MESSAGE = "global_alert_message";

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Only `hour` is supported today. To accept more units (minute, day, ...)
 * extend BOTH this map AND the `unit` enum inside `thresholdModel` below.
 */
const UNIT_MS: Record<string, number> = {
  hour: 60 * 60 * 1000,
};

// ============================================================================
// Validation schema
// ============================================================================

const thresholdModel = z.object({
  value: z.union([z.number(), z.string()]).transform((rawValue, ctx) => {
    const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      ctx.addIssue({ code: "custom", message: "global_alert_value must be a positive number" });
      return z.NEVER;
    }
    return parsed;
  }),
  unit: z.string().trim().toLowerCase().pipe(z.enum(["hour"], { error: "unit must be 'hour'" })),
});

// ============================================================================
// Types
// ============================================================================

interface InactivityConfig {
  thresholdMs: number;
  alertMessage: string;
}

interface SensorBucket {
  online: number;
  offline: number;
}

type SensorRecord = Pick<DeviceListItem, "id" | "name" | "tags" | "last_input" | "created_at">;
type UserRecord = Pick<UserInfo, "id" | "name" | "phone" | "company" | "tags" | "active" | "email" | "timezone">;

interface OrgCheckinRule {
  organizationID: string;
  thresholdMs: number;
  sensorIDs: Set<string> | "all";
  recipientIDs: string[];
  message: string;
}

interface NewlyInactive {
  sensor: SensorRecord;
  rule: OrgCheckinRule | null;
}

// Lazy per-organization cache built during a single execution. An empty
// array means "already checked, no Checkin rules" — that's what stops us
// from re-querying the same org twice. Use `cache.has(orgID)` to tell
// "not yet queried" from "queried and empty".
type RuleCache = Map<string, OrgCheckinRule[]>;

// ============================================================================
// Helpers — paginated list fetchers
// ============================================================================

async function fetchDeviceList(filter: DeviceQuery["filter"]): Promise<SensorRecord[]> {
  const FIELDS: (keyof DeviceListItem)[] = ["id", "name", "tags", "last_input", "created_at"];
  const PAGE_SIZE = 100;
  const MAX_PAGES = 9999;

  const devices: SensorRecord[] = [];

  for (let page = 1; page < MAX_PAGES; page++) {
    const batch = await Resources.devices.list({
      page,
      fields: FIELDS,
      filter,
      resolveBucketName: false,
      amount: PAGE_SIZE,
    });

    devices.push(...(batch as SensorRecord[]));

    if (batch.length < PAGE_SIZE) {
      break;
    }
  }

  return devices;
}

async function fetchUserList(filter: UserQuery["filter"]): Promise<UserRecord[]> {
  const FIELDS: (keyof UserInfo)[] = ["id", "name", "phone", "company", "tags", "active", "email", "timezone"];
  const PAGE_SIZE = 40;
  const MAX_PAGES = 9999;

  const users: UserRecord[] = [];

  for (let page = 1; page < MAX_PAGES; page++) {
    const batch = await Resources.run.listUsers({
      page,
      fields: FIELDS,
      filter,
      amount: PAGE_SIZE,
    });

    users.push(...(batch as UserRecord[]));

    if (batch.length < PAGE_SIZE) {
      break;
    }
  }

  return users;
}

// ============================================================================
// Helpers — config loading
// ============================================================================

/**
 * Reads the inactivity threshold and alert message from the config device
 * in a single getDeviceData call (variables accepts an array).
 */
async function loadInactivityConfig(configDevID: string): Promise<InactivityConfig | null> {
  // `qty` on getDeviceData is per-variable, so qty:1 returns at most one
  // record per requested variable.
  const records = await Resources.devices.getDeviceData(configDevID, {
    variables: [CONFIG_VAR_VALUE, CONFIG_VAR_MESSAGE],
    groups: CONFIG_GROUP,
    qty: 1,
  });

  const valueRecord = records.find((record) => record.variable === CONFIG_VAR_VALUE);
  if (!valueRecord) {
    console.log("No global_alert_value found in config, skipping");
    return null;
  }

  const parsed = await thresholdModel.safeParseAsync({
    value: valueRecord.value,
    unit: valueRecord.unit,
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Validation error";
    console.log(`Invalid global_alert_value/unit: ${firstIssue}`);
    return null;
  }

  const messageRecord = records.find((record) => record.variable === CONFIG_VAR_MESSAGE);

  return {
    thresholdMs: parsed.data.value * UNIT_MS[parsed.data.unit],
    alertMessage: String(messageRecord?.value ?? DEFAULT_ALERT_MESSAGE),
  };
}

// ============================================================================
// Helpers — per-organization Checkin alerts (lazy + cached)
// ============================================================================

/**
 * Returns the Checkin rules for a single organization, using `cache` to
 * avoid re-fetching the same org twice during one execution. When the org
 * has no Checkin rules we still store an empty array so the next caller
 * short-circuits without hitting the API.
 */
async function getRulesForOrganization(organizationID: string, cache: RuleCache): Promise<OrgCheckinRule[]> {
  const cached = cache.get(organizationID);
  if (cached !== undefined) {
    return cached;
  }

  const rules: OrgCheckinRule[] = [];

  const modelRecords = await Resources.devices.getDeviceData(organizationID, {
    variables: ALERT_VAR_MODEL,
    qty: 9999,
  });
  const checkinModelRecords = modelRecords.filter((record) => record.value === "inactivity");

  for (const modelRecord of checkinModelRecords) {
    const alertID = modelRecord.group;
    if (!alertID) {
      continue;
    }

    // Fetch all four alert fields in a single getDeviceData call by
    // passing the variables array. Records come back unordered, so we
    // pick them up by `record.variable`.
    const alertRecords = await Resources.devices
      .getDeviceData(organizationID, {
        variables: [ALERT_VAR_DEVICES, ALERT_VAR_VALUE, ALERT_VAR_SEND_TO, ALERT_VAR_MESSAGE],
        groups: alertID,
        qty: 1,
      })
      .catch(() => []);

    const devicesRecord = alertRecords.find((record) => record.variable === ALERT_VAR_DEVICES);
    const valueRecord = alertRecords.find((record) => record.variable === ALERT_VAR_VALUE);
    const recipientsRecord = alertRecords.find((record) => record.variable === ALERT_VAR_SEND_TO);
    const messageRecord = alertRecords.find((record) => record.variable === ALERT_VAR_MESSAGE);

    const inactivityHours = Number(valueRecord?.value);
    if (!Number.isFinite(inactivityHours) || inactivityHours <= 0) {
      console.log(`Alert ${alertID} on org ${organizationID} has invalid inactivity hours; skipping`);
      continue;
    }

    const rawDevices = String(devicesRecord?.value ?? "").trim();
    const sensorIDs: Set<string> | "all" = rawDevices === "all_sensors" ? "all" : new Set(
      rawDevices
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    );

    const recipientIDs = String(recipientsRecord?.value ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (recipientIDs.length === 0) {
      console.log(`Alert ${alertID} on org ${organizationID} has no recipients; skipping`);
      continue;
    }

    rules.push({
      organizationID,
      thresholdMs: inactivityHours * MS_PER_HOUR,
      sensorIDs,
      recipientIDs,
      message: String(messageRecord?.value ?? DEFAULT_ALERT_MESSAGE),
    });
  }

  cache.set(organizationID, rules);
  return rules;
}

/**
 * Picks the first per-organization Checkin rule that applies to the given
 * sensor. Multiple Checkin alerts targeting the same sensor in the same
 * org is not a supported workflow today.
 */
function findRuleForSensor(rules: OrgCheckinRule[], sensorID: string): OrgCheckinRule | null {
  for (const rule of rules) {
    if (rule.sensorIDs === "all" || rule.sensorIDs.has(sensorID)) {
      return rule;
    }
  }
  return null;
}

// ============================================================================
// Helpers — classification
// ============================================================================

function isSensorInactive(sensor: SensorRecord, now: number, thresholdMs: number): boolean {
  if (!sensor.last_input) {
    return false;
  }
  return now - new Date(sensor.last_input).getTime() > thresholdMs;
}

function wasAlreadyNotified(sensor: SensorRecord): boolean {
  return sensor.tags.some((tag) => tag.key === NOTIFIED_TAG && tag.value === "true");
}

/**
 * Returns true if any sensor in the list could possibly change state this
 * run: either it has been silent for more than the minimum threshold (1h),
 * or it is already flagged as notified and therefore eligible for recovery.
 * When this returns false we skip loading the global config and the
 * per-org rules entirely.
 */
function hasAlertCandidates(sensors: SensorRecord[], now: number): boolean {
  for (const sensor of sensors) {
    if (wasAlreadyNotified(sensor)) {
      return true;
    }
    if (sensor.last_input && now - new Date(sensor.last_input).getTime() > MS_PER_HOUR) {
      return true;
    }
  }
  return false;
}

async function syncLastUplinkHours(sensorID: string, sensorLastInput: Date, now: number) {
  const hours = Math.floor((now - new Date(sensorLastInput).getTime()) / MS_PER_HOUR);
  const nextValue = String(hours);

  const params = await Resources.devices.paramList(sensorID);
  const existing = params.find((param) => param.key === LAST_UPLINK_PARAM);
  if (existing?.value === nextValue) {
    return;
  }

  await Resources.devices.paramSet(sensorID, {
    id: existing?.id,
    key: LAST_UPLINK_PARAM,
    value: nextValue,
    sent: true,
  });
}

// ============================================================================
// Helpers — summary upsert
// ============================================================================

async function upsertGroupSummary(groupID: string, counts: SensorBucket) {
  const [existing] = await Resources.devices.getDeviceData(groupID, {
    variables: SUMMARY_VARIABLE,
    qty: 1,
  });

  if (existing) {
    await Resources.devices.editDeviceData(groupID, {
      ...existing,
      metadata: {
        ...existing.metadata,
        online: counts.online,
        offline: counts.offline,
      },
    });
    return;
  }

  const total = counts.online + counts.offline;
  await Resources.devices.sendDeviceData(groupID, {
    variable: SUMMARY_VARIABLE,
    value: total,
    metadata: {
      total_registered: total,
      online: counts.online,
      offline: counts.offline,
    },
  });
}

// ============================================================================
// Helpers — notifications & state transitions
// ============================================================================

async function notifyOrganizationUsers(organizationID: string, message: string) {
  const users = await fetchUserList({ tags: [{ key: "organization_id", value: organizationID }] });
  for (const user of users) {
    await Resources.run.notificationCreate(user.id, {
      title: NOTIFICATION_TITLE,
      message,
    });
  }
}

async function notifyUsers(userIDs: string[], message: string) {
  for (const userID of userIDs) {
    await Resources.run.notificationCreate(userID, {
      title: NOTIFICATION_TITLE,
      message,
    }).catch((error) => {
      console.error(`Failed to notify ${userID}: ${(error as Error).message ?? error}`);
    });
  }
}

/**
 * `Resources.devices.edit({ tags })` REPLACES the full tag array, so
 * callers must always send every tag they want to keep.
 */
function setOrReplaceTag(tags: TagsObj[], key: string, value: string): TagsObj[] {
  const otherTags = tags.filter((tag) => tag.key !== key);
  return [...otherTags, { key, value }];
}

async function handleNewlyInactive(entry: NewlyInactive, globalAlertMessage: string) {
  const { sensor, rule } = entry;
  const organizationID = sensor.tags.find((tag) => tag.key === "organization_id")?.value;

  if (rule) {
    await notifyUsers(rule.recipientIDs, rule.message);
  } else if (organizationID) {
    await notifyOrganizationUsers(organizationID, globalAlertMessage);
  }

  await Resources.devices.edit(sensor.id, {
    tags: setOrReplaceTag(sensor.tags, NOTIFIED_TAG, "true"),
  });
  console.log(`Sensor ${sensor.id} marked inactive and notified (${rule ? "per-org rule" : "global"})`);
}

async function handleRecovered(sensor: SensorRecord) {
  await Resources.devices.edit(sensor.id, {
    tags: sensor.tags.filter((tag) => tag.key !== NOTIFIED_TAG),
  });
  console.log(`Sensor ${sensor.id} recovered, tag cleared`);
}

// ============================================================================
// Sensor processing
// ============================================================================

/**
 * Walks every sensor, refreshes its `last_uplink` parameter, increments
 * the per-group online/offline bucket, and (when `fullFlow` is true)
 * collects state transitions to notify or recover.
 *
 * `fullFlow=false` runs the short-circuit path: we know up front that no
 * sensor can be inactive (every last_input is within the last hour and no
 * sensor carries the notified tag), so we just count everyone as online
 * and avoid touching config or rules. `globalThresholdMs` is unused in
 * that path; `ruleCache` is consulted only in the full path.
 */
async function processSensors(
  sensors: SensorRecord[],
  now: number,
  fullFlow: boolean,
  globalThresholdMs: number,
  ruleCache: RuleCache,
): Promise<{
  countsByGroup: Map<string, SensorBucket>;
  newlyInactive: NewlyInactive[];
  recovered: SensorRecord[];
}> {
  const countsByGroup = new Map<string, SensorBucket>();
  const newlyInactive: NewlyInactive[] = [];
  const recovered: SensorRecord[] = [];

  for (const sensor of sensors) {
    if (!sensor.last_input) {
      continue;
    }

    const groupID = sensor.tags.find((tag) => tag.key === "group_id")?.value;
    const organizationID = sensor.tags.find((tag) => tag.key === "organization_id")?.value;
    if (!groupID || !organizationID) {
      continue;
    }

    await syncLastUplinkHours(sensor.id, sensor.last_input, now);

    const bucket = countsByGroup.get(groupID) ?? { online: 0, offline: 0 };

    if (!fullFlow) {
      bucket.online += 1;
      countsByGroup.set(groupID, bucket);
      continue;
    }

    const orgRules = await getRulesForOrganization(organizationID, ruleCache);
    const rule = findRuleForSensor(orgRules, sensor.id);
    const thresholdMs = rule ? rule.thresholdMs : globalThresholdMs;

    const inactive = isSensorInactive(sensor, now, thresholdMs);
    const alreadyNotified = wasAlreadyNotified(sensor);

    if (inactive) {
      bucket.offline += 1;
    } else {
      bucket.online += 1;
    }
    countsByGroup.set(groupID, bucket);

    if (inactive && !alreadyNotified) {
      newlyInactive.push({ sensor, rule });
    } else if (!inactive && alreadyNotified) {
      recovered.push(sensor);
    }
  }

  return { countsByGroup, newlyInactive, recovered };
}

// ============================================================================
// Entrypoint
// ============================================================================

/**
 * Entrypoint invoked by the TagoIO Analysis runtime.
 *
 * Steps:
 *   1. Fetch every sensor in the application.
 *   2. Decide between short-circuit and full flow via `hasAlertCandidates`.
 *      Short-circuit kicks in when no sensor has been silent for over an
 *      hour AND no sensor still carries the `inactivity_notified` tag —
 *      in that case no state transition can happen and we skip loading
 *      both the global config and the per-org Checkin rules.
 *   3. Walk the sensors via `processSensors`, refreshing `last_uplink`
 *      on each. In the full flow we also resolve the per-org threshold
 *      (lazy-loaded and cached) and collect newly-inactive / recovered
 *      sensors.
 *   4. Upsert `device_connectivity_summary` on every group device that
 *      owns at least one sensor.
 *   5. Notify users and tag the newly-inactive sensors so we don't spam
 *      them next run.
 *   6. Clear the notified tag for sensors that came back online.
 */
async function startAnalysis(context: TagoContext, _scope: Data[]) {
  console.log("Running Inactivity Check Analysis");

  const environment = Utils.envToJson(context.environment);

  const configDevID = environment.config_id;
  if (!configDevID) {
    console.log("Missing config_id environment variable, skipping");
    return;
  }

  const sensors = await fetchDeviceList({ tags: [{ key: "device_type", value: "device" }] });
  console.log(`Scanning ${sensors.length} sensors`);

  const now = Date.now();
  const ruleCache: RuleCache = new Map();

  // Step 2 — decide between short-circuit and full flow.
  const fullFlow = hasAlertCandidates(sensors, now);
  let config: InactivityConfig | null = null;

  if (fullFlow) {
    config = await loadInactivityConfig(configDevID);
    if (!config) {
      return;
    }
    console.log(`Global threshold = ${config.thresholdMs}ms; per-org rules will load lazily.`);
  } else {
    console.log("No alert candidates this run — skipping config and rule loading.");
  }

  // Step 3 — walk sensors.
  const { countsByGroup, newlyInactive, recovered } = await processSensors(
    sensors,
    now,
    fullFlow,
    config?.thresholdMs ?? 0,
    ruleCache,
  );

  // Step 4 — refresh group summaries.
  for (const [groupID, counts] of countsByGroup) {
    await upsertGroupSummary(groupID, counts);
  }

  // Step 5 — notify + flag newly inactive sensors.
  for (const entry of newlyInactive) {
    await handleNewlyInactive(entry, config?.alertMessage ?? DEFAULT_ALERT_MESSAGE);
  }

  // Step 6 — clear the flag for sensors that recovered.
  for (const sensor of recovered) {
    await handleRecovered(sensor);
  }

  console.log(
    `Inactivity scan finished. Groups updated: ${countsByGroup.size}, newly inactive: ${newlyInactive.length}, recovered: ${recovered.length}`,
  );
}

if (!Deno.env.get("T_TEST")) {
  Analysis.use(startAnalysis, { token: Deno.env.get("T_ANALYSIS_TOKEN") });
}

export { startAnalysis };
