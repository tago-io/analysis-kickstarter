import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { relativeTime } from "./relative-time.ts";

describe("relativeTime function", () => {
  const NOW = new Date("2026-05-20T12:00:00.000Z").getTime();

  it("should return placeholder for null input", () => {
    assertEquals(relativeTime(null, NOW), "— a few seconds ago");
  });

  it("should return placeholder for undefined input", () => {
    assertEquals(relativeTime(undefined, NOW), "— a few seconds ago");
  });

  it("should return placeholder for empty string", () => {
    assertEquals(relativeTime("", NOW), "— a few seconds ago");
  });

  it("should return placeholder for invalid ISO string", () => {
    assertEquals(relativeTime("not-a-date", NOW), "— a few seconds ago");
  });

  it("should return placeholder for diff under 10 seconds", () => {
    const iso = new Date(NOW - 5_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— a few seconds ago");
  });

  it("should return placeholder exactly at 9 seconds", () => {
    const iso = new Date(NOW - 9_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— a few seconds ago");
  });

  it("should return seconds-ago label between 10s and 59s", () => {
    const iso = new Date(NOW - 30_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— 30s ago");
  });

  it("should return seconds-ago label at 10s boundary", () => {
    const iso = new Date(NOW - 10_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— 10s ago");
  });

  it("should return minutes-ago label between 60s and 3599s", () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— 5m ago");
  });

  it("should return minutes-ago label at 60s boundary", () => {
    const iso = new Date(NOW - 60_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— 1m ago");
  });

  it("should floor minutes (90s becomes 1m)", () => {
    const iso = new Date(NOW - 90_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— 1m ago");
  });

  it("should return hours-ago label at 1h", () => {
    const iso = new Date(NOW - 3_600_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— 1h ago");
  });

  it("should return hours-ago label for multi-hour diffs", () => {
    const iso = new Date(NOW - 5 * 3_600_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— 5h ago");
  });

  it("should floor hours (90 minutes becomes 1h)", () => {
    const iso = new Date(NOW - 90 * 60_000).toISOString();
    assertEquals(relativeTime(iso, NOW), "— 1h ago");
  });

  it("should default `now` to Date.now() when omitted", () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    const result = relativeTime(iso);
    assertEquals(result.startsWith("— "), true);
    assertEquals(result.endsWith("s ago") || result.endsWith("a few seconds ago"), true);
  });
});
