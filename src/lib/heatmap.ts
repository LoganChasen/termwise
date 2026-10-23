import { config } from "./config";
import { addDays, daysBetween, dayKey, itemDay, itemHour, startOfWeek } from "./dates";
import type { WorkType } from "./types";

/** One piece of work to place on the calendar. */
export interface WorkItem {
  uid: string;
  courseId: string | null;
  title: string;
  type: WorkType;
  /** Due time (ISO) or date ("YYYY-MM-DD") when allDay. */
  start: string;
  allDay: boolean;
  hours: number;
  doneAt: string | null;
}

export interface Contribution {
  uid: string;
  courseId: string | null;
  title: string;
  type: WorkType;
  hours: number;
}

export interface DayCell {
  date: string;
  hours: number;
  /** 0 (empty) … 5 (heaviest). */
  level: number;
  /** What the hours are made of, biggest first. */
  contributions: Contribution[];
  /** Items due on this day (excluding exams). */
  due: Contribution[];
  /** Exams happening on this day. */
  exams: Contribution[];
  inRange: boolean;
}

export interface WeekRow {
  start: string;
  days: DayCell[];
  total: number;
  examCount: number;
  crunch: boolean;
  /** Plain-English reason, e.g. "2 exams" or "1.8× a normal week". */
  crunchReason: string | null;
}

export interface Heatmap {
  weeks: WeekRow[];
  medianWeek: number;
  maxDay: number;
}

/**
 * Spread each item's estimated hours over the days before it's due, ramping up
 * toward the deadline (that's when people actually work). Exams spread their study
 * time over the days before the exam. Finished items stop contributing after the
 * day they were checked off.
 */
export function distribute(items: WorkItem[]): Map<string, Contribution[]> {
  const { leadDays, morningCutoffHour } = config.heatmap;
  const byDay = new Map<string, Contribution[]>();

  for (const item of items) {
    if (item.hours <= 0) continue;
    const due = itemDay(item);
    let last = item.type === "exam" || itemHour(item) < morningCutoffHour ? addDays(due, -1) : due;
    const L = leadDays[item.type];
    let first = addDays(last, -(L - 1));
    if (item.doneAt) {
      const done = dayKey(new Date(item.doneAt));
      if (done < first) first = last = done; // finished before it was even planned: all on that day
      else if (done < last) last = done;
    }

    const n = daysBetween(first, last) + 1;
    const total = (n * (n + 1)) / 2; // weights 1..n, heavier near the deadline
    for (let k = 0; k < n; k++) {
      const day = addDays(first, k);
      const hours = (item.hours * (k + 1)) / total;
      const list = byDay.get(day) ?? [];
      list.push({ uid: item.uid, courseId: item.courseId, title: item.title, type: item.type, hours });
      byDay.set(day, list);
    }
  }
  return byDay;
}

export function heatLevel(hours: number): number {
  const t = config.heatmap.levelThresholds;
  for (let i = 0; i < t.length; i++) if (hours < t[i]!) return i;
  return t.length;
}

/** Build the week-by-week grid for a date range (inclusive "YYYY-MM-DD" keys). */
export function buildHeatmap(items: WorkItem[], range: { start: string; end: string }): Heatmap {
  const { crunchVsMedian, crunchMinHours, crunchExamCount } = config.heatmap;
  const byDay = distribute(items);

  const dueByDay = new Map<string, Contribution[]>();
  const examsByDay = new Map<string, Contribution[]>();
  for (const item of items) {
    const c: Contribution = { uid: item.uid, courseId: item.courseId, title: item.title, type: item.type, hours: item.hours };
    const target = item.type === "exam" ? examsByDay : dueByDay;
    const day = itemDay(item);
    target.set(day, [...(target.get(day) ?? []), c]);
  }

  const weeks: WeekRow[] = [];
  let maxDay = 0;
  for (let w = startOfWeek(range.start); w <= range.end; w = addDays(w, 7)) {
    const days: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(w, i);
      const contributions = mergeByUid(byDay.get(date) ?? []).sort((a, b) => b.hours - a.hours);
      const hours = contributions.reduce((s, c) => s + c.hours, 0);
      maxDay = Math.max(maxDay, hours);
      days.push({
        date,
        hours,
        level: heatLevel(hours),
        contributions,
        due: dueByDay.get(date) ?? [],
        exams: examsByDay.get(date) ?? [],
        inRange: date >= range.start && date <= range.end,
      });
    }
    const total = days.reduce((s, d) => s + d.hours, 0);
    const examCount = days.reduce((s, d) => s + d.exams.length, 0);
    weeks.push({ start: w, days, total, examCount, crunch: false, crunchReason: null });
  }

  const medianWeek = median(weeks.map((w) => w.total).filter((t) => t > 0));
  for (const week of weeks) {
    if (week.examCount >= crunchExamCount) {
      week.crunch = true;
      week.crunchReason = `${week.examCount} exams`;
    } else if (medianWeek > 0 && week.total >= crunchMinHours && week.total >= medianWeek * crunchVsMedian) {
      week.crunch = true;
      week.crunchReason = `${(week.total / medianWeek).toFixed(1)}× a normal week`;
    }
  }
  return { weeks, medianWeek, maxDay };
}

function mergeByUid(list: Contribution[]): Contribution[] {
  const m = new Map<string, Contribution>();
  for (const c of list) {
    const prev = m.get(c.uid);
    m.set(c.uid, prev ? { ...prev, hours: prev.hours + c.hours } : { ...c });
  }
  return [...m.values()];
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
