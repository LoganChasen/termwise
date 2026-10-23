import { describe, expect, it } from "vitest";
import { seedDemo } from "../src/demo/seed";
import { Store } from "../src/server/db";
import { buildAppData } from "../src/server/model";
import { computeWrapped, earlyLabel, gradeTrend, seasonLabel } from "../src/lib/wrapped";

describe("semester wrapped (demo semester)", () => {
  const now = new Date("2026-10-22T15:00:00");
  const store = new Store(":memory:");
  seedDemo(store, now);
  const data = buildAppData(store, { mode: "demo", feedConnected: true, now });
  const w = computeWrapped(data, now);
  const past = data.items.filter((i) => i.source === "feed" && i.dueMs <= now.getTime());

  it("knows the semester and that it's still going", () => {
    expect(w.season).toBe("Fall 2026");
    expect(w.inProgress).toBe(true);
    expect(w.week).toBe(10);
    expect(w.weeksTotal).toBe(16);
    expect(w.courseCount).toBe(5);
  });

  it("counts finished work and on-time rate from check-offs", () => {
    expect(w.completed).toBe(past.length - 1); // the demo leaves one item overdue
    expect(w.onTime).toBe(w.completed); // demo work is all checked off before the deadline
    expect(w.onTimeRate).toBe(1);
    expect(w.remaining).toBeGreaterThan(0);
  });

  it("totals estimated hours, split by course", () => {
    expect(w.hours).toBeGreaterThan(50);
    expect(w.hoursByCourse).toHaveLength(5);
    expect(w.hoursByCourse.reduce((s, c) => s + c.hours, 0)).toBeCloseTo(w.hours);
    expect(w.hoursByCourse[0]!.hours).toBeGreaterThanOrEqual(w.hoursByCourse.at(-1)!.hours);
  });

  it("finds the busiest week and day among days that already happened", () => {
    expect(w.busiestWeek).not.toBeNull();
    expect(w.busiestWeek!.start <= "2026-10-22").toBe(true);
    expect(w.busiestWeek!.levels).toHaveLength(7);
    expect(w.busiestDay!.date <= "2026-10-22").toBe(true);
    expect(w.busiestDay!.hours).toBeLessThanOrEqual(w.busiestWeek!.hours);
  });

  it("counts exams taken vs left", () => {
    expect(w.examsTaken + w.examsLeft).toBe(10);
    expect(w.examsTaken).toBe(4); // CHEM Exam 1, ECON Midterm 1, FIN Midterm, CS Midterm
  });

  it("ranks grades and finds the best class", () => {
    expect(w.grades).toHaveLength(5);
    expect(w.best).toEqual(w.grades[0]);
    for (let i = 1; i < w.grades.length; i++) expect(w.grades[i - 1]!.percent).toBeGreaterThanOrEqual(w.grades[i]!.percent);
  });

  it("reports streak, earliest finish and night-owl count honestly", () => {
    // One overdue item breaks the run, so the streak is shorter than all past work.
    expect(w.streak!.count).toBeLessThan(past.length);
    expect(w.streak!.count).toBeGreaterThan(5);
    // Demo finishes are 0–2 days early (minus 2 hours).
    expect(w.earliest!.daysEarly).toBe(2);
    expect(earlyLabel(w.earliest!.msEarly)).toBe("2 days early");
    expect(w.nightOwl!.of).toBeGreaterThan(0);
    expect(w.nightOwl!.count).toBeGreaterThan(0);
    expect(w.nightOwl!.count).toBeLessThanOrEqual(w.nightOwl!.of);
    expect(w.topType).not.toBeNull();
  });

  it("most improved only appears with a real rise", () => {
    if (w.mostImproved) {
      expect(w.mostImproved.delta).toBeGreaterThanOrEqual(1);
      expect(w.mostImproved.to - w.mostImproved.from).toBeCloseTo(w.mostImproved.delta);
    }
  });
});

describe("wrapped edge cases", () => {
  const now = new Date("2026-10-22T15:00:00");

  it("returns nulls, not zeros-as-facts, when there's no data", () => {
    const w = computeWrapped({ courses: [], items: [], semester: { start: "2026-08-17", end: "2026-12-04" } }, now);
    expect(w.completed).toBe(0);
    expect(w.onTimeRate).toBeNull();
    expect(w.busiestWeek).toBeNull();
    expect(w.best).toBeNull();
    expect(w.streak).toBeNull();
    expect(w.earliest).toBeNull();
    expect(w.nightOwl).toBeNull();
    expect(w.mostImproved).toBeNull();
  });

  it("knows when the semester is over", () => {
    const w = computeWrapped({ courses: [], items: [], semester: { start: "2026-01-12", end: "2026-05-08" } }, now);
    expect(w.inProgress).toBe(false);
    expect(w.season).toBe("Spring 2026");
    expect(seasonLabel("2026-08-20")).toBe("Fall 2026");
  });

  it("grade trend compares first half to second half in due order", () => {
    const e = (name: string, score: number) => ({ name, category: null, score, outOf: 10, status: "graded" as const });
    const course = { id: "c", grades: { pastedAt: "", canvasTotal: null, canvasWeights: [], entries: [e("B", 9), e("A", 6), e("D", 10), e("C", 7)] } };
    const items = ["A", "B", "C", "D"].map((title, k) => ({ courseId: "c", title, dueMs: k }));
    const t = gradeTrend(course, items)!;
    expect(t.from).toBeCloseTo(75); // A 60, B 90
    expect(t.to).toBeCloseTo(85); // C 70, D 100
    expect(t.delta).toBeCloseTo(10);
    expect(gradeTrend({ id: "c", grades: { ...course.grades, entries: course.grades.entries.slice(0, 3) } }, items)).toBeNull();
  });
});
