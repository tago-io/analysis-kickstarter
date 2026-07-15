// Stroke-based monochrome icons sized via 1em so they inherit
// font-size from the wrapping element. Color flows from currentColor.

export function ThermometerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* Outline: cap → narrow stem → single bulb */}
      <path d="M12 3.5a2 2 0 0 1 2 2v8.6a3.5 3.5 0 1 1-4 0V5.5a2 2 0 0 1 2-2z" />
      {/* Mercury (single filled shape — column flowing into bulb) */}
      <path d="M11.1 8.5h1.8v6.6a2 2 0 1 1-1.8 0z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PowerIcon() {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v6" />
      <path d="M4.4 4.7a5 5 0 1 0 7.2 0" />
    </svg>
  );
}

export function DoorIcon() {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="2.5" width="9" height="11" rx="0.5" />
      <circle cx="10.5" cy="8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DoorOpenIcon() {
  // Door swinging outward: a static frame on the right + the door leaf
  // tilted to the left, with a handle near its leading edge.
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* Floor / threshold */}
      <path d="M2 13.5h12" />
      {/* Door frame (right jamb) */}
      <path d="M12.5 2.5v11" />
      {/* Open leaf — angled outward, hinged at the top-right */}
      <path d="M12.5 2.5 4 4v9.5l8.5-1.5" />
      {/* Handle */}
      <circle cx="5.6" cy="9" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
