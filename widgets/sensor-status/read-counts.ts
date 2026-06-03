import type { TDataRecord } from "@tago-io/custom-widget-react";

export const SUMMARY_VARIABLE = "device_connectivity_summary";

export interface ConnectivityCounts {
  registered: number | null;
  online: number | null;
  offline: number | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function readCounts(records: TDataRecord[]): ConnectivityCounts {
  const summary = records.find((r) => r.variable === SUMMARY_VARIABLE);
  const meta = (summary?.metadata ?? {}) as Record<string, unknown>;
  return {
    registered: toNumber(meta.total_registered),
    online: toNumber(meta.online),
    offline: toNumber(meta.offline),
  };
}
