type DotColor = "blue" | "green" | "red" | "orange";

const dotClass: Record<DotColor, string> = {
  blue: "bg-[#5b8dee] crm-dot-blue",
  green: "bg-[#34c47c] crm-dot-green",
  red: "bg-[#e74c3c] crm-dot-red",
  orange: "bg-[#f5a623] crm-dot-orange",
};

interface CardHeaderProps {
  title: string;
  dotColor: DotColor;
  time: string;
}

export function CardHeader({ title, dotColor, time }: CardHeaderProps) {
  return (
    <>
      <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9191a4]">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass[dotColor]}`} />
        {title}
      </div>
      <div className="mb-4 text-[11px] text-[#55556a]">{time}</div>
    </>
  );
}
