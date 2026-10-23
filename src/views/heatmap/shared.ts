import { config } from "@/lib/config";
import type { WorkType } from "@/lib/types";

/** The slice of an item the heat map needs (kept small so the client payload stays light). */
export interface HeatItem {
  uid: string;
  courseId: string | null;
  title: string;
  type: WorkType;
  start: string;
  allDay: boolean;
  hours: number;
  doneAt: string | null;
  day: string;
}

export interface HeatCourse {
  id: string;
  name: string;
  color: string;
}

export const PERSONAL: HeatCourse = { id: "__personal", name: "Personal", color: "var(--ink-3)" };

export const LEVEL_NAMES = ["Nothing planned", "Light", "Moderate", "Busy", "Heavy", "Very heavy"] as const;

/** Text color that reads on a heat cell of this level (heavy cells flip to the surface color). */
export function inkOnHeat(level: number): string {
  return level >= 4 ? "var(--surface)" : level >= 1 ? "var(--ink-2)" : "var(--ink-3)";
}

function amount(h: number): string {
  return h < 1 ? `${Math.round(h * 60)} min` : `${h}h`;
}

/** Plain-English range for each heat level, from config thresholds. */
export function levelRanges(): { short: string; long: string }[] {
  const t = config.heatmap.levelThresholds;
  const out: { short: string; long: string }[] = [];
  for (let i = 0; i <= t.length; i++) {
    const lo = i === 0 ? 0 : t[i - 1]!;
    const hi = t[i];
    if (i === 0) out.push({ short: `<${amount(hi!).replace(" min", "m")}`, long: `Under ${amount(hi!)}` });
    else if (hi === undefined) out.push({ short: `${amount(lo)}+`, long: `${amount(lo)} or more` });
    else {
      const a = amount(lo).replace(" min", "m");
      const b = amount(hi).replace(" min", "m");
      out.push({ short: lo >= 1 ? `${lo}–${hi}h` : `${a}–${b}`, long: `${amount(lo)} to ${amount(hi)}` });
    }
  }
  return out;
}

/** Spoken hours for screen readers: "45 minutes", "3.5 hours". */
export function spokenHours(h: number): string {
  if (h < 0.05) return "nothing planned";
  if (h < 1) return `${Math.max(5, Math.round((h * 60) / 5) * 5)} minutes`;
  const r = Math.round(h * 2) / 2;
  return `${r} ${r === 1 ? "hour" : "hours"}`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
