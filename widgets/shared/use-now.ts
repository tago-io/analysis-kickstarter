import { useEffect, useState } from "react";

/**
 * React hook that returns the current epoch time (ms) and re-renders the caller
 * on a fixed interval, so time-derived UI (like relative-time labels) stays fresh
 * without waiting for new widget data to arrive.
 *
 * The initial value is captured once on mount via `Date.now()`. A `setInterval`
 * then updates it every `intervalMs`, and the interval is cleared on unmount or
 * when `intervalMs` changes.
 *
 * Typical use: combine with `relativeTime(record.time, now)` to refresh
 * "— 12m ago" style labels every 30 seconds.
 *
 * @param intervalMs - Refresh interval in milliseconds. Defaults to 30_000 (30s).
 * @returns Current timestamp in ms since epoch, updated on each interval tick.
 */
export function useNow(intervalMs: number = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
