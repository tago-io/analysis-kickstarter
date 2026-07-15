import type { ReactNode } from "react";

interface GroupSectionProps {
  groupName: string;
  sensorCountLabel: string;
  children: ReactNode;
}

/**
 * Wraps every sensor card belonging to the same parent group. Header on top
 * shows the group name and a sensor count; the body is a responsive grid
 * the caller fills with sensor cards. The count label is pre-computed by
 * the parent (with the right plural form / translation) and passed in.
 */
export function GroupSection({ groupName, sensorCountLabel, children }: GroupSectionProps) {
  return (
    <section className="mb-4 rounded-md border border-[#3a3a3a] bg-[#252525] p-3">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[rgb(240,240,240)]">
          {groupName}
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[rgb(150,150,150)]">
          {sensorCountLabel}
        </span>
      </header>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {children}
      </div>
    </section>
  );
}
