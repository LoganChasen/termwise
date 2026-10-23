import { describe, expect, it } from "vitest";
import { computeGrade, letterFor, matchCategory, projectGrade, remainingWork, solveForTarget } from "../src/lib/grades";
import type { GradeCategory, GradeEntry } from "../src/lib/types";

const g = (name: string, category: string | null, score: number | null, outOf: number, status: GradeEntry["status"] = score === null ? "ungraded" : "graded"): GradeEntry => ({
  name, category, score, outOf, status,
});

const cats: GradeCategory[] = [
  { name: "Problem Sets", weight: 30, dropLowest: 1 },
  { name: "Midterm", weight: 30, dropLowest: 0 },
  { name: "Final Exam", weight: 40, dropLowest: 0 },
];

const entries: GradeEntry[] = [
  g("PS 1", "Problem Sets", 10, 10),
  g("PS 2", "Problem Sets", 4, 10), // dropped
  g("PS 3", "Problem Sets", 8, 10),
  g("PS 4", "Problem Sets", null, 10),
  g("Midterm", "Midterm", 80, 100),
];

describe("computeGrade", () => {
  it("weights categories, drops the lowest, and re-normalizes over graded categories", () => {
    const r = computeGrade(entries, cats);
    const ps = r.categories.find((c) => c.name === "Problem Sets")!;
    expect(ps.percent).toBeCloseTo(90);
    expect(ps.dropped).toEqual(["PS 2"]);
    // (30×90 + 30×80) / 60 = 85
    expect(r.percent).toBeCloseTo(85);
    expect(r.weighted).toBe(true);
  });

  it("counts missing as zero and ignores excused", () => {
    const r = computeGrade([g("A", null, 10, 10), g("B", null, null, 10, "missing"), g("C", null, null, 10, "excused")], []);
    expect(r.percent).toBeCloseTo(50);
    expect(r.weighted).toBe(false);
  });

  it("returns null when nothing is graded", () => {
    expect(computeGrade([g("A", null, null, 10)], cats).percent).toBeNull();
  });
});

describe("matchCategory", () => {
  it("matches by group name, then entry name, then work type", () => {
    expect(matchCategory({ name: "x", category: "problem set" }, cats)?.name).toBe("Problem Sets");
    expect(matchCategory({ name: "Midterm 1", category: null }, cats)?.name).toBe("Midterm");
    expect(matchCategory({ name: "HW 5", category: "Homework" }, cats)?.name).toBe("Problem Sets");
  });
});

describe("what-if", () => {
  it("lists remaining work including categories Canvas doesn't have yet", () => {
    expect(remainingWork(entries, cats).map((e) => e.name)).toEqual(["PS 4", "Final Exam"]);
  });

  it("projects the final grade for a given score on what's left", () => {
    // PS: 10,8,10 (drop 4) → 28/30=93.3; mid 80; final 100 → 0.3×93.33+0.3×80+0.4×100 = 92
    expect(projectGrade(entries, cats, 100)).toBeCloseTo(92);
  });

  it("solves for the average needed to hit a target", () => {
    const r = solveForTarget(entries, cats, 90);
    expect(r.needed).not.toBeNull();
    expect(projectGrade(entries, cats, r.needed!)).toBeGreaterThanOrEqual(90 - 1e-6);
    expect(projectGrade(entries, cats, r.needed! - 0.5)).toBeLessThan(90);
    expect(solveForTarget(entries, cats, 99).needed).toBeNull(); // out of reach
    expect(solveForTarget(entries, cats, 40).needed).toBe(0); // already locked in
  });
});

describe("letterFor", () => {
  it("uses the default scale or a syllabus scale", () => {
    expect(letterFor(93)).toBe("A");
    expect(letterFor(89.99)).toBe("B+");
    expect(letterFor(59)).toBe("F");
    expect(letterFor(null)).toBeNull();
    expect(letterFor(85, [{ letter: "A", min: 85 }, { letter: "B", min: 70 }])).toBe("A");
  });
});
