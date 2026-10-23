import type { CourseView, ItemView } from "@/server/model";
import type { WorkType } from "@/lib/types";

/** Plain-English label for each work type. */
export const TYPE_LABEL: Record<WorkType, string> = {
  exam: "Exam",
  quiz: "Quiz",
  "problem-set": "Problem set",
  lab: "Lab",
  essay: "Writing",
  project: "Project",
  presentation: "Presentation",
  reading: "Reading",
  discussion: "Discussion",
  other: "Assignment",
};

/** Exam/quiz items count as "tests" in Coming up. */
export const isTest = (i: Pick<ItemView, "type">) => i.type === "exam" || i.type === "quiz";

/** Where an exam happens, from the course syllabus (matched by day, then title). */
export function examLocation(item: ItemView, course: CourseView | undefined): string | null {
  if (item.type !== "exam" || !course?.syllabus) return null;
  const sameDay = course.syllabus.exams.filter((e) => e.date === item.day);
  const match = sameDay.find((e) => item.title === e.title || item.title.startsWith(e.title)) ?? sameDay[0];
  return match?.location ?? null;
}

export function courseMap(courses: CourseView[]): Map<string, CourseView> {
  return new Map(courses.map((c) => [c.id, c]));
}
