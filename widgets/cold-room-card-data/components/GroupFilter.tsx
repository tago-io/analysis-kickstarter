import { useEffect, useRef, useState } from "react";

interface GroupOption {
  id: string;
  name: string;
  count: number;
}

interface GroupFilterLabels {
  trigger: string;
  ariaFilterBy: string;
  selectAll: string;
  clear: string;
  empty: string;
}

interface GroupFilterProps {
  groups: GroupOption[];
  selectedIDs: Set<string>;
  onChange: (next: Set<string>) => void;
  labels?: GroupFilterLabels;
}

const DEFAULT_LABELS: GroupFilterLabels = {
  trigger: "Groups",
  ariaFilterBy: "Filter by group",
  selectAll: "Select all",
  clear: "Clear",
  empty: "No groups available.",
};

/**
 * Multi-select group filter. Mirrors the visual language of SearchBar:
 * collapsed pill button → popover with checkbox list. Closes on outside
 * click and on Escape.
 */
export function GroupFilter({ groups, selectedIDs, onChange, labels = DEFAULT_LABELS }: GroupFilterProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleMouseDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const total = groups.length;
  const selectedCount = selectedIDs.size;
  const isAllSelected = total > 0 && selectedCount === total;

  function toggle(id: string) {
    const next = new Set(selectedIDs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(groups.map((g) => g.id)));
  }

  function clear() {
    onChange(new Set());
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={labels.ariaFilterBy}
        className="flex items-center gap-2 rounded-full border border-[#3a3a3a] bg-[#252525] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[rgb(150,150,150)] transition-colors hover:border-[rgb(91,141,238)] hover:text-[rgb(240,240,240)]"
      >
        <FilterIcon />
        <span>{labels.trigger}</span>
        {!isAllSelected && total > 0
          ? (
            <span className="rounded-full bg-[rgb(91,141,238)] px-1.5 text-[10px] font-semibold text-white">
              {selectedCount}/{total}
            </span>
          )
          : null}
      </button>

      {open
        ? (
          <div className="absolute left-0 top-[calc(100%+6px)] z-10 w-[260px] rounded-md border border-[#3a3a3a] bg-[#252525] p-2 shadow-lg">
            {total === 0
              ? (
                <div className="px-2 py-3 text-[12px] text-[rgb(150,150,150)]">
                  {labels.empty}
                </div>
              )
              : (
                <>
                  <div className="mb-1 flex items-center justify-between px-1 pb-1">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(150,150,150)] transition-colors hover:text-[rgb(91,141,238)]"
                    >
                      {labels.selectAll}
                    </button>
                    <button
                      type="button"
                      onClick={clear}
                      className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(150,150,150)] transition-colors hover:text-[rgb(231,76,60)]"
                    >
                      {labels.clear}
                    </button>
                  </div>
                  <ul className="max-h-[260px] overflow-y-auto">
                    {groups.map((g) => (
                      <li key={g.id}>
                        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-1 py-1 text-[13px] text-[rgb(240,240,240)] hover:bg-[#2c2c2c]">
                          <span className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedIDs.has(g.id)}
                              onChange={() => toggle(g.id)}
                              className="h-3.5 w-3.5 shrink-0 accent-[rgb(91,141,238)]"
                            />
                            <span className="truncate" title={g.name}>{g.name}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-[rgb(150,150,150)]">{g.count}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
          </div>
        )
        : null}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      role="img"
      aria-label="Filter icon"
    >
      <title>Filter</title>
      <path d="M3 5h18l-7 9v5l-4 2v-7L3 5Z" />
    </svg>
  );
}
