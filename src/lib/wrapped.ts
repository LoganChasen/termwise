import { daysBetween, dayKey, parseDay } from "./dates";
import { buildHeatmap } from "./heatmap";
import { weekLabel } from "./format";
import type { AppData, CourseView, ItemView } from "../server/model";
import type { WorkType } from "./types";

/**
 * Semester Wrapped: an end-of-semester recap built only from what Termwise actually knows
 * (check-offs, due dates, hour estimates, pasted grades). Every stat is null when the data
 * can't support it, so the UI never shows a made-up number. Works mid-semester too
 * ("your recap so far"): everything counts up to `now`.
 */

export type WrappedInput = Pick<AppData, "courses" | "items" | "semester">;

export interface CourseRef {
  courseId: string;
  name: string;
  color: string;
}

export interface WrappedStats {
  season: string;
  semester: { start: string; end: string };
  inProgress: boolean;
  /** 1-based week of the semester we're in (capped at weeksTotal). */
  week: number;
  weeksTotal: number;
  courseCount: number;

  /** Feed items checked off. */
  completed: number;
  /** Of those, checked off at or before the due time. */
  onTime: number;
  /** onTime / completed, 0–1; null when nothing is done. */
  onTimeRate: number | null;
  /** Feed items still due after now. */
  remaining: number;

  /** Estimated hours of finished work (checked-off items plus study for exams taken). */
  hours: number;
  hoursByCourse: (CourseRef & { hours: number })[];

  busiestWeek: { start: string; label: string; hours: number; exams: number; due: number; levels: number[] } | null;
  busiestDay: { date: string; hours: number; level: number } | null;

  examsTaken: number;
  examsLeft: number;

  /** Current grades, best first. */
  grades: (CourseRef & { percent: number; letter: string | null })[];
  best: (CourseRef & { percent: number; letter: string | null }) | null;
  /** Biggest rise in average score from the first half of graded work to the second. */
  mostImproved: (CourseRef & { from: number; to: number; delta: number; graded: number }) | null;

  /** Longest run of past-due items in a row, all done on time. */
  streak: { count: number; from: string; to: string } | null;
  /** The item finished furthest ahead of its deadline. */
  earliest: (CourseRef & { title: string; msEarly: number; daysEarly: number }) | null;
  /** Items due at night (9pm or later) that were checked off on the due day itself. */
  nightOwl: { count: number; of: number } | null;
  /** Most common kind of finished work. */
  topType: { type: WorkType; count: number; label: string } | null;
}

const NIGHT_HOUR = 21;
const DAY_MS = 86_400_000;

const TYPE_LABEL: Record<WorkType, [string, string]> = {
  exam: ["exam", "exams"],
  quiz: ["quiz", "quizzes"],
  "problem-set": ["problem set", "problem sets"],
  lab: ["lab", "labs"],
  essay: ["essay", "essays"],
  project: ["project", "projects"],
  presentation: ["presentation", "presentations"],
  reading: ["reading", "readings"],
  discussion: ["discussion post", "discussion posts"],
  other: ["assignment", "assignments"],
};

export function typeLabel(type: WorkType, count: number): string {
  return TYPE_LABEL[type][count === 1 ? 0 : 1];
}

export function seasonLabel(start: string): string {
  const d = parseDay(start);
  const m = d.getMonth();
  const season = m <= 4 ? "Spring" : m <= 6 ? "Summer" : "Fall";
  return `${season} ${d.getFullYear()}`;
}

