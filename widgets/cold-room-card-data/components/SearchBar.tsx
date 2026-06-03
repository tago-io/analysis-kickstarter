import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  ariaOpenLabel?: string;
  ariaCloseLabel?: string;
  ariaInputLabel?: string;
}

/**
 * Collapsible search input. Starts as a compact pill button and expands to
 * a full-width input on click. Escape closes it; the close button clears
 * the value. Shared across every redesign variant.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search sensors or groups...",
  label = "Search",
  ariaOpenLabel = "Open search",
  ariaCloseLabel = "Close search",
  ariaInputLabel = "Search sensors or groups by name",
}: SearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  function close() {
    onChange("");
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 rounded-full border border-[#3a3a3a] bg-[#252525] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[rgb(150,150,150)] transition-colors hover:border-[rgb(91,141,238)] hover:text-[rgb(240,240,240)]"
        aria-label={ariaOpenLabel}
      >
        <SearchIcon />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="flex w-full max-w-[320px] items-center gap-2 rounded-full border border-[rgb(91,141,238)] bg-[#252525] px-3 py-1.5 transition-all">
      <SearchIcon />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            close();
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[13px] text-[rgb(240,240,240)] placeholder:text-[rgb(120,120,120)] focus:outline-none"
        aria-label={ariaInputLabel}
      />
      <button
        type="button"
        onClick={close}
        className="text-[rgb(150,150,150)] transition-colors hover:text-[rgb(231,76,60)]"
        aria-label={ariaCloseLabel}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function SearchIcon() {
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
      aria-label="Search icon"
    >
      <title>Search</title>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CloseIcon() {
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
      aria-label="Close icon"
    >
      <title>Close</title>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
