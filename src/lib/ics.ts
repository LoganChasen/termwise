import ical from "node-ical";
import type { Course, FeedItem, ParsedFeed } from "./types";

/**
 * Parse a Canvas calendar feed (.ics).
 *
 * Canvas writes each entry like:
 *   SUMMARY:Problem Set 4 [FIN_320_1_FA26]
 *   UID:event-assignment-678
 *   URL:https://canvas.emory.edu/calendar?include_contexts=course_12345&...#assignment_678
 * The bracketed suffix is the course label and `course_<id>` in the URL is the course id.
 */
export function parseFeed(icsText: string): ParsedFeed {
  const data = ical.sync.parseICS(icsText);
  const courses = new Map<string, Course>();
  const items: FeedItem[] = [];

  for (const component of Object.values(data)) {
    if (!component || component.type !== "VEVENT") continue;
    const ev = component;
    const uid = ev.uid;
    const summary = text(ev.summary);
    if (!uid || !summary || !ev.start) continue;

    const { title, label } = splitLabel(summary);
    const url = text(ev.url) || null;
    const contextCourse = url?.match(/include_contexts=course_(\d+)/)?.[1] ?? null;
    const isPersonal = !!url?.match(/include_contexts=user_\d+/) && !contextCourse;

    let courseId: string | null = null;
    if (!isPersonal && (contextCourse || label)) {
      courseId = contextCourse ?? slug(label!);
      if (!courses.has(courseId)) {
        courses.set(courseId, { id: courseId, label: label ?? courseId, name: displayName(label ?? courseId), colorIndex: courses.size });
      }
    }

    const allDay = ev.datetype === "date";
    items.push({
      uid,
      kind: uid.startsWith("event-assignment") ? "assignment" : "event",
      title,
      courseId,
      start: toIso(ev.start, allDay),
      end: ev.end ? toIso(ev.end, allDay) : null,
      allDay,
      url: assignmentUrl(url, uid),
    });
  }

  items.sort((a, b) => a.start.localeCompare(b.start));
  return { courses: [...courses.values()], items };
}

/** "Problem Set 4 [FIN_320_1_FA26]" → { title: "Problem Set 4", label: "FIN_320_1_FA26" }. Handles nested brackets. */
export function splitLabel(summary: string): { title: string; label: string | null } {
  const s = summary.trim();
  if (!s.endsWith("]")) return { title: s, label: null };
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === "]") depth++;
    else if (s[i] === "[" && --depth === 0) {
      const title = s.slice(0, i).trim();
      const label = s.slice(i + 1, -1).trim();
      return title && label ? { title, label } : { title: s, label: null };
    }
  }
  return { title: s, label: null };
}

/**
 * Best-effort short name from a Canvas label:
 * "FIN_320_1_FA26" → "FIN 320", "Fall 2026 - CS 170 - 001" → "CS 170", "Intro to Econ" → "Intro to Econ".
 */
export function displayName(label: string): string {
  const m = label.match(/(?:^|[^A-Za-z])([A-Z]{2,5})[\s_-]*(\d{3}[A-Z]?)(?!\d)/);
  if (m) return `${m[1]} ${m[2]}`;
  return label.trim();
}

/** Canvas links feed entries to the calendar page; rewrite assignment entries to the assignment itself. */
function assignmentUrl(url: string | null, uid: string): string | null {
  if (!url) return null;
  const course = url.match(/include_contexts=course_(\d+)/)?.[1];
  const assignment = uid.match(/^event-assignment-(\d+)$/)?.[1];
  if (course && assignment) {
    try {
      return `${new URL(url).origin}/courses/${course}/assignments/${assignment}`;
    } catch {
      return url;
    }
  }
  return url;
}

function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && "val" in v) return String((v as { val: unknown }).val).trim();
  return "";
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** All-day dates become local-midnight-free "YYYY-MM-DD" ISO dates so they don't shift across time zones. */
function toIso(d: Date, allDay: boolean): string {
  if (allDay) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return d.toISOString();
}
