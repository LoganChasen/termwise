import { addDays, dayKey, daysBetween, parseDay } from "./dates";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** "9:00 AM" → "9am", "11:59 PM" → "11:59pm". */
export function formatTime(d: Date): string {
  return TIME.format(d).replace(":00", "").replace(" AM", "am").replace(" PM", "pm");
}

/** "HH:MM" (24h) → "2:30pm". */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return formatTime(d);
}

/** "Today", "Tomorrow", "Wed", or "Oct 30" depending on distance from today. */
export function relativeDay(day: string, now: Date): string {
  const diff = daysBetween(dayKey(now), day);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return WEEKDAY.format(parseDay(day));
  return MONTH_DAY.format(parseDay(day));
}

/** "Thu, Oct 22". */
export function longDay(day: string): string {
  const d = parseDay(day);
  return `${WEEKDAY.format(d)}, ${MONTH_DAY.format(d)}`;
}

/** "Oct 22". */
export function shortDay(day: string): string {
  return MONTH_DAY.format(parseDay(day));
}

/** Due label for an item: "Today 11:59pm", "Fri 9am", "Oct 30". */
export function dueLabel(item: { start: string; allDay: boolean; day: string }, now: Date): string {
  const rel = relativeDay(item.day, now);
  return item.allDay ? rel : `${rel} ${formatTime(new Date(item.start))}`;
}

/** Countdown: "in 3h", "in 2d", "5h ago", "now". */
export function countdown(ms: number, now: Date): string {
  const diff = ms - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  let s: string;
  if (mins < 1) return "now";
  if (mins < 60) s = `${mins}m`;
  else if (hours < 36) s = `${hours}h`;
  else s = `${days}d`;
  return diff >= 0 ? `in ${s}` : `${s} ago`;
}

/** "2.5h", "45m", "0h". */
export function formatHours(h: number): string {
  if (h <= 0) return "0h";
  if (h < 1) return `${Math.round(h * 60)}m`;
  const r = Math.round(h * 2) / 2;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}h`;
}

/** "93.4%" */
export function formatPercent(p: number | null, digits = 1): string {
  return p === null ? "—" : `${p.toFixed(digits)}%`;
}

/** "Mon–Fri" style list: ["Tue","Thu"] → "Tue & Thu", ["Mon","Wed","Fri"] → "Mon, Wed & Fri". */
export function formatDays(days: string[]): string {
  if (days.length <= 1) return days.join("");
  return `${days.slice(0, -1).join(", ")} & ${days.at(-1)}`;
}

/** "Just now", "3h ago", "Yesterday", "Oct 12". */
export function ago(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return relativeDay(dayKey(new Date(iso)), now);
}

/** The Monday-to-Sunday label for a week: "Oct 19 – 25". */
export function weekLabel(monday: string): string {
  const a = parseDay(monday);
  const b = parseDay(addDays(monday, 6));
  const sameMonth = a.getMonth() === b.getMonth();
  return `${MONTH_DAY.format(a)} – ${sameMonth ? b.getDate() : MONTH_DAY.format(b)}`;
}
