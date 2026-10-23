import { describe, expect, it } from "vitest";
import { buildHeatmap, distribute, heatLevel, type WorkItem } from "../src/lib/heatmap";

const w = (over: Partial<WorkItem>): WorkItem => ({
  uid: "x", courseId: "c", title: "Problem Set", type: "problem-set", start: "2026-10-23T03:59:00.000Z", allDay: false, hours: 4, doneAt: null, ...over,
});
const sum = (m: Map<string, { hours: number }[]>) => [...m.values()].flat().reduce((s, c) => s + c.hours, 0);

describe("distribute", () => {
  it("spreads hours over the lead days, ramping toward the deadline", () => {
    // Due 11:59pm Thu Oct 22 (New York). Problem sets get 4 lead days: Mon–Thu, weights 1:2:3:4.
    const m = distribute([w({})]);
    expect([...m.keys()]).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(m.get("2026-10-19")![0]!.hours).toBeCloseTo(0.4);
    expect(m.get("2026-10-22")![0]!.hours).toBeCloseTo(1.6);
    expect(sum(m)).toBeCloseTo(4);
  });

  it("ends the day before for morning deadlines and for exams", () => {
    const morning = distribute([w({ start: "2026-10-22T13:00:00.000Z" })]); // 9am Thu
    expect([...morning.keys()].at(-1)).toBe("2026-10-21");
    const exam = distribute([w({ type: "exam", start: "2026-10-28T18:00:00.000Z", hours: 8 })]); // Wed 2pm
    expect([...exam.keys()]).toEqual(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
  });

  it("stops counting a finished item after the day it was done", () => {
    const m = distribute([w({ doneAt: "2026-10-20T20:00:00.000Z" })]);
    expect([...m.keys()]).toEqual(["2026-10-19", "2026-10-20"]);
    expect(sum(m)).toBeCloseTo(4);
  });

  it("handles all-day due dates", () => {
    const m = distribute([w({ start: "2026-10-30", allDay: true, type: "discussion", hours: 1 })]);
    expect([...m.keys()]).toEqual(["2026-10-30"]);
  });
});

describe("heatLevel", () => {
  it("maps hours to 0–5", () => {
    expect([0, 0.5, 1.5, 3, 4, 8].map(heatLevel)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("buildHeatmap", () => {
  it("builds Monday-first weeks with totals, exam markers and crunch weeks", () => {
    const items: WorkItem[] = [
      w({ uid: "a", start: "2026-10-09T03:59:00.000Z", hours: 6 }), // week of Oct 5
      w({ uid: "b", start: "2026-10-15T03:59:00.000Z", hours: 6 }), // week of Oct 12
      w({ uid: "c", start: "2026-10-22T03:59:00.000Z", hours: 6 }), // week of Oct 19
      w({ uid: "m1", type: "exam", title: "Midterm", start: "2026-10-29T14:00:00.000Z", hours: 8 }),
      w({ uid: "m2", type: "exam", title: "Midterm", start: "2026-10-30T14:00:00.000Z", hours: 8 }),
    ];
    const h = buildHeatmap(items, { start: "2026-10-05", end: "2026-11-01" });
    expect(h.weeks.map((x) => x.start)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(h.weeks.every((x) => x.days.length === 7)).toBe(true);
    const last = h.weeks.at(-1)!;
    expect(last.examCount).toBe(2);
    expect(last.crunch).toBe(true);
    expect(last.crunchReason).toBe("2 exams");
    expect(h.weeks[0]!.crunch).toBe(false);
    const examDay = last.days.find((d) => d.date === "2026-10-29")!;
    expect(examDay.exams.map((e) => e.uid)).toEqual(["m1"]);
    const total = h.weeks.reduce((s, x) => s + x.total, 0);
    expect(total).toBeCloseTo(6 * 3 + 16);
  });
});
