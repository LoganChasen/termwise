import { DEFAULT_SCALE } from "@/lib/grades";
import { formatClock } from "@/lib/format";
import type { GradeCategory, LetterCutoff, Weekday } from "@/lib/types";
import type { CourseView, ItemView } from "@/server/model";

/** Same rule as model.ts: syllabus categories win, else the Canvas group weights. */
export function categoriesFor(course: Pick<CourseView, "syllabus" | "grades">): GradeCategory[] {
  if (course.syllabus?.categories.length) return course.syllabus.categories;
  return (course.grades?.canvasWeights ?? []).map((w) => ({ ...w, dropLowest: 0 }));
}

export function scaleFor(course: Pick<CourseView, "syllabus">): LetterCutoff[] {
  return [...(course.syllabus?.letterScale ?? DEFAULT_SCALE)].sort((a, b) => b.min - a.min);
}

/** "10:00","11:15" → "10–11:15am"; "11:30","12:45" → "11:30am–12:45pm". */
export function formatRange(start: string, end: string): string {
  const a = formatClock(start);
  const b = formatClock(end);
  const sa = a.slice(-2);
  return sa === b.slice(-2) ? `${a.slice(0, -2)}–${b}` : `${a}–${b}`;
}

export const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const WEEKDAY_LONG: Record<Weekday, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/** "HH:MM" → minutes after midnight. */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export const isOpen = (i: ItemView) => !i.doneAt && !i.removedAt;

/** Upcoming, not-done items for a course, soonest first. */
export function upcomingFor(items: ItemView[], courseId: string, nowMs: number): ItemView[] {
  return items.filter((i) => i.courseId === courseId && isOpen(i) && i.dueMs >= nowMs);
}

/** A percent → readable color token for grade numbers. */
export function gradeTone(percent: number | null): string {
  if (percent === null) return "text-ink-3";
  if (percent >= 90) return "text-success";
  if (percent >= 80) return "text-ink";
  if (percent >= 70) return "text-warning";
  return "text-danger";
}

/** "Problem Set 12, Final Exam and 2 more". */
export function listNames(names: string[], max = 2): string {
  if (names.length === 0) return "";
  if (names.length <= max + 1) {
    return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  }
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
