import { describe, expect, it } from "vitest";
import { seedDemo } from "../src/demo/seed";
import { buildHeatmap } from "../src/lib/heatmap";
import { Store } from "../src/server/db";
import { buildAppData } from "../src/server/model";

describe("demo semester", () => {
  const now = new Date("2026-10-22T15:00:00");
  const store = new Store(":memory:");
  seedDemo(store, now);
  const data = buildAppData(store, { mode: "demo", feedConnected: true, now });

  it("has five courses with syllabi and grades", () => {
    expect(data.courses).toHaveLength(5);
    expect(data.courses.every((c) => c.syllabus && c.grades && c.grade?.percent)).toBe(true);
    for (const c of data.courses) expect(c.grade!.percent!).toBeGreaterThan(60);
  });

  it("merges syllabus exams into the items", () => {
    const exams = data.items.filter((i) => i.type === "exam");
    expect(exams.length).toBe(10);
    expect(exams.every((e) => e.source === "syllabus")).toBe(true);
  });

  it("shows changes in the Updates feed", () => {
    const kinds = new Set(data.updates.map((u) => u.kind));
    for (const k of ["added", "rescheduled", "renamed", "grade-posted"]) expect(kinds).toContain(k);
  });

  it("marks most past work done and builds a sensible heat map", () => {
    const past = data.items.filter((i) => i.dueMs < now.getTime() && i.source === "feed");
    expect(past.filter((i) => !i.doneAt)).toHaveLength(1);
    const h = buildHeatmap(
      data.items.map((i) => ({ ...i, courseId: i.courseId })),
      data.semester,
    );
    expect(h.weeks.length).toBeGreaterThanOrEqual(16);
    expect(h.weeks.some((w) => w.crunch)).toBe(true);
    expect(h.medianWeek).toBeGreaterThan(10);
    expect(h.medianWeek).toBeLessThan(45);
  });
});
