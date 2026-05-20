import type { ReactNode } from "react";

interface GroupSectionProps {
  groupName: string;
  sensorCount: number;
  children: ReactNode;
}

/**
 * Visual container that wraps every sensor card belonging to the same parent
 * group. The header shows the group name on the left and a discreet sensor
 * count on the right; the body is a generic slot so the caller keeps full
 * control over the cards it renders.
 */
export function GroupSection({ groupName, sensorCount, children }: GroupSectionProps) {
  const sensorLabel = sensorCount === 1 ? "1 sensor" : `${sensorCount} sensors`;

  return (
    <section className="mb-4 rounded-lg border border-[#3a3a40] bg-[#2b2b2b]/40 p-3">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#e0e0e0]">
          {groupName}
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#9191a4]">
          {sensorLabel}
        </span>
      </header>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {children}
      </div>
    </section>
  );
}
