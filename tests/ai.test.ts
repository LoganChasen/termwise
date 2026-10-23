import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import { GradesSchema } from "../src/lib/ai/gradesPaste";
import { clean, SyllabusSchema } from "../src/lib/ai/syllabus";

describe("AI schemas", () => {
  it("convert to structured-output formats", () => {
    expect(() => betaZodOutputFormat(SyllabusSchema)).not.toThrow();
    expect(() => betaZodOutputFormat(GradesSchema)).not.toThrow();
  });
});

describe("clean", () => {
  it("drops malformed rows and sorts exams", () => {
    const out = clean({
      courseTitle: "Corporate Finance",
      instructor: null,
      meetings: [
        { days: ["Tue", "Thu"], start: "10:00", end: "11:15", location: "White 208", kind: "lecture" },
        { days: [], start: "10:00", end: "11:15", location: null, kind: "lab" },
      ],
      officeHours: [{ who: "Prof. Kim", days: ["Wed"], start: "2pm", end: "3pm", location: null }],
      exams: [
        { title: "Final", date: "2026-12-12", time: null, type: "final", location: null },
        { title: "Midterm", date: "2026-10-14", time: "10:00", type: "midterm", location: null },
        { title: "Quiz", date: "Week 6", time: null, type: "quiz", location: null },
      ],
      categories: [
        { name: "Problem Sets", weight: 30, dropLowest: 1.2 },
        { name: "", weight: 10, dropLowest: 0 },
      ],
      letterScale: null,
      latePolicy: null,
      notes: ["a", "b", "c", "d", "e", "f", "g"],
    });
    expect(out.meetings).toHaveLength(1);
    expect(out.officeHours).toHaveLength(0);
    expect(out.exams.map((e) => e.title)).toEqual(["Midterm", "Final"]);
    expect(out.categories).toEqual([{ name: "Problem Sets", weight: 30, dropLowest: 1 }]);
    expect(out.notes).toHaveLength(6);
  });
});
