import { type TDataRecord, useUserInformation, useWidgetData } from "@tago-io/custom-widget-react";
import { useMemo, useState } from "react";
import { GroupFilter } from "./components/GroupFilter.tsx";
import { GroupSection } from "./components/GroupSection.tsx";
import { SearchBar } from "./components/SearchBar.tsx";
import { SensorCard } from "./components/SensorCard.tsx";
import { normalizeTemperature, resolveTempUnit, tempTone } from "../shared/temperature.ts";
import { relativeTime } from "../shared/relative-time.ts";
import { useNow } from "../shared/use-now.ts";
import { useDictionary } from "../shared/use-dictionary.ts";

const SENSOR_VARIABLE = "cold_room_card_data";

const WIDGET_KEYS = [
  "WIDGET_UNKNOWN_SENSOR",
  "WIDGET_UNKNOWN_GROUP",
  "WIDGET_NO_DATA",
  "WIDGET_NO_GROUPS_SELECTED",
  "WIDGET_NO_SENSORS_MATCH",
  "WIDGET_SEARCH",
  "WIDGET_SEARCH_PLACEHOLDER",
  "WIDGET_SEARCH_OPEN",
  "WIDGET_SEARCH_CLOSE",
  "WIDGET_FILTER_GROUPS",
  "WIDGET_FILTER_BY_GROUP",
  "WIDGET_FILTER_SELECT_ALL",
  "WIDGET_FILTER_CLEAR",
  "WIDGET_FILTER_NO_GROUPS_AVAILABLE",
  "WIDGET_SENSOR_COUNT_ONE",
  "WIDGET_SENSOR_COUNT_MANY",
  "WIDGET_STATUS_ON",
  "WIDGET_STATUS_OFF",
  "WIDGET_STATUS_OPEN",
  "WIDGET_STATUS_CLOSED",
  "WIDGET_TIME_AGO_FEW_SECONDS",
  "WIDGET_TIME_AGO_SECONDS",
  "WIDGET_TIME_AGO_MINUTES",
  "WIDGET_TIME_AGO_HOURS",
] as const;

const EN_BASELINE: Record<string, string> = {
  WIDGET_UNKNOWN_SENSOR: "Unknown sensor",
  WIDGET_UNKNOWN_GROUP: "Unknown group",
  WIDGET_NO_DATA: "No data",
  WIDGET_NO_GROUPS_SELECTED: "No groups selected.",
  WIDGET_NO_SENSORS_MATCH: "No sensors match",
  WIDGET_SEARCH: "Search",
  WIDGET_SEARCH_PLACEHOLDER: "Search sensors or groups...",
  WIDGET_SEARCH_OPEN: "Open search",
  WIDGET_SEARCH_CLOSE: "Close search",
  WIDGET_FILTER_GROUPS: "Groups",
  WIDGET_FILTER_BY_GROUP: "Filter by group",
  WIDGET_FILTER_SELECT_ALL: "Select all",
  WIDGET_FILTER_CLEAR: "Clear",
  WIDGET_FILTER_NO_GROUPS_AVAILABLE: "No groups available.",
  WIDGET_SENSOR_COUNT_ONE: "1 sensor",
  WIDGET_SENSOR_COUNT_MANY: "{n} sensors",
  WIDGET_STATUS_ON: "ON",
  WIDGET_STATUS_OFF: "OFF",
  WIDGET_STATUS_OPEN: "OPEN",
  WIDGET_STATUS_CLOSED: "CLOSED",
  WIDGET_TIME_AGO_FEW_SECONDS: "— a few seconds ago",
  WIDGET_TIME_AGO_SECONDS: "— {n}s ago",
  WIDGET_TIME_AGO_MINUTES: "— {n}m ago",
  WIDGET_TIME_AGO_HOURS: "— {n}h ago",
};

function asString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim().toLowerCase();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  return null;
}

function sensorName(record: TDataRecord, unknownFallback: string): string {
  const metaName = record.metadata && typeof record.metadata.sensor_name === "string" ? record.metadata.sensor_name.trim() : "";
  if (metaName) {
    return metaName;
  }
  return record.group ?? record.device ?? unknownFallback;
}

function groupID(record: TDataRecord): string | null {
  const raw = record.metadata && typeof record.metadata.group_id === "string" ? record.metadata.group_id.trim() : "";
  return raw === "" ? null : raw;
}

function groupName(record: TDataRecord, unknownFallback: string): string {
  const raw = record.metadata && typeof record.metadata.group_name === "string" ? record.metadata.group_name.trim() : "";
  return raw === "" ? unknownFallback : raw;
}

