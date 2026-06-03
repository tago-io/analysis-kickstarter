import { assertEquals } from "@std/assert";
import type { TDataRecord } from "@tago-io/custom-widget-react";
import { readReadings } from "./read-readings.ts";

function record(variable: string, value: unknown, unit?: string, time?: string): TDataRecord {
  return {
    id: variable,
    variable,
    value,
    unit,
    time,
    device: "device-id",
  } as unknown as TDataRecord;
}

const T = "2026-01-01T12:00:00Z";

Deno.test("readReadings extracts numeric temperature + binary states", () => {
  const records = [
    record("temperature", -14.4, "°C", T),
    record("compressor", "on", undefined, T),
    record("door", "closed", undefined, T),
  ];
  assertEquals(readReadings(records), {
    temperature: { value: -14.4, rawUnit: "°C", recordedAt: T },
    compressor: { present: true, on: true, recordedAt: T },
    door: { present: true, on: false, recordedAt: T },
  });
});

Deno.test("readReadings is case- and whitespace-insensitive for binaries", () => {
  const records = [
    record("compressor", " OFF ", undefined, T),
    record("door", "OPEN", undefined, T),
  ];
  const out = readReadings(records);
  assertEquals(out.compressor, { present: true, on: false, recordedAt: T });
  assertEquals(out.door, { present: true, on: true, recordedAt: T });
});

Deno.test("readReadings parses stringified numeric temperatures", () => {
  const records = [record("temperature", "5.25", "°F", T)];
  assertEquals(readReadings(records).temperature, { value: 5.25, rawUnit: "°F", recordedAt: T });
});

Deno.test("readReadings returns nulls / false defaults when records are missing", () => {
  assertEquals(readReadings([]), {
    temperature: { value: null, rawUnit: undefined, recordedAt: undefined },
    compressor: { present: false, on: false, recordedAt: undefined },
    door: { present: false, on: false, recordedAt: undefined },
  });
});

Deno.test("readReadings flags binary records with out-of-enum values as not present", () => {
  const records = [
    record("compressor", "running", undefined, T),
    record("door", "ajar", undefined, T),
  ];
  const out = readReadings(records);
  // The records are there (timestamp preserved) but the values fall outside
  // the expected enums, so the widget should render N/A instead of OFF/CLOSED.
  assertEquals(out.compressor, { present: false, on: false, recordedAt: T });
  assertEquals(out.door, { present: false, on: false, recordedAt: T });
});
