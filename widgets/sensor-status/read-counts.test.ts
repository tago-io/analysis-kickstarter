import { assertEquals } from "@std/assert";
import type { TDataRecord } from "@tago-io/custom-widget-react";
import { readCounts, SUMMARY_VARIABLE } from "./read-counts.ts";

function record(metadata: Record<string, unknown>): TDataRecord {
  return {
    id: "id",
    variable: SUMMARY_VARIABLE,
    value: 0,
    metadata,
    time: new Date().toISOString(),
    device: "device-id",
  } as unknown as TDataRecord;
}

Deno.test("readCounts pulls numeric fields out of metadata", () => {
  const records = [record({ total_registered: 24, online: 21, offline: 3 })];
  assertEquals(readCounts(records), { registered: 24, online: 21, offline: 3 });
});

Deno.test("readCounts parses numeric strings", () => {
  const records = [record({ total_registered: "24", online: "21", offline: "3" })];
  assertEquals(readCounts(records), { registered: 24, online: 21, offline: 3 });
});

Deno.test("readCounts returns null for missing / invalid fields", () => {
  const records = [record({ total_registered: "abc", online: undefined })];
  assertEquals(readCounts(records), { registered: null, online: null, offline: null });
});

Deno.test("readCounts returns nulls when summary record is absent", () => {
  assertEquals(readCounts([]), { registered: null, online: null, offline: null });
});
