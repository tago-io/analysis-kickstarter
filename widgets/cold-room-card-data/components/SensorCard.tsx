import type { ReactNode } from "react";
import { DoorIcon, DoorOpenIcon, PowerIcon, ThermometerIcon } from "./icons.tsx";

type Tone = "blue" | "green" | "orange" | "red";

const COLD_BLUE = "rgb(91,141,238)";
const OK_GREEN = "rgb(82,196,140)";
const WARN_ORANGE = "rgb(245,166,35)";
const DANGER_RED = "rgb(231,76,60)";
const MUTED = "rgb(120,120,120)";

const TONE_TO_COLOR: Record<Tone, string> = {
  blue: COLD_BLUE,
  green: OK_GREEN,
  orange: WARN_ORANGE,
  red: DANGER_RED,
};

interface SensorCardLabels {
  on: string;
  off: string;
  open: string;
  closed: string;
}

interface SensorCardProps {
  name: string;
  tempValue: number | null;
  tempUnit: "°F" | "°C";
  tempTone: Tone;
  compressorOn: boolean;
  doorOpen: boolean;
  time: string;
  /**
   * Translated state labels (ON/OFF/OPEN/CLOSED). Defaults to English.
   */
  labels?: SensorCardLabels;
  /**
   * Kept in the contract so `App.tsx` doesn't need to change. The new layout
   * has no shimmer / animation, so the value is unused; we still accept it
   * to keep the prop shape stable with the older callers.
   */
  isLoading?: boolean;
}

const DEFAULT_LABELS: SensorCardLabels = {
  on: "ON",
  off: "OFF",
  open: "OPEN",
  closed: "CLOSED",
};

/**
 * Stat Trio sensor card. Header row with the sensor name on the left and
 * the last-update timestamp on the right; body is three equal columns
 * (Temperature / Compressor / Door), each rendering a monochrome icon
 * above a state-coloured value.
 */
export function SensorCard({
  name,
  tempValue,
  tempUnit,
  tempTone,
  compressorOn,
  doorOpen,
  time,
  labels = DEFAULT_LABELS,
}: SensorCardProps) {
  const tempColor = tempValue === null ? MUTED : TONE_TO_COLOR[tempTone];
  const tempLabel = tempValue === null ? "—" : `${tempValue.toFixed(1)}${tempUnit}`;

  const compColor = compressorOn ? OK_GREEN : DANGER_RED;
  const compLabel = compressorOn ? labels.on : labels.off;

  const doorColor = doorOpen ? DANGER_RED : OK_GREEN;
  const doorLabel = doorOpen ? labels.open : labels.closed;

  return (
    <div className="grid min-w-0 grid-rows-[auto_1fr] gap-3 rounded-md border border-[#3a3a3a] bg-[#252525] p-3">
      <header className="flex min-w-0 items-baseline justify-between gap-2">
        <h3
          className="truncate text-[rgb(240,240,240)]"
          style={{ fontSize: "13px", letterSpacing: "0.04em", fontWeight: 600 }}
          title={name}
        >
          {name}
        </h3>
        <span className="shrink-0 truncate text-[11px] text-[rgb(150,150,150)]">{time}</span>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<ThermometerIcon />} color={tempColor} label={tempLabel} />
        <Stat icon={<PowerIcon />} color={compColor} label={compLabel} />
        <Stat
          icon={doorOpen ? <DoorOpenIcon /> : <DoorIcon />}
          color={doorColor}
          label={doorLabel}
        />
      </div>
    </div>
  );
}

function Stat({ icon, color, label }: { icon: ReactNode; color: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-sm bg-[#2c2c2c] p-2 text-center">
      <span aria-hidden style={{ color, fontSize: "20px", lineHeight: 1 }}>
        {icon}
      </span>
      <span className="truncate font-semibold tabular-nums" style={{ color, fontSize: "13px", lineHeight: 1.1 }}>
        {label}
      </span>
    </div>
  );
}
