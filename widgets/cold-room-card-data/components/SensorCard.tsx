import { CardHeader } from "./CardHeader.tsx";
import { DoorIcon, PowerIcon } from "./icons.tsx";

type Tone = "green" | "red" | "orange" | "blue";

const accentBar: Record<Tone, string> = {
  green: "bg-[#34c47c]",
  red: "bg-[#e74c3c]",
  orange: "bg-[#f5a623]",
  blue: "bg-gradient-to-r from-[#5b8dee] to-[#a78bfa]",
};

const iconBg: Record<Tone, string> = {
  green: "bg-[rgba(52,196,124,0.15)] text-[#34c47c]",
  red: "bg-[rgba(231,76,60,0.15)] text-[#e74c3c]",
  orange: "bg-[rgba(245,166,35,0.15)] text-[#f5a623]",
  blue: "bg-[rgba(91,141,238,0.15)] text-[#5b8dee]",
};

const tempColor: Record<Tone, string> = {
  green: "text-[#34c47c]",
  red: "text-[#e74c3c]",
  orange: "text-[#f5a623]",
  blue: "text-[#5b8dee]",
};

const pillBadge: Record<Tone, string> = {
  green: "bg-[rgba(52,196,124,0.12)] text-[#34c47c]",
  red: "bg-[rgba(231,76,60,0.12)] text-[#e74c3c]",
  orange: "bg-[rgba(245,166,35,0.12)] text-[#f5a623]",
  blue: "bg-[rgba(91,141,238,0.12)] text-[#5b8dee]",
};

interface SensorCardProps {
  name: string;
  tempValue: number | null;
  tempUnit: "°F" | "°C";
  tempTone: Tone;
  compressorOn: boolean;
  doorOpen: boolean;
  time: string;
  isLoading: boolean;
}

export function SensorCard({
  name,
  tempValue,
  tempUnit,
  tempTone,
  compressorOn,
  doorOpen,
  time,
  isLoading,
}: SensorCardProps) {
  const compressorTone: Tone = compressorOn ? "green" : "red";
  const doorTone: Tone = doorOpen ? "orange" : "green";
  const accentTone = worstTone([tempTone, compressorTone, doorTone]);
  const headerDot: Tone = accentTone;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#3a3a40] bg-[#2b2b2f] p-4 transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
      <span className={`absolute inset-x-0 top-0 h-[3px] rounded-t-2xl ${accentBar[accentTone]}`} />

      <CardHeader title={name} dotColor={headerDot} time={time} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-1 flex-col items-center justify-center sm:items-start">
          <div
            className={`text-[clamp(32px,4vw,48px)] font-bold leading-none tracking-[-1px] ${isLoading || tempValue === null ? "text-[#444] so-shimmer" : tempColor[tempTone]}`}
          >
            {tempValue === null ? "—" : tempValue.toFixed(1)}
            <sup className="ml-0.5 align-super text-[0.4em] font-semibold tracking-normal text-[#9191a4]">
              {tempUnit}
            </sup>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.05em] text-[#62627a]">
            Temperature
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-around gap-3 sm:flex-col sm:items-stretch sm:justify-center sm:gap-2">
          <StatusPill
            icon={<PowerIcon />}
            label={compressorOn ? "ON" : "OFF"}
            tone={compressorTone}
            isLoading={isLoading}
          />
          <StatusPill
            icon={<DoorIcon />}
            label={doorOpen ? "OPEN" : "CLOSED"}
            tone={doorTone}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

interface StatusPillProps {
  icon: React.ReactNode;
  label: string;
  tone: Tone;
  isLoading: boolean;
}

function StatusPill({ icon, label, tone, isLoading }: StatusPillProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex aspect-square w-[clamp(34px,3.2vw,42px)] shrink-0 items-center justify-center rounded-full ${iconBg[tone]}`}
      >
        {icon}
      </div>
      <span
        className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-[0.04em] ${pillBadge[tone]} ${isLoading ? "so-shimmer" : ""}`}
      >
        {label}
      </span>
    </div>
  );
}

const tonePriority: Record<Tone, number> = { red: 3, orange: 2, blue: 1, green: 0 };

function worstTone(tones: Tone[]): Tone {
  return tones.reduce((worst, t) => (tonePriority[t] > tonePriority[worst] ? t : worst), "green" as Tone);
}
