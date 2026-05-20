type Variant = "registered" | "active" | "inactive";

interface SensorCardProps {
  variant: Variant;
  label: string;
  subtitle: string;
  value: number | string | null;
  isLoading: boolean;
  icon: React.ReactNode;
}

const accent: Record<Variant, { bar: string; text: string; iconBg: string; dot: string; dotPulse: boolean }> = {
  registered: {
    bar: "bg-[#5b8dee]",
    text: "text-[#5b8dee]",
    iconBg: "bg-[rgba(91,141,238,0.15)]",
    dot: "bg-[#5b8dee]",
    dotPulse: false,
  },
  active: {
    bar: "bg-[#34c47c]",
    text: "text-[#34c47c]",
    iconBg: "bg-[rgba(52,196,124,0.15)]",
    dot: "bg-[#34c47c]",
    dotPulse: true,
  },
  inactive: {
    bar: "bg-[#f5a623]",
    text: "text-[#f5a623]",
    iconBg: "bg-[rgba(245,166,35,0.15)]",
    dot: "bg-[#f5a623]",
    dotPulse: false,
  },
};

export function SensorCard({ variant, label, subtitle, value, isLoading, icon }: SensorCardProps) {
  const a = accent[variant];
  const display = value ?? "—";

  return (
    <div className="relative flex flex-col items-start gap-3 overflow-hidden rounded-xl border border-[#3a3a40] bg-[#2b2b2f] p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <span className={`absolute inset-x-0 top-0 h-[3px] rounded-t-xl ${a.bar}`} />

      <div className="flex w-full items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9191a4]">
          {label}
        </span>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${a.iconBg} ${a.text}`}>
          {icon}
        </div>
      </div>

      <div
        className={`text-5xl font-bold leading-none tracking-[-2px] ${isLoading ? "text-[#444] animate-sensor-shimmer" : a.text}`}
      >
        {isLoading ? "—" : display}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-[#62627a]">
        <span
          className={`h-[7px] w-[7px] shrink-0 rounded-full ${a.dot} ${a.dotPulse ? "animate-sensor-pulse" : ""}`}
        />
        <span>{subtitle}</span>
      </div>
    </div>
  );
}
