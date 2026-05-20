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
 *     `"Device inactivity detected"`.
 *
 * From every organization device (tag `device_type=organization`):
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
 *
 * NOTE
 * ----
 * This file is optimized for clarity, not performance. The goal is for a
 * developer new to TagoIO to read it top-to-bottom and understand every step.
 */

import { Analysis, type Data, type DeviceListItem, type DeviceQuery, Resources, type TagoContext, type TagsObj, type UserInfo, type UserQuery, Utils } from "npm:@tago-io/sdk";
import z from "npm:zod";

// ============================================================================
// Constants
// ============================================================================

/**
 * Group used to scope every configuration record on the config device.
 * Records stored under this group hold the inactivity threshold and the
 * alert message displayed to users.
 */
const CONFIG_GROUP = "global-inactivity";

/**
 * Variable on each group device that exposes the sensor connectivity
 * summary (total, online, offline) consumed by the Sensor Status cards.
 */
const SUMMARY_VARIABLE = "device_connectivity_summary";

/**
 * Tag key written on sensors that have already triggered a notification.
 * Acts as a persistent flag between scheduled runs, since Analysis is
 * ephemeral and cannot keep in-memory state.
 */
const NOTIFIED_TAG = "inactivity_notified";

/**
 * Device parameter populated on every sensor with the integer number of
 * hours since the last uplink. Powers the Sensor List widget column.
 */
const LAST_UPLINK_PARAM = "last_uplink";

/** Used when `global_alert_message` is missing on the config device. */
const DEFAULT_ALERT_MESSAGE = "Device inactivity detected";

/** Title shown on every in-app notification dispatched by this Analysis. */
const NOTIFICATION_TITLE = "Device inactivity";

/**
 * Variables written by `crud-alert.ts` on the organization device to
 * describe one Checkin alert row. We only need to read three of them
 * here (devices/value/recipients/message); the others are display-only.
 */
const ALERT_VAR_MODEL = "alert_management_type";
const ALERT_VAR_DEVICES = "alert_management_devices";
const ALERT_VAR_VALUE = "alert_management_value";
const ALERT_VAR_SEND_TO = "alert_management_users";
const ALERT_VAR_MESSAGE = "alert_management_message";

/** Tag value that flags an organization device. */
const ORG_DEVICE_TYPE = "organization";

/** Conversion factor used to compute the `last_uplink` column value. */
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Map from the unit string stored on the config device to milliseconds.
 *
 * Only `hour` is supported today. To accept more units (minute, day, ...)
 * extend BOTH this map AND the `unit` enum inside `thresholdModel` below.
 */
const UNIT_MS: Record<string, number> = {
  hour: 60 * 60 * 1000,
};

// ============================================================================
// Validation schema
// ============================================================================

/**
 * Shape of the inactivity threshold read from the config device.
 *
 * `value` is normalised through the same number-or-string transform used
 * elsewhere in the project because dashboard widgets can write either
 * type depending on how the value was entered.
 */
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

/** Resolved inactivity configuration after parsing the config device. */
interface InactivityConfig {
  thresholdMs: number;
  alertMessage: string;
}

/** Per-group counters used to build the connectivity summary row. */
interface SensorBucket {
  online: number;
  offline: number;
}

/** Subset of the device list response actually used by this Analysis. */
type SensorRecord = Pick<DeviceListItem, "id" | "name" | "tags" | "last_input" | "created_at">;

/** Subset of the user list response actually used by this Analysis. */
type UserRecord = Pick<UserInfo, "id" | "name" | "phone" | "company" | "tags" | "active" | "email" | "timezone">;

/** Output of `classifySensors`: counts + state-transition sensors. */
interface ScanResult {
  countsByGroup: Map<string, SensorBucket>;
  newlyInactive: NewlyInactive[];
  recovered: SensorRecord[];
}

/**
 * One per-organization Checkin alert rule (the row created from the
 * Alerts dashboard by `crud-alert.ts`). Each rule overrides the global
 * threshold for the sensors it applies to.
 */
