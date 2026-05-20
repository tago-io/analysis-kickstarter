import { CardHeader } from "./CardHeader.tsx";

const ARC_LENGTH = 251;
const ARC_START_DEG = 200;
const ARC_END_DEG = 340;

interface TemperatureGaugeProps {
  value: number | null;
  unit: "°F" | "°C";
  min: number;
  max: number;
  time: string;
  isLoading: boolean;
}

function angleToXY(angleDeg: number, cx: number, cy: number, r: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function dotColor(valueF: number): string {
  if (valueF <= 0) {
    return "#5b8dee";
  }
  if (valueF <= 20) {
    return "#34c47c";
  }
  if (valueF <= 40) {
    return "#f5a623";
  }
  return "#e74c3c";
}

export function TemperatureGauge({ value, unit, min, max, time, isLoading }: TemperatureGaugeProps) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const filled = pct * ARC_LENGTH;
  const angle = ARC_START_DEG + pct * (ARC_END_DEG - ARC_START_DEG);
  const dot = angleToXY(angle, 100, 110, 80);
  const valueInF = unit === "°C" && value !== null ? value * (9 / 5) + 32 : (value ?? 0);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#3a3a40] bg-[#2b2b2f] p-4 transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
      <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-[#5b8dee] to-[#a78bfa]" />

      <CardHeader title="Temperature" dotColor="blue" time={time} />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
        <svg
          viewBox="0 0 200 130"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          className="h-full max-h-[150px] w-full min-w-0 max-w-[260px]"
          role="img"
          aria-label="Temperature gauge"
        >
          <title>Temperature gauge</title>
          <defs>
            <linearGradient id="crm-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e74c3c" />
              <stop offset="40%" stopColor="#f5a623" />
              <stop offset="100%" stopColor="#5b8dee" />
            </linearGradient>
          </defs>
          <path
            d="M 20 110 A 80 80 0 0 1 180 110"
            fill="none"
            stroke="#3a3a40"
            strokeWidth={16}
            strokeLinecap="round"
          />
          <path
            className="crm-arc-value"
            d="M 20 110 A 80 80 0 0 1 180 110"
            fill="none"
            stroke="url(#crm-arc-grad)"
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${ARC_LENGTH - filled}`}
          />
          <circle
            className="crm-arc-dot"
            cx={dot.x.toFixed(2)}
            cy={dot.y.toFixed(2)}
            r={6}
            fill={dotColor(valueInF)}
            stroke="#2b2b2f"
            strokeWidth={2}
          />
          <text x={20} y={128} textAnchor="middle" fontSize={9} fill="#55556a">{min}</text>
          <text x={180} y={128} textAnchor="middle" fontSize={9} fill="#55556a">{max}</text>
        </svg>

        <div className="shrink-0 text-center">
          <div
            className={`text-[clamp(28px,3.2vw,44px)] font-bold leading-none tracking-[-1px] ${isLoading || value === null ? "text-[#444] crm-shimmer" : "text-[#e5e5e5]"}`}
          >
            {value === null ? "—" : value.toFixed(2)}
            <sup className="ml-0.5 align-super text-[0.4em] font-semibold tracking-normal text-[#9191a4]">
              {unit}
            </sup>
          </div>
          <div className="mt-1 text-[clamp(10px,0.8vw,12px)] tracking-[0.05em] text-[#62627a]">
            Temperature
          </div>
        </div>
      </div>
    </div>
  );
}
