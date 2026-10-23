import type { WorkType } from "./types";

/** Every tunable number in one place. */
export const config = {
  estimate: {
    /** Typical hours for one item of each type, before scaling. */
    baseHours: {
      exam: 0, // the exam itself; study time is examPrepHours
      quiz: 1,
      "problem-set": 3,
      lab: 2.5,
      essay: 5,
      project: 8,
      presentation: 3,
      reading: 1.5,
      discussion: 0.75,
      other: 2,
    } satisfies Record<WorkType, number>,
    /**
     * How many items of a type a course "usually" has. A course with more than this
     * gets smaller items each (25 discussion posts are each quick); fewer means bigger ones.
     */
    typicalCount: {
      exam: 2,
      quiz: 8,
      "problem-set": 10,
      lab: 8,
      essay: 3,
      project: 2,
      presentation: 2,
      reading: 12,
      discussion: 12,
      other: 10,
    } satisfies Record<WorkType, number>,
    /** Scale = (typical / count) ^ countExponent, clamped to [minScale, maxScale]. */
    countExponent: 0.5,
    minScale: 0.6,
    maxScale: 1.6,
    /** Study hours before a midterm / a final exam. */
    examPrepHours: { midterm: 8, final: 12 },
  },
  heatmap: {
    /** Days of work leading up to (and including) the due day, by type. */
    leadDays: {
      exam: 5,
      quiz: 2,
      "problem-set": 4,
      lab: 3,
      essay: 7,
      project: 10,
      presentation: 4,
      reading: 2,
      discussion: 1,
      other: 3,
    } satisfies Record<WorkType, number>,
    /** Items due before this hour count the previous day as the last work day. */
    morningCutoffHour: 12,
    /** Upper bounds (hours) for heat levels 0..4; anything above the last is level 5. */
    levelThresholds: [0.25, 1, 2, 3.5, 5],
    /** A week is a crunch week if it's this many times the median week and at least crunchMinHours. */
    crunchVsMedian: 1.4,
    crunchMinHours: 12,
    /** ...or if it holds at least this many exams. */
    crunchExamCount: 2,
  },
  /** Course colors (chips, heat-map breakdowns). Distinct in light and dark mode. */
  courseColors: ["#4f46e5", "#0d9488", "#db2777", "#ca8a04", "#2563eb", "#7c3aed", "#059669", "#ea580c"],
} as const;

export function courseColor(index: number): string {
  const c = config.courseColors;
  return c[((index % c.length) + c.length) % c.length]!;
}