interface OrgCheckinRule {
  organizationID: string;
  thresholdMs: number;
  sensorIDs: Set<string> | "all";
  recipientIDs: string[];
  message: string;
}

/**
 * Pairs a sensor that just went inactive with the rule that decided it.
 * `rule` is `null` when no per-org rule matched and the global fallback
 * is the one that fires.
 */
interface NewlyInactive {
  sensor: SensorRecord;
  rule: OrgCheckinRule | null;
}

// ============================================================================
// Helpers — paginated list fetchers (self-contained)
// ============================================================================

/**
 * Fetches the full device list, page by page, applying the provided filter.
 *
 * TagoIO returns at most a few hundred devices per page and enforces a
 * per-minute API limit. Paginating with a small `amount` keeps each request
 * well under that limit. The hard upper bound (`MAX_PAGES`) is a safety net
 * against an infinite loop if the API ever misbehaves.
 */
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

    // A short page means we have reached the end of the list.
    if (batch.length < PAGE_SIZE) {
      break;
    }
  }

  return devices;
}

/**
 * Fetches the full user list, page by page, applying the provided filter.
 *
 * Same pagination guarantees as `fetchDeviceList` — see the comment above.
 */
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
 * Reads the inactivity threshold and alert message from the config device.
 *
 * The values live under the `global-inactivity` group on the device pointed
 * to by `environment.config_id`. Returns null when any required piece is
 * missing or invalid so the analysis can short-circuit safely.
 */
async function loadInactivityConfig(configDevID: string): Promise<InactivityConfig | null> {
  const [valueRecord] = await Resources.devices.getDeviceData(configDevID, {
    variables: "global_alert_value",
    groups: CONFIG_GROUP,
    qty: 1,
  });
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

  const [messageRecord] = await Resources.devices.getDeviceData(configDevID, {
    variables: "global_alert_message",
    groups: CONFIG_GROUP,
    qty: 1,
  });

  return {
    thresholdMs: parsed.data.value * UNIT_MS[parsed.data.unit],
    alertMessage: String(messageRecord?.value ?? DEFAULT_ALERT_MESSAGE),
  };
}

// ============================================================================
// Helpers — per-organization Checkin alerts
// ============================================================================

/**
 * Reads every Checkin alert row across all organization devices and
 * returns one rule per row.
 *
 * The Alerts dashboard CRUD writes each alert as a set of six data points
 * on the parent organization device, all sharing the same `group` (the
 * alert id). For inactivity we only care about Checkin rows, so we filter
 * by the `alert_management_model = checkin` value AFTER fetching.
 *
 * Each rule overrides the global threshold for the sensors it applies
 * to. Rules whose sensor selection is `"all_sensors"` apply to every
 * sensor in their organization; otherwise the selection is a CSV of
 * sensor ids.
 */
