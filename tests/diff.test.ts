import { describe, expect, it } from "vitest";
import { diffFeed, dueTime } from "../src/lib/diff";
import type { FeedItem } from "../src/lib/types";

const item = (uid: string, start: string, title = uid): FeedItem => ({
  uid, kind: "assignment", title, courseId: "c1", start, end: null, allDay: false, url: null,
});
const now = new Date("2026-10-20T12:00:00Z");

describe("diffFeed", () => {
  it("reports added, rescheduled and renamed items", () => {
    const prev = [item("a", "2026-10-25T03:59:00Z", "PS 4"), item("b", "2026-10-26T03:59:00Z")];
    const next = [item("a", "2026-10-23T03:59:00Z", "Problem Set 4"), item("b", "2026-10-26T03:59:00Z"), item("c", "2026-11-01T03:59:00Z")];
    const kinds = diffFeed(prev, next, now).map((u) => [u.kind, u.uid, u.before, u.after]);
    expect(kinds).toEqual([
      ["rescheduled", "a", "2026-10-25T03:59:00Z", "2026-10-23T03:59:00Z"],
      ["renamed", "a", "PS 4", "Problem Set 4"],
      ["added", "c", null, "2026-11-01T03:59:00Z"],
    ]);
  });

  it("only reports removals for items that were still upcoming", () => {
    const prev = [item("past", "2026-10-01T03:59:00Z"), item("future", "2026-11-01T03:59:00Z")];
    const updates = diffFeed(prev, [], now);
    expect(updates.map((u) => [u.kind, u.uid])).toEqual([["removed", "future"]]);
  });

  it("reports nothing when the feed is unchanged", () => {
    const feed = [item("a", "2026-10-25T03:59:00Z")];
    expect(diffFeed(feed, feed, now)).toEqual([]);
  });
});

describe("dueTime", () => {
  it("treats all-day items as due at the end of the day", () => {
    const t = new Date(dueTime({ start: "2026-10-30", allDay: true }));
    expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([30, 23, 59]);
  });
});
