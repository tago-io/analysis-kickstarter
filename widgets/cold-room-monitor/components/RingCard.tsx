import type { ReactNode } from "react";

interface RingCardProps {
  label: string;
  value: ReactNode;
  subtitle: string;
  /** Inline content rendered above the value (typically the state icon). */
  ringContent: ReactNode;
}

// Despite the file name, this card no longer draws a ring — the team asked
// to drop the SVG circle in favour of a cleaner icon + value layout.
// The file/folder name is kept so import paths don't shift.

export function RingCard({ label, value, subtitle, ringContent }: RingCardProps) {
  return (
    <div className="@max-[400px]/widget:min-h-[140px] grid min-w-0 grid-rows-[auto_1fr] gap-2 rounded-lg border border-[#3a3a3a] bg-[#252525] p-3">
      {/* Header — label on the left, last-update timestamp on the right */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span
          className="truncate uppercase text-[rgb(175,175,175)]"
          style={{ fontSize: "clamp(10px, 2.4cqi, 12px)", letterSpacing: "0.06em", fontWeight: 600 }}
        >
          {label}
        </span>
        <span
          className="shrink-0 truncate text-[rgb(150,150,150)]"
          style={{ fontSize: "clamp(10px, 2.2cqi, 12px)" }}
        >
          {subtitle}
        </span>
      </div>

      {/* Middle — icon + value centred */}
      <div className="flex min-h-0 flex-col items-center justify-center gap-3 text-center" style={{ color: "rgb(245,245,245)" }}>
        <span aria-hidden style={{ fontSize: "clamp(28px, 9cqi, 48px)", lineHeight: 1 }}>
          {ringContent}
        </span>
        <span
          className="font-semibold tabular-nums leading-none"
          style={{ fontSize: "clamp(18px, 5.5cqi, 28px)" }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