async function loadOrganizationCheckinRules(): Promise<Map<string, OrgCheckinRule[]>> {
  const rulesByOrg = new Map<string, OrgCheckinRule[]>();

  // Find every organization device. Each one may carry zero or more
  // alert rows on its data store.
  const orgDevices = await fetchDeviceList({
    tags: [{ key: "device_type", value: ORG_DEVICE_TYPE }],
  });

  for (const orgDevice of orgDevices) {
    const organizationID = orgDevice.id;

    // Pull every model record on this org device. The CRUD writes one
    // per alert, so this is also the count of alerts on the org.
    const modelRecords = await Resources.devices.getDeviceData(organizationID, {
      variables: ALERT_VAR_MODEL,
      qty: 9999,
    });

    // We only care about rows whose model is "checkin".
    const checkinModelRecords = modelRecords.filter((record) => record.value === "checkin");

    for (const modelRecord of checkinModelRecords) {
      const alertID = modelRecord.group;
      if (!alertID) {
        continue;
      }

      // Fetch the other variables of the same alert row. Each variable
      // is one data point with the same `group` value, so we filter by
      // group when reading.
      const [devicesRecord, valueRecord, recipientsRecord, messageRecord] = await Promise.all([
        Resources.devices
          .getDeviceData(organizationID, { variables: ALERT_VAR_DEVICES, groups: alertID, qty: 1 })
          .then((batch) => batch[0])
          .catch(() => null),
        Resources.devices
          .getDeviceData(organizationID, { variables: ALERT_VAR_VALUE, groups: alertID, qty: 1 })
          .then((batch) => batch[0])
          .catch(() => null),
        Resources.devices
          .getDeviceData(organizationID, { variables: ALERT_VAR_SEND_TO, groups: alertID, qty: 1 })
          .then((batch) => batch[0])
          .catch(() => null),
        Resources.devices
          .getDeviceData(organizationID, { variables: ALERT_VAR_MESSAGE, groups: alertID, qty: 1 })
          .then((batch) => batch[0])
          .catch(() => null),
      ]);

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

      const rule: OrgCheckinRule = {
        organizationID,
        thresholdMs: inactivityHours * MS_PER_HOUR,
        sensorIDs,
        recipientIDs,
        message: String(messageRecord?.value ?? DEFAULT_ALERT_MESSAGE),
      };

      const existing = rulesByOrg.get(organizationID) ?? [];
      existing.push(rule);
      rulesByOrg.set(organizationID, existing);
    }
  }

  return rulesByOrg;
}

/**
 * Picks the first per-organization Checkin rule that applies to the given
 * sensor, if any. Rules ordered by insertion (the API returns the most
 * recent first); for now we just take the first match — multiple Checkin
 * alerts targeting the same sensor in the same org is not a supported
 * workflow today.
 */
