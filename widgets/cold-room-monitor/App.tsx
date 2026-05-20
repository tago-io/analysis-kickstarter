import { type TDataRecord, useUserInformation, useWidgetData } from "@tago-io/custom-widget-react";
import { StatusCard } from "./components/StatusCard.tsx";
import { TemperatureGauge } from "./components/TemperatureGauge.tsx";
import { DoorIcon, PowerIcon } from "./components/icons.tsx";
import { gaugeRange, normalizeTemperature, resolveTempUnit } from "../shared/temperature.ts";
import { relativeTime } from "../shared/relative-time.ts";
import { useNow } from "../shared/use-now.ts";

function findRecord(records: TDataRecord[], variable: string): TDataRecord | undefined {
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

export default function App() {
  const { isLoading, records } = useWidgetData();
  const { customPreferences } = useUserInformation();
  const now = useNow(30_000);

  const tempUnit = resolveTempUnit(customPreferences);
  const range = gaugeRange(tempUnit);

  const tempRec = findRecord(records, "temperature");
  const compRec = findRecord(records, "compressor");
  const doorRec = findRecord(records, "door");

  const tempRaw = asNumber(tempRec?.value);
  const temp = tempRaw === null ? null : normalizeTemperature(tempRaw, tempRec?.unit, tempUnit);

  const compOn = asString(compRec?.value) === "on";
  const doorOpen = asString(doorRec?.value) === "open";

  return (
    <div className="grid h-dvh w-dvw grid-cols-1 gap-3 overflow-hidden p-3 text-[#e0e0e0] [grid-auto-rows:minmax(0,1fr)] md:grid-cols-3 md:[grid-auto-rows:auto]">
      <TemperatureGauge
        value={temp?.value ?? null}
        unit={temp?.unit ?? (tempUnit === "C" ? "°C" : "°F")}
        min={range.min}
        max={range.max}
        time={relativeTime(tempRec?.time, now)}
        isLoading={isLoading}
      />
      <StatusCard
        title="Compressor Status"
        time={relativeTime(compRec?.time)}
        tone={compOn ? "green" : "red"}
        badgeText={compOn ? "ON" : "OFF"}
        icon={<PowerIcon />}
        isLoading={isLoading}
      />
      <StatusCard
        title="Door Status"
        time={relativeTime(doorRec?.time)}
        tone={doorOpen ? "orange" : "green"}
        badgeText={doorOpen ? "OPEN" : "CLOSED"}
        icon={<DoorIcon />}
        isLoading={isLoading}
      />
    </div>
  );
}
