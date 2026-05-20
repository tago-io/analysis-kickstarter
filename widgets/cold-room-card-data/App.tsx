import { type TDataRecord, useUserInformation, useWidgetData } from "@tago-io/custom-widget-react";
import { useMemo, useState } from "react";
import { GroupSection } from "./components/GroupSection.tsx";
import { SearchBar } from "./components/SearchBar.tsx";
import { SensorCard } from "./components/SensorCard.tsx";
import { normalizeTemperature, resolveTempUnit, tempTone } from "../shared/temperature.ts";
import { relativeTime } from "../shared/relative-time.ts";
import { useNow } from "../shared/use-now.ts";

const SENSOR_VARIABLE = "cold_room_card_data";

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

function sensorName(record: TDataRecord): string {
  const metaName = record.metadata && typeof record.metadata.sensor_name === "string" ? record.metadata.sensor_name.trim() : "";
  if (metaName) {
    return metaName;
  }
  return record.group ?? record.device ?? "Unknown sensor";
}

function groupID(record: TDataRecord): string | null {
  const raw = record.metadata && typeof record.metadata.group_id === "string" ? record.metadata.group_id.trim() : "";
  return raw === "" ? null : raw;
}

function groupName(record: TDataRecord): string {
  const raw = record.metadata && typeof record.metadata.group_name === "string" ? record.metadata.group_name.trim() : "";
  return raw === "" ? "Unknown group" : raw;
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
function bucketByGroup(records: TDataRecord[]): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>();

  for (const record of records) {
    const id = groupID(record);
    if (!id) {
      continue;
    }

    const existing = buckets.get(id);
    if (existing) {
      existing.records.push(record);
      existing.groupName = groupName(record);
      continue;
    }

    buckets.set(id, {
      groupID: id,
      groupName: groupName(record),
      records: [record],
    });
  }

  return Array.from(buckets.values());
}

export default function App() {
  const { isLoading, records } = useWidgetData();
  const { customPreferences } = useUserInformation();
  const [query, setQuery] = useState("");
  const now = useNow(30_000);

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
      const inSensor = sensorName(record).toLowerCase().includes(q);
      const inGroup = groupName(record).toLowerCase().includes(q);
      return inSensor || inGroup;
    });
  }, [sensorRecords, query]);

  // Step 2 — bucket by group_id and sort: groups alphabetically by name,
  // sensors inside a group with alerts first, then alphabetical by name.
  const sortedGroups = useMemo(() => {
    const buckets = bucketByGroup(matchingRecords);

    for (const bucket of buckets) {
      bucket.records.sort((a, b) => {
        const alertA = hasAlert(a);
        const alertB = hasAlert(b);
        if (alertA !== alertB) {
          return alertA ? -1 : 1;
        }
        return sensorName(a).localeCompare(sensorName(b));
      });
    }

    buckets.sort((a, b) => a.groupName.localeCompare(b.groupName));
    return buckets;
  }, [matchingRecords]);

  return (
    <div className="flex min-h-dvh w-dvw flex-col overflow-y-auto p-3 text-[#e0e0e0]">
      <div className="mb-3 flex items-center justify-end">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search sensors or groups..."
        />
      </div>

      {!isLoading && sensorRecords.length === 0
        ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[#9191a4]">
            <div>
              <div className="mb-2 text-[15px] font-semibold uppercase tracking-[0.06em]">
                No data
              </div>
            </div>
          </div>
        )
        : !isLoading && sortedGroups.length === 0
        ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[#9191a4]">
            <div className="text-[13px]">
              No sensors match <span className="text-[#e0e0e0]">"{query}"</span>.
            </div>
          </div>
        )
        : (
          <div>
            {sortedGroups.map((group) => (
              <GroupSection
                key={group.groupID}
                groupName={group.groupName}
                sensorCount={group.records.length}
              >
                {group.records.map((record) => {
                  const rawTempF = asNumber(record.metadata?.temperature_fahrenheit);
                  const temp = rawTempF === null ? null : normalizeTemperature(rawTempF, "°F", tempUnit);
                  const compressorOn = asString(record.metadata?.compressor_status) === "on";
                  const doorOpen = asString(record.metadata?.door_status) === "open";

                  return (
                    <SensorCard
                      key={record.id ?? `${record.group ?? "sensor"}-${record.time ?? ""}`}
                      name={sensorName(record)}
                      tempValue={temp?.value ?? null}
                      tempUnit={temp?.unit ?? (tempUnit === "C" ? "°C" : "°F")}
                      tempTone={rawTempF === null ? "blue" : tempTone(rawTempF)}
                      compressorOn={compressorOn}
                      doorOpen={doorOpen}
                      time={relativeTime(record.time, now)}
                      isLoading={isLoading}
                    />
                  );
                })}
              </GroupSection>
            ))}
          </div>
        )}
    </div>
  );
}
