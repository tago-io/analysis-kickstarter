export interface RelativeTimeTemplates {
  /** Used for missing/invalid input and diffs < 10 seconds. */
  fewSeconds: string;
  /** Seconds template — must contain `{n}`. */
  seconds: string;
  /** Minutes template — must contain `{n}`. */
  minutes: string;
  /** Hours template — must contain `{n}`. */
  hours: string;
}

const DEFAULT_TEMPLATES: RelativeTimeTemplates = {
  fewSeconds: "— a few seconds ago",
  seconds: "— {n}s ago",
  minutes: "— {n}m ago",
  hours: "— {n}h ago",
};

/**
 * Formats an ISO timestamp as a short relative-time label (e.g. "— 5s ago",
 * "— 12m ago", "— 3h ago").
 *
 * Buckets:
 * - Missing/invalid input or diff < 10s → `templates.fewSeconds`
 * - < 60s   → `templates.seconds` (with `{n}` substituted)
 * - < 1h    → `templates.minutes`
 * - >= 1h   → `templates.hours`
 *
 * Pair with `useNow()` to make the label refresh on a fixed interval.
 *
 * @param iso - ISO-8601 timestamp from a TagoIO data record (`record.time`).
 * @param now - Reference "current time" in ms since epoch. Defaults to `Date.now()`.
 * @param templates - Optional translated templates. Defaults to English.
 */
export function relativeTime(
  iso: string | undefined | null,
  now: number = Date.now(),
  templates: RelativeTimeTemplates = DEFAULT_TEMPLATES,
): string {
  if (!iso) {
    return templates.fewSeconds;
  }
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) {
    return templates.fewSeconds;
  }
  const diff = Math.floor((now - t) / 1000);
  if (diff < 10) {
    return templates.fewSeconds;
  }
  if (diff < 60) {
    return templates.seconds.replaceAll("{n}", String(diff));
  }
  if (diff < 3600) {
    return templates.minutes.replaceAll("{n}", String(Math.floor(diff / 60)));
  }
  return templates.hours.replaceAll("{n}", String(Math.floor(diff / 3600)));
}
