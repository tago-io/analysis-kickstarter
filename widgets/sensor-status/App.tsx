import { type TDataRecord, useWidgetData } from "@tago-io/custom-widget-react";
import { SensorCard } from "./components/SensorCard.tsx";
import { ActiveIcon, InactiveIcon, RegisteredIcon } from "./components/icons.tsx";

const SUMMARY_VARIABLE = "device_connectivity_summary";

interface ConnectivityCounts {
  registered: number | null;
  active: number | null;
  inactive: number | null;
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

function readCounts(records: TDataRecord[]): ConnectivityCounts {
  const summary = records.find((r) => r.variable === SUMMARY_VARIABLE);
  const meta = (summary?.metadata ?? {}) as Record<string, unknown>;
  return {
    registered: toNumber(meta.total_registered),
    active: toNumber(meta.online),
    inactive: toNumber(meta.offline),
  };
}

export default function App() {
  const { isLoading, records } = useWidgetData();
  const { registered, active, inactive } = readCounts(records);

  return (
    <div className="h-dvh w-dvw p-4 text-[#e0e0e0]">
      <div className="grid h-full w-full grid-cols-1 gap-4 sm:grid-cols-3">
        <SensorCard
          variant="registered"
          label="Registered Sensor(s)"
          subtitle="Total devices registered"
          value={registered}
          isLoading={isLoading}
          icon={<RegisteredIcon />}
        />
        <SensorCard
          variant="active"
          label="Active Sensor(s)"
          subtitle="Sending data now"
          value={active}
          isLoading={isLoading}
          icon={<ActiveIcon />}
        />
        <SensorCard
          variant="inactive"
          label="Inactive Sensor(s)"
          subtitle="Not sending data"
          value={inactive}
          isLoading={isLoading}
          icon={<InactiveIcon />}
        />
      </div>
    </div>
  );
}
