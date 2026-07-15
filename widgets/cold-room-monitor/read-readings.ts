import type { TDataRecord } from "@tago-io/custom-widget-react";

export interface TemperatureReading {
  value: number | null;
  rawUnit: string | undefined;
  recordedAt: string | undefined;
}

/**
 * A binary state coming from a TagoIO record whose payload is encoded as a
 * fixed string enum (see `cold_room_card_data.jsonc` for the canonical
 * example):
 *
 * - compressor → `"on" | "off"`
 * - door → `"open" | "closed"`
 *
 * `present` is `true` only when the record exists AND its value matches one
 * of the two strings of the matching enum (case-insensitive, trimmed).
 * Anything else — record missing, value outside the enum, wrong type —
 * resolves to `{ present: false, on: false }` so the widget can render an
 * unambiguous "N/A" instead of silently reporting an "off" state.
 */
export interface BinaryReading {
  present: boolean;
  on: boolean;
  recordedAt: string | undefined;
}

export interface Readings {
  temperature: TemperatureReading;
  compressor: BinaryReading;
  door: BinaryReading;
}

function find(records: TDataRecord[], variable: string): TDataRecord | undefined {
  return records.find((r) => r.variable === variable);
}

function asString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim().toLowerCase();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function readBinary(record: TDataRecord | undefined, onValue: string, offValue: string): BinaryReading {
  if (!record) {
    return { present: false, on: false, recordedAt: undefined };
  }
  const raw = asString(record.value);
  if (raw === onValue) {
    return { present: true, on: true, recordedAt: record.time as string | undefined };
  }
  if (raw === offValue) {
    return { present: true, on: false, recordedAt: record.time as string | undefined };
  }
  return { present: false, on: false, recordedAt: record.time as string | undefined };
}

export function readReadings(records: TDataRecord[]): Readings {
  const tempRec = find(records, "temperature");
  return {
    temperature: {
      value: asNumber(tempRec?.value),
      rawUnit: tempRec?.unit,
      recordedAt: tempRec?.time as string | undefined,
    },
    compressor: readBinary(find(records, "compressor"), "on", "off"),
    door: readBinary(find(records, "door"), "open", "closed"),
  };
}
