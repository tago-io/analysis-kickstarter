/**
 * Formats an ISO timestamp as a short relative-time label (e.g. "— 5s ago", "— 12m ago", "— 3h ago").
 *
 * Buckets:
 * - Missing/invalid input or diff < 10s → "— a few seconds ago"
 * - < 60s   → seconds ago
 * - < 1h    → minutes ago
 * - >= 1h   → hours ago
 *
 * Pair with `useNow()` to make the label refresh on a fixed interval (the widget
 * re-renders when `now` changes, otherwise the string would stay frozen).
 *
 * @param iso - ISO-8601 timestamp from a TagoIO data record (`record.time`). Accepts null/undefined for empty records.
 * @param now - Reference "current time" in ms since epoch. Defaults to `Date.now()`; pass the value from `useNow()` for auto-refreshing UIs.
 * @returns Human-readable relative time prefixed with an em-dash separator.
 */
export function relativeTime(iso: string | undefined | null, now: number = Date.now()): string {
  if (!iso) {
    return "— a few seconds ago";
  }
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) {
    return "— a few seconds ago";
  }
  const diff = Math.floor((now - t) / 1000);
  if (diff < 10) {
    return "— a few seconds ago";
  }
  if (diff < 60) {
    return `— ${diff}s ago`;
  }
  if (diff < 3600) {
    return `— ${Math.floor(diff / 60)}m ago`;
  }
  return `— ${Math.floor(diff / 3600)}h ago`;
}