export function computeWrapped(data: WrappedInput, now: Date): WrappedStats {
  const nowMs = now.getTime();
  const today = dayKey(now);
  const { semester } = data;
  const courses = data.courses.filter((c) => !c.hidden);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const ref = (id: string | null): CourseRef => {
    const c = id ? byId.get(id) : undefined;
    return { courseId: id ?? "", name: c?.name ?? "Personal", color: c?.color ?? "var(--ink-3)" };
  };

  const feed = data.items.filter((i) => i.source === "feed");
  const done = feed.filter((i) => i.doneAt && new Date(i.doneAt).getTime() <= nowMs);
  const onTimeOf = (i: ItemView) => !!i.doneAt && new Date(i.doneAt).getTime() <= i.dueMs;
  const onTime = done.filter(onTimeOf).length;
  const exams = data.items.filter((i) => i.type === "exam");
  const examsTaken = exams.filter((i) => i.dueMs <= nowMs);

  // Hours: finished work plus the study time behind exams already taken.
  const hourItems = [...done, ...examsTaken.filter((e) => !done.includes(e))];
  const hoursMap = new Map<string, number>();
  for (const i of hourItems) hoursMap.set(i.courseId ?? "", (hoursMap.get(i.courseId ?? "") ?? 0) + i.hours);
  const hoursByCourse = [...hoursMap.entries()]
    .filter(([, h]) => h > 0)
    .map(([id, hours]) => ({ ...ref(id || null), hours }))
    .sort((a, b) => b.hours - a.hours);
  const hours = hoursByCourse.reduce((s, c) => s + c.hours, 0);

  // Busiest week / day, counting only days that have already happened.
  const lastDay = today < semester.end ? today : semester.end;
  let busiestWeek: WrappedStats["busiestWeek"] = null;
  let busiestDay: WrappedStats["busiestDay"] = null;
  if (data.items.length > 0 && lastDay >= semester.start) {
    const heat = buildHeatmap(data.items, semester);
    for (const w of heat.weeks) {
      const past = w.days.filter((d) => d.inRange && d.date <= lastDay);
      if (past.length === 0) continue;
      const total = past.reduce((s, d) => s + d.hours, 0);
      if (total > 0 && (!busiestWeek || total > busiestWeek.hours)) {
        busiestWeek = {
          start: w.start,
          label: weekLabel(w.start),
          hours: total,
          exams: past.reduce((s, d) => s + d.exams.length, 0),
          due: past.reduce((s, d) => s + d.due.length, 0),
          levels: w.days.map((d) => (d.inRange && d.date <= lastDay ? d.level : 0)),
        };
      }
      for (const d of past) if (d.hours > 0 && (!busiestDay || d.hours > busiestDay.hours)) busiestDay = { date: d.date, hours: d.hours, level: d.level };
    }
  }

  // Grades.
  const grades = courses
    .filter((c) => c.grade?.percent != null)
    .map((c) => ({ ...ref(c.id), percent: c.grade!.percent!, letter: c.letter }))
    .sort((a, b) => b.percent - a.percent);

  let mostImproved: WrappedStats["mostImproved"] = null;
  for (const c of courses) {
    const trend = gradeTrend(c, data.items);
    if (trend && trend.delta >= 1 && (!mostImproved || trend.delta > mostImproved.delta)) mostImproved = { ...ref(c.id), ...trend };
  }

  // Streak: past-due feed items in due order; a late or missed one breaks the run.
  const pastDue = feed.filter((i) => i.dueMs <= nowMs).sort((a, b) => a.dueMs - b.dueMs);
  let streak: WrappedStats["streak"] = null;
  let run: ItemView[] = [];
  for (const i of pastDue) {
    if (onTimeOf(i)) {
      run.push(i);
      if (!streak || run.length > streak.count) streak = { count: run.length, from: run[0]!.day, to: i.day };
    } else run = [];
  }

  let earliest: WrappedStats["earliest"] = null;
  for (const i of done) {
    const lead = i.dueMs - new Date(i.doneAt!).getTime();
    if (lead >= 3_600_000 && (!earliest || lead > earliest.msEarly)) {
      earliest = { ...ref(i.courseId), title: i.title, msEarly: lead, daysEarly: Math.floor(lead / DAY_MS) };
    }
  }

  const nightDue = done.filter((i) => !i.allDay && new Date(i.dueMs).getHours() >= NIGHT_HOUR);
  const owl = nightDue.filter((i) => dayKey(new Date(i.doneAt!)) === i.day).length;
  const nightOwl = nightDue.length > 0 ? { count: owl, of: nightDue.length } : null;

  const typeCounts = new Map<WorkType, number>();
  for (const i of done) if (i.type !== "other" && i.type !== "exam") typeCounts.set(i.type, (typeCounts.get(i.type) ?? 0) + 1);
  const top = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const weeksTotal = Math.max(1, Math.ceil((daysBetween(semester.start, semester.end) + 1) / 7));
  const week = Math.min(weeksTotal, Math.max(1, Math.floor(daysBetween(semester.start, today) / 7) + 1));

  return {
    season: seasonLabel(semester.start),
    semester,
    inProgress: today <= semester.end,
    week,
    weeksTotal,
    courseCount: courses.length,
    completed: done.length,
    onTime,
    onTimeRate: done.length ? onTime / done.length : null,
    remaining: feed.filter((i) => i.dueMs > nowMs && !i.doneAt).length,
    hours,
    hoursByCourse,
    busiestWeek,
    busiestDay,
    examsTaken: examsTaken.length,
    examsLeft: exams.length - examsTaken.length,
    grades,
    best: grades[0] ?? null,
    mostImproved,
    streak,
    earliest,
    nightOwl,
    topType: top ? { type: top[0], count: top[1], label: typeLabel(top[0], top[1]) } : null,
  };
}

/**
 * Average score (percent) on the first half of a course's graded work vs the second half,
 * in due-date order. Entries are dated by matching their name to a Canvas item; ones that
 * don't match keep their place in the Canvas list. Needs at least 4 graded entries.
 */
export function gradeTrend(course: Pick<CourseView, "id" | "grades">, items: Pick<ItemView, "courseId" | "title" | "dueMs">[]): { from: number; to: number; delta: number; graded: number } | null {
  const entries = course.grades?.entries ?? [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const due = new Map<string, number>();
  for (const i of items) if (i.courseId === course.id) due.set(norm(i.title), i.dueMs);

  let lastKey = -Infinity;
  const keyed = entries.map((e, idx) => {
    const k = due.get(norm(e.name));
    if (k !== undefined) lastKey = k;
    return { e, key: k ?? lastKey, idx };
  });
  const graded = keyed
    .filter(({ e }) => e.status === "graded" && e.score !== null && (e.outOf ?? 0) > 0)
    .sort((a, b) => a.key - b.key || a.idx - b.idx)
    .map(({ e }) => (e.score! / e.outOf!) * 100);
  if (graded.length < 4) return null;
  const half = Math.floor(graded.length / 2);
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const from = avg(graded.slice(0, half));
  const to = avg(graded.slice(graded.length - half));
  return { from, to, delta: to - from, graded: graded.length };
}

/** "3 days early", "1 day early", "5 hours early". */
export function earlyLabel(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} early`;
  const h = Math.max(1, Math.round(ms / 3_600_000));
  return `${h} hour${h === 1 ? "" : "s"} early`;
}

/** Days in a streak's span, for the caption. */
export function spanDays(from: string, to: string): number {
  return daysBetween(from, to) + 1;
}
