/**
 * Shared types. Everything under src/ codes against these.
 * Dates are ISO strings so they survive JSON and SQLite unchanged.
 */

export interface Course {
  /** Canvas course id from the feed (e.g. "12345"), or a slug of the label when the feed doesn't say. */
  id: string;
  /** Label Canvas puts in brackets after each event title, e.g. "FIN_320_1_FA26". */
  label: string;
  /** Short display name, e.g. "FIN 320". Editable in setup. */
  name: string;
  /** Index into the course color palette (src/lib/config.ts). */
  colorIndex: number;
}

export type FeedItemKind = "assignment" | "event";

/** One entry from the Canvas calendar feed. */
export interface FeedItem {
  /** Canvas UID, e.g. "event-assignment-678". Stable across feed refreshes. */
  uid: string;
  kind: FeedItemKind;
  title: string;
  /** Null for personal (user-level) calendar entries. */
  courseId: string | null;
  /** Due time for assignments; start time for events. */
  start: string;
  end: string | null;
  /** Date-only entry (no time of day). */
  allDay: boolean;
  /** Link back to Canvas. */
  url: string | null;
}

export interface ParsedFeed {
  courses: Course[];
  items: FeedItem[];
}

/** What kind of work an item is, guessed from its title (src/lib/estimate.ts). */
export type WorkType =
  | "exam"
  | "quiz"
  | "problem-set"
  | "lab"
  | "essay"
  | "project"
  | "presentation"
  | "reading"
  | "discussion"
  | "other";

export type UpdateKind = "added" | "removed" | "rescheduled" | "renamed" | "grade-posted" | "grade-changed";

/** One row in the Updates feed. */
export interface UpdateEvent {
  kind: UpdateKind;
  /** When Termwise noticed the change. */
  at: string;
  uid: string | null;
  courseId: string | null;
  title: string;
  /** Previous value (old due date, old title, old score). */
  before: string | null;
  /** New value. */
  after: string | null;
}

/** A feed item as stored locally, plus what the user did with it. */
export interface StoredItem extends FeedItem {
  firstSeen: string;
  /** Set when the user checks it off. */
  doneAt: string | null;
  /** User's own hours estimate, overriding the automatic one. */
  estimateOverride: number | null;
  /** Set when it disappeared from the feed while still upcoming. */
  removedAt: string | null;
}

// ---------- Syllabus (extracted by the Claude API, confirmed by the user) ----------

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface Meeting {
  days: Weekday[];
  /** "HH:MM", 24-hour. */
  start: string;
  end: string;
  location: string | null;
  kind: "lecture" | "lab" | "section" | "other";
}

export interface OfficeHours {
  who: string;
  days: Weekday[];
  start: string;
  end: string;
  location: string | null;
}

export interface SyllabusExam {
  title: string;
  /** "YYYY-MM-DD". */
  date: string;
  /** "HH:MM" or null if not stated. */
  time: string | null;
  type: "midterm" | "final" | "quiz" | "other";
  location: string | null;
}

export interface GradeCategory {
  name: string;
  /** Percent of the final grade, 0–100. */
  weight: number;
  /** How many lowest scores are dropped. */
  dropLowest: number;
}

export interface LetterCutoff {
  letter: string;
  /** Minimum percent for this letter. */
  min: number;
}

export interface SyllabusInfo {
  courseTitle: string | null;
  instructor: string | null;
  meetings: Meeting[];
  officeHours: OfficeHours[];
  exams: SyllabusExam[];
  categories: GradeCategory[];
  /** Null = use the default scale. */
  letterScale: LetterCutoff[] | null;
  latePolicy: string | null;
  /** Other rules worth knowing (attendance, extra credit, curve...). */
  notes: string[];
}

// ---------- Grades (pasted from the Canvas Grades page) ----------

export interface GradeEntry {
  name: string;
  /** Assignment group as Canvas shows it, e.g. "Problem Sets". */
  category: string | null;
  /** Null when not graded yet. */
  score: number | null;
  outOf: number | null;
  status: "graded" | "missing" | "excused" | "ungraded";
}

export interface CourseGrades {
  pastedAt: string;
  /** The total Canvas shows, if the paste included it. */
  canvasTotal: number | null;
  entries: GradeEntry[];
  /** Group weights from the Canvas Grades page sidebar, if present. */
  canvasWeights: { name: string; weight: number }[];
}
