/**
 * Local-calendar date helpers. Day keys are "YYYY-MM-DD" in the machine's time zone,
 * which is the student's own since Termwise runs on their computer.
 */

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight of a day key. */
export function parseDay(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: string): string {
  const dow = (parseDay(key).getDay() + 6) % 7; // Mon = 0
  return addDays(key, -dow);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** The local day an item is due/happens on. All-day items carry their date directly. */
export function itemDay(item: { start: string; allDay: boolean }): string {
  return item.allDay ? item.start.slice(0, 10) : dayKey(new Date(item.start));
}

/** Local hour (0–23) an item is due; all-day items count as end of day. */
export function itemHour(item: { start: string; allDay: boolean }): number {
  return item.allDay ? 23 : new Date(item.start).getHours();
}