/**
 * Returns `true` when the sensor reading is in an alert state.
 *
 * Alerts are: temperature in the orange/red tone bands, or door open.
 * Used to sort flagged sensors to the top inside each group section.
 */
function hasAlert(record: TDataRecord): boolean {
  const rawTempF = asNumber(record.metadata?.temperature_fahrenheit);
  if (rawTempF !== null) {
    const tone = tempTone(rawTempF);
    if (tone === "red" || tone === "orange") {
      return true;
    }
  }
  return asString(record.metadata?.door_status) === "open";
}

interface GroupBucket {
  groupID: string;
  groupName: string;
  records: TDataRecord[];
}

/**
 * Buckets the visible records by `group_id`. Records without a `group_id`
 * in metadata are skipped — they are legacy points that pre-date the
 * uplink-handler update and will be replaced on the next uplink.
 *
 * When the same `group_id` appears with two different `group_name` values
 * (group was renamed between writes), the last name we see wins — the
 * next uplink reconciles everything anyway.
 */
function bucketByGroupWithFallback(records: TDataRecord[], unknownGroupFallback: string): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>();

  for (const record of records) {
    const id = groupID(record);
    if (!id) {
      continue;
    }

    const existing = buckets.get(id);
    if (existing) {
      existing.records.push(record);
      existing.groupName = groupName(record, unknownGroupFallback);
      continue;
    }

    buckets.set(id, {
      groupID: id,
      groupName: groupName(record, unknownGroupFallback),
      records: [record],
    });
  }

  return Array.from(buckets.values());
}

