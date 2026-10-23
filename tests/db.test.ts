import { describe, expect, it } from "vitest";
import { Store } from "../src/server/db";
import type { FeedItem, ParsedFeed } from "../src/lib/types";

const course = { id: "c1", label: "FIN_320", name: "FIN 320", colorIndex: 0 };
const item = (uid: string, start: string, title = uid): FeedItem => ({
  uid, kind: "assignment", title, courseId: "c1", start, end: null, allDay: false, url: null,
});
const feed = (...items: FeedItem[]): ParsedFeed => ({ courses: [course], items });

describe("Store.applyFeed", () => {
  it("treats the first sync as a baseline, then records changes", () => {
    const s = new Store(":memory:");
    expect(s.applyFeed(feed(item("a", "2026-11-01T03:59:00Z")), new Date("2026-10-20T00:00:00Z"))).toEqual([]);
    expect(s.listItems()).toHaveLength(1);

    const later = new Date("2026-10-21T00:00:00Z");
    const updates = s.applyFeed(feed(item("a", "2026-10-30T03:59:00Z"), item("b", "2026-11-05T03:59:00Z")), later);
    expect(updates.map((u) => u.kind)).toEqual(["rescheduled", "added"]);
    expect(s.listUpdates().map((u) => u.kind).sort()).toEqual(["added", "rescheduled"]);
    expect(s.getSetting("lastSyncAt")).toBe(later.toISOString());
  });

  it("marks upcoming items that vanish as removed, and restores them if they return", () => {
    const s = new Store(":memory:");
    const now = new Date("2026-10-20T00:00:00Z");
    s.applyFeed(feed(item("a", "2026-11-01T03:59:00Z"), item("b", "2026-11-02T03:59:00Z")), now);
    s.applyFeed(feed(item("a", "2026-11-01T03:59:00Z")), now);
    expect(s.listItems().map((i) => i.uid)).toEqual(["a"]);
    expect(s.listItems({ includeRemoved: true }).find((i) => i.uid === "b")?.removedAt).not.toBeNull();
    s.applyFeed(feed(item("a", "2026-11-01T03:59:00Z"), item("b", "2026-11-02T03:59:00Z")), now);
    expect(s.listItems().map((i) => i.uid)).toEqual(["a", "b"]);
  });

  it("keeps done state and estimate overrides across syncs", () => {
    const s = new Store(":memory:");
    s.applyFeed(feed(item("a", "2026-11-01T03:59:00Z")));
    s.setDone("a", true);
    s.setEstimate("a", 3.5);
    s.applyFeed(feed(item("a", "2026-11-01T03:59:00Z", "renamed")));
    const a = s.listItems()[0]!;
    expect(a.doneAt).not.toBeNull();
    expect(a.estimateOverride).toBe(3.5);
    expect(a.title).toBe("renamed");
  });

  it("keeps user-edited course names", () => {
    const s = new Store(":memory:");
    s.applyFeed(feed());
    s.updateCourse("c1", { name: "Corporate Finance" });
    s.applyFeed(feed());
    expect(s.listCourses()[0]?.name).toBe("Corporate Finance");
  });
});

describe("Store settings and docs", () => {
  it("round-trips settings and JSON docs", () => {
    const s = new Store(":memory:");
    s.setSetting("x", "1");
    expect(s.getSetting("x")).toBe("1");
    s.setSetting("x", null);
    expect(s.getSetting("x")).toBeNull();
    s.setDoc("syllabus:c1", { exams: [1] });
    expect(s.getDoc("syllabus:c1")).toEqual({ exams: [1] });
    expect(s.listDocs("syllabus:").map((d) => d.key)).toEqual(["syllabus:c1"]);
  });
});
