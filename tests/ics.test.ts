import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { displayName, parseFeed, splitLabel } from "../src/lib/ics";

const ics = readFileSync(new URL("./fixtures/canvas-feed.ics", import.meta.url), "utf8");

describe("parseFeed", () => {
  const feed = parseFeed(ics);

  it("detects courses from the URL context and bracket label", () => {
    expect(feed.courses.map((c) => [c.id, c.name])).toEqual([
      ["12345", "FIN 320"],
      ["222", "ECON 201"],
      ["cs-170-lab", "CS 170"],
    ]);
  });

  it("parses assignments and events, sorted by start", () => {
    const uids = feed.items.map((i) => i.uid);
    expect(uids).toEqual([
      "event-calendar-event-77",
      "event-assignment-678",
      "event-assignment-1000",
      "event-calendar-event-55",
      "event-assignment-901",
    ]);
    const ps4 = feed.items.find((i) => i.uid === "event-assignment-678")!;
    expect(ps4).toMatchObject({ kind: "assignment", title: "Problem Set 4", courseId: "12345", allDay: false, start: "2026-10-23T03:59:00.000Z" });
    expect(ps4.url).toBe("https://canvas.emory.edu/courses/12345/assignments/678");
    const mid = feed.items.find((i) => i.uid === "event-calendar-event-55")!;
    expect(mid).toMatchObject({ kind: "event", title: "Midterm 2", end: "2026-10-28T17:30:00.000Z" });
  });

  it("keeps all-day dates as plain dates", () => {
    const r = feed.items.find((i) => i.uid === "event-assignment-901")!;
    expect(r).toMatchObject({ allDay: true, start: "2026-10-30", courseId: "222" });
  });

  it("marks personal calendar entries as having no course", () => {
    expect(feed.items.find((i) => i.uid === "event-calendar-event-77")?.courseId).toBeNull();
  });
});

describe("label helpers", () => {
  it("splits the trailing bracket label", () => {
    expect(splitLabel("Quiz 1 [BIO_141]")).toEqual({ title: "Quiz 1", label: "BIO_141" });
    expect(splitLabel("No label here")).toEqual({ title: "No label here", label: null });
  });
  it("shortens labels to subject + number", () => {
    expect(displayName("FIN_320_1_FA26")).toBe("FIN 320");
    expect(displayName("Fall 2026 - CS 170 - 001")).toBe("CS 170");
    expect(displayName("Intro to Econ")).toBe("Intro to Econ");
  });
});
