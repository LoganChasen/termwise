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
