import { describe, expect, it } from "vitest";
import { detectWorkType, estimateHours } from "../src/lib/estimate";

describe("detectWorkType", () => {
  it.each([
    ["Problem Set 4", "problem-set"],
    ["HW 3", "problem-set"],
    ["PS3: Bonds", "problem-set"],
    ["Midterm 2", "exam"],
    ["Final Exam", "exam"],
    ["Final Project Proposal", "project"],
    ["Final Paper", "essay"],
    ["Quiz 5", "quiz"],
    ["Lab 3: Arrays", "lab"],
    ["Reading Response 2", "essay"],
    ["Chapter 7 reading", "reading"],
    ["Discussion Post: Week 4", "discussion"],
    ["Group Presentation", "presentation"],
    ["Attendance", "other"],
  ])("%s → %s", (title, type) => {
    expect(detectWorkType(title)).toBe(type);
  });
});

describe("estimateHours", () => {
  it("scales by how many items of a type the course has", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ uid: `d${i}`, title: `Discussion Post ${i}`, courseId: "a" }));
    const few = Array.from({ length: 3 }, (_, i) => ({ uid: `p${i}`, title: `Problem Set ${i}`, courseId: "b" }));
    const ten = Array.from({ length: 10 }, (_, i) => ({ uid: `q${i}`, title: `Problem Set ${i}`, courseId: "c" }));
    const h = estimateHours([...many, ...few, ...ten]);
    expect(h.get("d0")).toBe(0.5); // 0.75 × max(0.6, √(12/25)=0.69) → 0.52 → 0.5
    expect(h.get("p0")).toBe(4.75); // 3 × min(1.6, √(10/3)=1.83) = 4.8 → 4.75
    expect(h.get("q0")).toBe(3); // typical count, no scaling
  });

  it("gives exams study time, more for finals", () => {
    const h = estimateHours([
      { uid: "m", title: "Midterm 1", courseId: "a" },
      { uid: "f", title: "Final Exam", courseId: "a" },
    ]);
    expect(h.get("m")).toBe(8);
    expect(h.get("f")).toBe(12);
  });
});