export default function App() {
  const { isLoading, records } = useWidgetData();
  const { customPreferences } = useUserInformation();
  const { t } = useDictionary(WIDGET_KEYS, { baseline: EN_BASELINE });
  const [query, setQuery] = useState("");
  // `null` = default state ("all groups selected"). The Set is materialised
  // only when the user explicitly changes the selection — this avoids
  // rebuilding a Set on every render and keeps the default truly cheap.
  const [selectedGroupIDs, setSelectedGroupIDs] = useState<Set<string> | null>(null);
  const now = useNow(30_000);

  const unknownSensorLabel = t("WIDGET_UNKNOWN_SENSOR");
  const unknownGroupLabel = t("WIDGET_UNKNOWN_GROUP");

  const tempUnit = resolveTempUnit(customPreferences);
  const sensorRecords = useMemo(
    () => records.filter((r) => r.variable === SENSOR_VARIABLE),
    [records],
  );

  // Step 1 — apply the search filter. The search matches both the sensor
  // name AND the group name so users can narrow to a single group quickly.
  const matchingRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return sensorRecords;
    }
    return sensorRecords.filter((record) => {
      const inSensor = sensorName(record, unknownSensorLabel).toLowerCase().includes(q);
      const inGroup = groupName(record, unknownGroupLabel).toLowerCase().includes(q);
      return inSensor || inGroup;
    });
  }, [sensorRecords, query, unknownSensorLabel, unknownGroupLabel]);

  // Available groups (derived from sensorRecords — BEFORE search/selection,
  // so the filter never hides its own options).
  const availableGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const record of sensorRecords) {
      const id = groupID(record);
      if (!id) {
        continue;
      }
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
        existing.name = groupName(record, unknownGroupLabel);
      } else {
        map.set(id, { id, name: groupName(record, unknownGroupLabel), count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sensorRecords, unknownGroupLabel]);

  const effectiveSelection = selectedGroupIDs ?? new Set(availableGroups.map((g) => g.id));

  // Step 1.5 — drop records whose group_id is not in the active selection.
  // When selectedGroupIDs is null we're in the default state and pass through.
  const groupFilteredRecords = useMemo(() => {
    if (selectedGroupIDs === null) {
      return matchingRecords;
    }
    return matchingRecords.filter((record) => {
      const id = groupID(record);
      return id !== null && selectedGroupIDs.has(id);
    });
  }, [matchingRecords, selectedGroupIDs]);

  // Step 2 — bucket by group_id and sort: groups alphabetically by name,
  // sensors inside a group with alerts first, then alphabetical by name.
  const sortedGroups = useMemo(() => {
    const buckets = bucketByGroupWithFallback(groupFilteredRecords, unknownGroupLabel);

    for (const bucket of buckets) {
      bucket.records.sort((a, b) => {
        const alertA = hasAlert(a);
        const alertB = hasAlert(b);
        if (alertA !== alertB) {
          return alertA ? -1 : 1;
        }
        return sensorName(a, unknownSensorLabel).localeCompare(sensorName(b, unknownSensorLabel));
      });
    }

    buckets.sort((a, b) => a.groupName.localeCompare(b.groupName));
    return buckets;
  }, [groupFilteredRecords, unknownGroupLabel, unknownSensorLabel]);

  const noGroupsSelected = selectedGroupIDs !== null && selectedGroupIDs.size === 0;

  const filterLabels = useMemo(
    () => ({
      trigger: t("WIDGET_FILTER_GROUPS"),
      ariaFilterBy: t("WIDGET_FILTER_BY_GROUP"),
      selectAll: t("WIDGET_FILTER_SELECT_ALL"),
      clear: t("WIDGET_FILTER_CLEAR"),
      empty: t("WIDGET_FILTER_NO_GROUPS_AVAILABLE"),
    }),
    [t],
  );

  const sensorCardLabels = useMemo(
    () => ({
      on: t("WIDGET_STATUS_ON"),
      off: t("WIDGET_STATUS_OFF"),
      open: t("WIDGET_STATUS_OPEN"),
      closed: t("WIDGET_STATUS_CLOSED"),
    }),
    [t],
  );

  const timeTemplates = useMemo(
    () => ({
      fewSeconds: t("WIDGET_TIME_AGO_FEW_SECONDS"),
      seconds: t("WIDGET_TIME_AGO_SECONDS"),
      minutes: t("WIDGET_TIME_AGO_MINUTES"),
      hours: t("WIDGET_TIME_AGO_HOURS"),
    }),
    [t],
  );

  return (
    <div
      className="@container/widget flex min-h-dvh w-dvw flex-col overflow-x-hidden overflow-y-auto bg-[rgb(43,43,43)] p-3 text-[rgb(240,240,240)]"
      style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <GroupFilter
          groups={availableGroups}
          selectedIDs={effectiveSelection}
          onChange={setSelectedGroupIDs}
          labels={filterLabels}
        />
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t("WIDGET_SEARCH_PLACEHOLDER")}
          label={t("WIDGET_SEARCH")}
          ariaOpenLabel={t("WIDGET_SEARCH_OPEN")}
          ariaCloseLabel={t("WIDGET_SEARCH_CLOSE")}
        />
      </div>

      {!isLoading && sensorRecords.length === 0
        ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[rgb(150,150,150)]">
            <div>
              <div className="mb-2 text-[15px] font-semibold uppercase tracking-[0.06em]">
                {t("WIDGET_NO_DATA")}
              </div>
            </div>
          </div>
        )
        : !isLoading && noGroupsSelected
        ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[rgb(150,150,150)]">
            <div className="text-[13px]">{t("WIDGET_NO_GROUPS_SELECTED")}</div>
          </div>
        )
        : !isLoading && sortedGroups.length === 0
        ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[rgb(150,150,150)]">
            <div className="text-[13px]">
              {t("WIDGET_NO_SENSORS_MATCH")} <span className="text-[rgb(240,240,240)]">"{query}"</span>.
            </div>
          </div>
        )
        : (
          <div>
            {sortedGroups.map((group) => {
              const countLabel = group.records.length === 1 ? t("WIDGET_SENSOR_COUNT_ONE") : t("WIDGET_SENSOR_COUNT_MANY", { n: group.records.length });
              return (
                <GroupSection
                  key={group.groupID}
                  groupName={group.groupName}
                  sensorCountLabel={countLabel}
                >
                  {group.records.map((record) => {
                    const rawTempF = asNumber(record.metadata?.temperature_fahrenheit);
                    const temp = rawTempF === null ? null : normalizeTemperature(rawTempF, "°F", tempUnit);
                    const compressorOn = asString(record.metadata?.compressor_status) === "on";
                    const doorOpen = asString(record.metadata?.door_status) === "open";

                    return (
                      <SensorCard
                        key={record.id ?? `${record.group ?? "sensor"}-${record.time ?? ""}`}
                        name={sensorName(record, unknownSensorLabel)}
                        tempValue={temp?.value ?? null}
                        tempUnit={temp?.unit ?? (tempUnit === "C" ? "°C" : "°F")}
                        tempTone={rawTempF === null ? "blue" : tempTone(rawTempF)}
                        compressorOn={compressorOn}
                        doorOpen={doorOpen}
                        time={relativeTime(record.time, now, timeTemplates)}
                        labels={sensorCardLabels}
                        isLoading={isLoading}
                      />
                    );
                  })}
                </GroupSection>
              );
            })}
          </div>
        )}
    </div>
  );
}
