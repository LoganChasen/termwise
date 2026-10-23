import { courseColor } from "../lib/config";
import { addDays, dayKey, itemDay } from "../lib/dates";
import { dueTime } from "../lib/diff";
import { detectWorkType, estimateHours } from "../lib/estimate";
import { computeGrade, letterFor, type GradeResult } from "../lib/grades";
import type { CourseGrades, StoredItem, SyllabusExam, SyllabusInfo, UpdateEvent, WorkType } from "../lib/types";
import type { Store } from "./db";

/**
 * The read model every page renders from: courses with their syllabus and grades,
 * every item with its work type and hour estimate, and the Updates feed.
 * Built on the server from the local store; plain JSON so it can go to client components.
 */

export interface CourseView {
  id: string;
  name: string;
  label: string;
  color: string;
  colorIndex: number;
  hidden: boolean;
  syllabus: SyllabusInfo | null;
  grades: CourseGrades | null;
  grade: GradeResult | null;
  letter: string | null;
}

export interface ItemView extends StoredItem {
  type: WorkType;
  /** Hours used everywhere: the user's override, else the estimate. */
  hours: number;
  estimatedHours: number;
  /** Where the item came from. Syllabus exams don't exist in Canvas. */
  source: "feed" | "syllabus";
  /** Due time in ms (all-day items count as 11:59pm). */
  dueMs: number;
  /** Local "YYYY-MM-DD". */
  day: string;
}

export interface AppData {
  mode: "real" | "demo";
  now: string;
  semester: { start: string; end: string };
  courses: CourseView[];
  items: ItemView[];
  updates: (UpdateEvent & { id: number })[];
  lastSyncAt: string | null;
  lastSeenAt: string | null;
  feedConnected: boolean;
  setupDone: boolean;
}

export const syllabusKey = (courseId: string) => `syllabus:${courseId}`;
export const gradesKey = (courseId: string) => `grades:${courseId}`;

export function buildAppData(store: Store, opts: { mode: "real" | "demo"; feedConnected: boolean; now?: Date }): AppData {
  const now = opts.now ?? new Date();
  const courses: CourseView[] = store.listCourses().map((c) => {
    const syllabus = store.getDoc<SyllabusInfo>(syllabusKey(c.id));
    const grades = store.getDoc<CourseGrades>(gradesKey(c.id));
    const categories = syllabus?.categories.length ? syllabus.categories : (grades?.canvasWeights ?? []).map((w) => ({ ...w, dropLowest: 0 }));
    const grade = grades ? computeGrade(grades.entries, categories) : null;
    return {
      id: c.id,
      name: c.name,
      label: c.label,
      color: courseColor(c.colorIndex),
      colorIndex: c.colorIndex,
      hidden: c.hidden,
      syllabus,
      grades,
      grade,
      letter: letterFor(grade?.percent ?? null, syllabus?.letterScale ?? null),
    };
  });
  const visible = new Set(courses.filter((c) => !c.hidden).map((c) => c.id));

  const feedItems = store.listItems().filter((i) => i.courseId === null || visible.has(i.courseId));
  const examItems = courses
    .filter((c) => !c.hidden)
    .flatMap((c) => syllabusExamItems(c, feedItems))
    .map((i) => ({ ...i, ...store.getItemState(i.uid) }));
  const all = [...feedItems, ...examItems];

  const estimates = estimateHours(all);
  const items: ItemView[] = all
    .map((i) => {
      const estimatedHours = estimates.get(i.uid) ?? 0;
      return {
        ...i,
        type: detectWorkType(i.title),
        estimatedHours,
        hours: i.estimateOverride ?? estimatedHours,
        source: i.uid.startsWith("syllabus:") ? ("syllabus" as const) : ("feed" as const),
        dueMs: dueTime(i),
        day: itemDay(i),
      };
    })
    .sort((a, b) => a.dueMs - b.dueMs);

  return {
    mode: opts.mode,
    now: now.toISOString(),
    semester: semesterRange(store, items, now),
    courses,
    items,
    updates: store.listUpdates(),
    lastSyncAt: store.getSetting("lastSyncAt"),
    lastSeenAt: store.getSetting("lastSeenAt"),
    feedConnected: opts.feedConnected,
    setupDone: store.getSetting("setupDone") === "1",
  };
}

/**
 * Exams from the syllabus become items, unless Canvas already has an exam for that
 * course on that day (no double counting).
 */
function syllabusExamItems(course: CourseView, feed: StoredItem[]): StoredItem[] {
  const exams = course.syllabus?.exams ?? [];
  // Index by position in the syllabus so the uid stays stable when Canvas duplicates are skipped.
  return exams
    .map((e, i) => [e, i] as const)
    .filter(([e]) => !feed.some((f) => f.courseId === course.id && itemDay(f) === e.date && detectWorkType(f.title) === "exam"))
    .map(([e, i]) => examToItem(course.id, e, i));
}

function examToItem(courseId: string, e: SyllabusExam, index: number): StoredItem {
  const title = /exam|midterm|final|test|quiz/i.test(e.title) ? e.title : `${e.title} (exam)`;
  const start = e.time ? new Date(`${e.date}T${e.time}:00`).toISOString() : e.date;
  return {
    uid: `syllabus:${courseId}:${index}`,
    kind: "event",
    title,
    courseId,
    start,
    end: null,
    allDay: !e.time,
    url: null,
    firstSeen: start,
    doneAt: null,
    estimateOverride: null,
    removedAt: null,
  };
}

/** Semester dates from setup, else the span of the items, else a guess from today's date. */
function semesterRange(store: Store, items: ItemView[], now: Date): { start: string; end: string } {
  const start = store.getSetting("semesterStart");
  const end = store.getSetting("semesterEnd");
  if (start && end) return { start, end };
  const today = dayKey(now);
  const days = items.map((i) => i.day).sort();
  if (days.length > 0) {
    const first = days[0]! < addDays(today, -120) ? addDays(today, -120) : days[0]!;
    return { start: start ?? first, end: end ?? days.at(-1)! };
  }
  const y = now.getFullYear();
  const fall = now.getMonth() >= 6;
  return fall ? { start: `${y}-08-20`, end: `${y}-12-20` } : { start: `${y}-01-10`, end: `${y}-05-10` };
}