function findRuleForSensor(
  rulesByOrg: Map<string, OrgCheckinRule[]>,
  organizationID: string,
  sensorID: string,
): OrgCheckinRule | null {
  const rules = rulesByOrg.get(organizationID);
  if (!rules) {
    return null;
  }
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

/**
 * Returns true when the sensor has not received any data since
 * `now - thresholdMs`.
 *
 * Sensors with no `last_input` are treated as "never reported" by the
 * caller and filtered out before reaching this check.
 */
function isSensorInactive(sensor: SensorRecord, now: number, thresholdMs: number): boolean {
  if (!sensor.last_input) {
    return false;
  }
  return now - new Date(sensor.last_input).getTime() > thresholdMs;
}

/**
 * Checks whether the sensor was already flagged in a previous run.
 *
 * The `inactivity_notified=true` tag is what prevents duplicate
 * notifications across the hourly schedule. We clear it in
 * `handleRecovered` so a sensor can be notified again next time it goes
 * offline.
 */
function wasAlreadyNotified(sensor: SensorRecord): boolean {
  return sensor.tags.some((tag) => tag.key === NOTIFIED_TAG && tag.value === "true");
}

/**
 * Updates the `last_uplink` device parameter with the integer number of
 * hours since the sensor's last input.
 *
 * The Sensor List widget reads this parameter to render the `Last seen(h)`
 * column. We skip the write when the parameter already matches the new
 * value — this saves an API call on sensors that report frequently and
 * stay in the same hour bucket between runs.
 */
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

/**
 * Classifies every sensor as online/offline, groups counts by `group_id`,
 * records the state transitions (newly inactive / recovered) to act on,
 * and refreshes the `last_uplink` parameter that powers the Sensor List
 * widget.
 *
 * Each sensor is evaluated against its organization's Checkin alert rule
 * (created via the Alerts CRUD). When no per-org rule applies, the global
 * threshold from the config device is used as the fallback.
 *
 * Sensors without `last_input` are skipped — they have not produced data
 * yet, so labeling them as inactive would be misleading. Sensors missing
 * `group_id` or `organization_id` tags are also skipped: we cannot route
 * their summary or notifications without that context.
 */
async function classifySensors(
  sensors: SensorRecord[],
  globalThresholdMs: number,
  rulesByOrg: Map<string, OrgCheckinRule[]>,
): Promise<ScanResult> {
  const now = Date.now();
  const countsByGroup = new Map<string, SensorBucket>();
  const newlyInactive: NewlyInactive[] = [];
  const recovered: SensorRecord[] = [];

  for (const sensor of sensors) {
    // Never-reported devices are not actionable inactivity events.
    if (!sensor.last_input) {
      continue;
    }

    const groupID = sensor.tags.find((tag) => tag.key === "group_id")?.value;
    const organizationID = sensor.tags.find((tag) => tag.key === "organization_id")?.value;
    if (!groupID || !organizationID) {
      continue;
    }

    // Keep the `Last seen(h)` column fresh for this sensor.
    await syncLastUplinkHours(sensor.id, sensor.last_input, now);

    // Per-org rule first, fall back to the global threshold when none
    // matches this sensor.
    const rule = findRuleForSensor(rulesByOrg, organizationID, sensor.id);
    const thresholdMs = rule ? rule.thresholdMs : globalThresholdMs;

    const inactive = isSensorInactive(sensor, now, thresholdMs);
    const alreadyNotified = wasAlreadyNotified(sensor);

    // Increment per-group counts for the connectivity summary upsert.
    const bucket = countsByGroup.get(groupID) ?? { online: 0, offline: 0 };
    if (inactive) {
      bucket.offline += 1;
    } else {
      bucket.online += 1;
    }
    countsByGroup.set(groupID, bucket);

    // Only act on state transitions to avoid hourly notification spam.
    if (inactive && !alreadyNotified) {
      newlyInactive.push({ sensor, rule });
    } else if (!inactive && alreadyNotified) {
      recovered.push(sensor);
    }
  }

  return { countsByGroup, newlyInactive, recovered };
}

// ============================================================================
// Helpers — summary upsert
// ============================================================================

/**
 * Creates or updates the connectivity summary row for one group.
 *
 * `total_registered` is owned by the sensor CRUD analysis (`crud-sensor.ts`),
 * so we only touch `online` and `offline` here and preserve every other
 * metadata key on edit.
 */
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

  // First time this group is seen by the analysis: seed `total_registered`
  // with the current count so the Sensor Status cards have something to
  // render until the sensor CRUD updates it.
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

/**
 * Sends an in-app notification to every Run User that belongs to the
 * organization. Used as the fallback path when the sensor has no
 * per-organization Checkin alert rule.
 *
 * Notifications are dispatched serially because the SDK takes one user at
 * a time and TagoIO enforces per-minute rate limits on this endpoint.
 */
async function notifyOrganizationUsers(organizationID: string, message: string) {
  const users = await fetchUserList({ tags: [{ key: "organization_id", value: organizationID }] });
  for (const user of users) {
    await Resources.run.notificationCreate(user.id, {
      title: NOTIFICATION_TITLE,
      message,
    });
  }
}

/**
 * Sends an in-app notification to a specific list of Run Users. Used when
 * a per-organization Checkin alert defines its own recipients.
 */
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
 * Adds or replaces a tag in a tag list without duplicating it.
 *
 * `Resources.devices.edit({ tags })` REPLACES the full tag array, so
 * callers must always send every tag they want to keep.
 */
function setOrReplaceTag(tags: TagsObj[], key: string, value: string): TagsObj[] {
  const otherTags = tags.filter((tag) => tag.key !== key);
  return [...otherTags, { key, value }];
}

/**
 * Marks the sensor as notified and dispatches notifications.
 *
 * When the inactivity was decided by a per-organization Checkin rule, we
 * use that rule's recipient list and message. Otherwise we fall back to
 * the global behaviour: notify every user tagged with the sensor's
 * organization id, with the global alert message.
 */
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

/**
 * Clears the `inactivity_notified` tag so the sensor can be re-notified
 * if it goes inactive again later.
 */
async function handleRecovered(sensor: SensorRecord) {
  await Resources.devices.edit(sensor.id, {
    tags: sensor.tags.filter((tag) => tag.key !== NOTIFIED_TAG),
  });
  console.log(`Sensor ${sensor.id} recovered, tag cleared`);
}

// ============================================================================
// Entrypoint
// ============================================================================

/**
 * Entrypoint invoked by the TagoIO Analysis runtime.
 *
 * Steps:
 *   1. Load the inactivity threshold + alert message from the config device
 *      (used as a fallback for sensors without a per-org Checkin rule).
 *   2. Load every per-organization Checkin alert created via the Alerts
 *      CRUD. Each rule overrides the global threshold and recipients for
 *      its sensors.
 *   3. Fetch every sensor (`device_type=device`) in the application.
 *   4. Classify each sensor as online/offline (using the per-org rule when
 *      one applies, otherwise the global threshold), refresh the
 *      `last_uplink` parameter, and collect newly-inactive and recovered
 *      sensors.
 *   5. Upsert `device_connectivity_summary` on every group device that
 *      owns at least one sensor.
 *   6. For each newly-inactive sensor: notify the rule's recipients (or
 *      the org-wide user list when no rule applies) and tag the sensor as
 *      notified so we don't spam it next run.
 *   7. For each recovered sensor: clear the notified tag.
 */
async function startAnalysis(context: TagoContext, _scope: Data[]) {
  console.log("Running Inactivity Check Analysis");

  const environment = Utils.envToJson(context.environment);

  const configDevID = environment.config_id;
  if (!configDevID) {
    console.log("Missing config_id environment variable, skipping");
    return;
  }

  // Step 1 — load the global threshold and alert message.
  const config = await loadInactivityConfig(configDevID);
  if (!config) {
    return;
  }

  // Step 2 — load per-organization Checkin alert rules from the Alerts CRUD.
  console.log("Loading per-organization Checkin alerts...");
  const rulesByOrg = await loadOrganizationCheckinRules();
  let ruleCount = 0;
  for (const rules of rulesByOrg.values()) {
    ruleCount += rules.length;
  }
  console.log(`Loaded ${ruleCount} per-organization Checkin rule(s)`);

  // Step 3 — fetch every sensor in the application (paginated).
  console.log("Fetching all sensors...");
  const sensors = await fetchDeviceList({
    tags: [{ key: "device_type", value: "device" }],
  });
  console.log(`Scanning ${sensors.length} sensors (global threshold=${config.thresholdMs}ms)`);

  // Step 4 — classify, refresh `last_uplink`, and detect transitions.
  const { countsByGroup, newlyInactive, recovered } = await classifySensors(
    sensors,
    config.thresholdMs,
    rulesByOrg,
  );

  // Step 5 — create or update the connectivity summary on each group device.
  // `Map` is iterated as `[key, value]` pairs, so destructuring works here.
  for (const [groupID, counts] of countsByGroup) {
    await upsertGroupSummary(groupID, counts);
  }

  // Step 6 — notify users for newly-inactive sensors and persist the flag.
  for (const entry of newlyInactive) {
    await handleNewlyInactive(entry, config.alertMessage);
  }

  // Step 7 — clear the flag for sensors that came back online.
  for (const sensor of recovered) {
    await handleRecovered(sensor);
  }

  console.log(
    `Inactivity scan finished. Groups updated: ${countsByGroup.size}, newly inactive: ${newlyInactive.length}, recovered: ${recovered.length}`,
  );
}

// The Analysis runtime sets `T_TEST` during local tests so the handler is
// not wired up automatically. In production the runtime sets
// `T_ANALYSIS_TOKEN` and calls `Analysis.use` below.
if (!Deno.env.get("T_TEST")) {
  Analysis.use(startAnalysis, { token: Deno.env.get("T_ANALYSIS_TOKEN") });
}

export { startAnalysis };
