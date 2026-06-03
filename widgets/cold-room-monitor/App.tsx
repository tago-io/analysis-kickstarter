import { useUserInformation, useWidgetData } from "@tago-io/custom-widget-react";
import { useMemo } from "react";
import { readReadings } from "./read-readings.ts";
import { normalizeTemperature, resolveTempUnit, tempTone } from "../shared/temperature.ts";
import { relativeTime } from "../shared/relative-time.ts";
import { useNow } from "../shared/use-now.ts";
import { useDictionary } from "../shared/use-dictionary.ts";
import { RingCard } from "./components/RingCard.tsx";
import { DoorIcon, DoorOpenIcon, PowerIcon, ThermometerIcon } from "./components/icons.tsx";

const COLD_BLUE = "rgb(91,141,238)";
const OK_GREEN = "rgb(82,196,140)";
const WARN_ORANGE = "rgb(245,166,35)";
const DANGER_RED = "rgb(231,76,60)";
const MUTED = "rgb(120,120,120)";

const TONE_TO_COLOR = {
  blue: COLD_BLUE,
  green: OK_GREEN,
  orange: WARN_ORANGE,
  red: DANGER_RED,
} as const;

const WIDGET_KEYS = [
  "WIDGET_TEMPERATURE",
  "WIDGET_COMPRESSOR",
  "WIDGET_DOOR",
  "WIDGET_STATUS_ON",
  "WIDGET_STATUS_OFF",
  "WIDGET_STATUS_OPEN",
  "WIDGET_STATUS_CLOSED",
  "WIDGET_STATUS_NA",
  "WIDGET_TIME_AGO_FEW_SECONDS",
  "WIDGET_TIME_AGO_SECONDS",
  "WIDGET_TIME_AGO_MINUTES",
  "WIDGET_TIME_AGO_HOURS",
] as const;

const EN_BASELINE: Record<string, string> = {
  WIDGET_TEMPERATURE: "Temperature",
  WIDGET_COMPRESSOR: "Compressor",
  WIDGET_DOOR: "Door",
  WIDGET_STATUS_ON: "ON",
  WIDGET_STATUS_OFF: "OFF",
  WIDGET_STATUS_OPEN: "OPEN",
  WIDGET_STATUS_CLOSED: "CLOSED",
  WIDGET_STATUS_NA: "N/A",
  WIDGET_TIME_AGO_FEW_SECONDS: "— a few seconds ago",
  WIDGET_TIME_AGO_SECONDS: "— {n}s ago",
  WIDGET_TIME_AGO_MINUTES: "— {n}m ago",
  WIDGET_TIME_AGO_HOURS: "— {n}h ago",
};

export default function App() {
  const { isLoading, records } = useWidgetData();
  const { customPreferences } = useUserInformation();
  const { t } = useDictionary(WIDGET_KEYS, { baseline: EN_BASELINE });
  const now = useNow(30_000);

  const readings = readReadings(records);
  const tempUnit = resolveTempUnit(customPreferences);

  const tempNormalized = readings.temperature.value == null ? null : normalizeTemperature(readings.temperature.value, readings.temperature.rawUnit, tempUnit);

  // Tone picked off the Fahrenheit value (per the helper's contract).
  const tempInF = readings.temperature.value == null ? null : normalizeTemperature(readings.temperature.value, readings.temperature.rawUnit, "F").value;
  const tempColor = tempInF == null ? MUTED : TONE_TO_COLOR[tempTone(tempInF)];

  const naLabel = t("WIDGET_STATUS_NA");
  // Transient "—" only on the very first paint; once the SDK confirms no
  // record exists, render "N/A" so the operator can't mistake a sensor
  // outage for a healthy reading.
  const tempValue = isLoading && tempNormalized == null ? "—" : tempNormalized == null ? naLabel : `${tempNormalized.value.toFixed(1)}${tempNormalized.unit}`;

  const compColor = !readings.compressor.present ? MUTED : readings.compressor.on ? OK_GREEN : DANGER_RED;
  const doorColor = !readings.door.present ? MUTED : readings.door.on ? DANGER_RED : OK_GREEN;

  const compLabel = !readings.compressor.present ? naLabel : readings.compressor.on ? t("WIDGET_STATUS_ON") : t("WIDGET_STATUS_OFF");
  const doorLabel = !readings.door.present ? naLabel : readings.door.on ? t("WIDGET_STATUS_OPEN") : t("WIDGET_STATUS_CLOSED");

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
      className="scroll-y-visible @container/widget h-dvh w-dvw overflow-x-hidden overflow-y-auto bg-[rgb(43,43,43)] p-2"
      style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}
    >
      <div className="grid min-h-full w-full grid-cols-1 gap-2 @[400px]/widget:h-full @[400px]/widget:grid-cols-3">
        <RingCard
          label={t("WIDGET_TEMPERATURE")}
          value={tempValue}
          subtitle={relativeTime(readings.temperature.recordedAt, now, timeTemplates)}
          ringContent={
            <span style={{ color: tempColor }}>
              <ThermometerIcon />
            </span>
          }
        />
        <RingCard
          label={t("WIDGET_COMPRESSOR")}
          value={<span style={{ color: compColor }}>{compLabel}</span>}
          subtitle={relativeTime(readings.compressor.recordedAt, now, timeTemplates)}
          ringContent={
            <span style={{ color: compColor }}>
              <PowerIcon />
            </span>
          }
        />
        <RingCard
          label={t("WIDGET_DOOR")}
          value={<span style={{ color: doorColor }}>{doorLabel}</span>}
          subtitle={relativeTime(readings.door.recordedAt, now, timeTemplates)}
          ringContent={
            <span style={{ color: doorColor }}>
              {readings.door.present && readings.door.on ? <DoorOpenIcon /> : <DoorIcon />}
            </span>
          }
        />
      </div>
    </div>
  );
}
