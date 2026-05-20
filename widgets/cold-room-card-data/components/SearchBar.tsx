import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search sensors or groups..." }: SearchBarProps) {
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
        className="flex items-center gap-2 rounded-full border border-[#3a3a40] bg-[#2b2b2f] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#9191a4] transition-colors hover:border-[#5b8dee] hover:text-[#e0e0e0]"
        aria-label="Open search"
      >
        <SearchIcon />
        <span>Search</span>
      </button>
    );
  }

  return (
    <div className="flex w-full max-w-[320px] items-center gap-2 rounded-full border border-[#5b8dee] bg-[#2b2b2f] px-3 py-1.5 transition-all">
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
        className="flex-1 bg-transparent text-[13px] text-[#e0e0e0] placeholder:text-[#62627a] focus:outline-none"
        aria-label="Search sensors or groups by name"
      />
      <button
        type="button"
        onClick={close}
        className="text-[#9191a4] transition-colors hover:text-[#e74c3c]"
        aria-label="Close search"
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
