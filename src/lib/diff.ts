import type { FeedItem, UpdateEvent } from "./types";

/**
 * Compare the previous feed with the new one and describe what changed.
 * Canvas drops old entries from the feed over time, so a missing item only
 * counts as "removed" if it was still upcoming.
 */
export function diffFeed(prev: FeedItem[], next: FeedItem[], now: Date): UpdateEvent[] {
  const at = now.toISOString();
  const before = new Map(prev.map((i) => [i.uid, i]));
  const after = new Map(next.map((i) => [i.uid, i]));
  const out: UpdateEvent[] = [];

  for (const item of next) {
    const old = before.get(item.uid);
    const base = { at, uid: item.uid, courseId: item.courseId, title: item.title };
    if (!old) {
      out.push({ ...base, kind: "added", before: null, after: item.start });
      continue;
    }
    if (old.start !== item.start) out.push({ ...base, kind: "rescheduled", before: old.start, after: item.start });
    if (old.title !== item.title) out.push({ ...base, kind: "renamed", before: old.title, after: item.title });
  }

  for (const old of prev) {
    if (after.has(old.uid)) continue;
    if (dueTime(old) < now.getTime()) continue;
    out.push({ kind: "removed", at, uid: old.uid, courseId: old.courseId, title: old.title, before: old.start, after: null });
  }
  return out;
}

/** Milliseconds for an item's start; all-day items count as due at the end of that day. */
export function dueTime(item: Pick<FeedItem, "start" | "allDay">): number {
  if (item.allDay) {
    const [y, m, d] = item.start.split("-").map(Number);
    return new Date(y!, m! - 1, d!, 23, 59, 59).getTime();
  }
  return new Date(item.start).getTime();
}
