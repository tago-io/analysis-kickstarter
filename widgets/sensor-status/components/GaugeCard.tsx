interface GaugeCardProps {
  label: string;
  subtitle: string;
  value: number | null;
  ratio: number;
  color: string;
  isLoading: boolean;
}

const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function GaugeCard({ label, subtitle, value, ratio, color, isLoading }: GaugeCardProps) {
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const dashOffset = CIRCUMFERENCE * (1 - safeRatio);
  // Transient "—" while the SDK is fetching; permanent "N/A" once it confirms
  // the record/field is absent. Numbers are rendered with their tabular form.
  const display = isLoading ? "—" : (value ?? "N/A");

  return (
    <div className="@max-[400px]/widget:min-h-[140px] relative flex min-w-0 flex-col gap-1.5 rounded-lg border border-[#3a3a3a] bg-[#252525] p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate uppercase text-[rgb(170,170,170)]"
          style={{ fontSize: "clamp(10px, 2.4cqi, 12px)", letterSpacing: "0.05em", fontWeight: 600 }}
        >
          {label}
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="relative" style={{ width: "clamp(56px, 18cqi, 88px)", aspectRatio: "1 / 1" }}>
          <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
            <circle cx="28" cy="28" r={RADIUS} fill="none" stroke="#404040" strokeWidth="4" />
            <circle
              cx="28"
              cy="28"
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 300ms ease" }}
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-[rgb(240,240,240)]"
            style={{ fontSize: "clamp(16px, 5cqi, 26px)", lineHeight: 1 }}
          >
            {display}
          </span>
        </div>
      </div>
      <span
        className="truncate text-center text-[rgb(170,170,170)]"
        style={{ fontSize: "clamp(10px, 2.2cqi, 12px)" }}
      >
        {subtitle}
      </span>
    </div>
  );
}
