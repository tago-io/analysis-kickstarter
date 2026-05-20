import type { ReactNode } from "react";
import { CardHeader } from "./CardHeader.tsx";

type StatusTone = "green" | "red" | "orange";

const accentBar: Record<StatusTone, string> = {
  green: "bg-[#34c47c]",
  red: "bg-[#e74c3c]",
  orange: "bg-[#f5a623]",
};

const iconBg: Record<StatusTone, string> = {
  green: "bg-[rgba(52,196,124,0.15)] text-[#34c47c]",
  red: "bg-[rgba(231,76,60,0.15)] text-[#e74c3c]",
  orange: "bg-[rgba(245,166,35,0.15)] text-[#f5a623]",
};

const badge: Record<StatusTone, string> = {
  green: "bg-[rgba(52,196,124,0.12)] text-[#34c47c]",
  red: "bg-[rgba(231,76,60,0.12)] text-[#e74c3c]",
  orange: "bg-[rgba(245,166,35,0.12)] text-[#f5a623]",
};

interface StatusCardProps {
  title: string;
  time: string;
  tone: StatusTone;
  badgeText: string;
  icon: ReactNode;
  isLoading: boolean;
}

export function StatusCard({ title, time, tone, badgeText, icon, isLoading }: StatusCardProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#3a3a40] bg-[#2b2b2f] p-4 transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
      <span className={`absolute inset-x-0 top-0 h-[3px] rounded-t-2xl ${accentBar[tone]}`} />

      <CardHeader title={title} dotColor={tone} time={time} />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(8px,1vw,14px)] pt-1 pb-0">
        <div
          className={`flex aspect-square w-[clamp(56px,7vw,96px)] shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${iconBg[tone]}`}
        >
          {icon}
        </div>
        <span
          className={`rounded-full px-[clamp(12px,1.2vw,20px)] py-[clamp(2px,0.3vw,6px)] text-[clamp(13px,1.2vw,18px)] font-bold uppercase tracking-[0.04em] ${badge[tone]} ${
            isLoading ? "crm-shimmer" : ""
          }`}
        >
          {badgeText}
        </span>
      </div>
    </div>
  );
}
