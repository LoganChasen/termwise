import { config } from "./config";
import type { FeedItem, WorkType } from "./types";

/**
 * Guess what kind of work an item is from its title. Order matters:
 * "Final Project" is a project, "Final Paper" an essay, "Final" alone an exam.
 */
const RULES: [WorkType, RegExp][] = [
  ["project", /\bprojects?\b|\bcapstone\b|\bportfolio\b/i],
  ["essay", /\b(essay|paper|report|memo|thesis|draft|write-?up|reflection|response)s?\b/i],
  ["presentation", /\b(presentation|pitch|slides|poster)s?\b/i],
  ["exam", /\b(midterm|mid-term|exam|final|test|prelim)s?\b/i],
  ["quiz", /\bquiz(zes)?\b/i],
  ["lab", /\blabs?\b|\bpracticum\b/i],
  ["problem-set", /\b(problem set|pset|p-set|homework|hw|exercises?|worksheets?|assignment|problems?|case)\b|\bps\s?\d/i],
  ["discussion", /\b(discussion|forum|post|reply|replies|comment)s?\b/i],
  ["reading", /\b(reading|readings|chapter|ch\.|read)\b/i],
];

export function detectWorkType(title: string): WorkType {
  for (const [type, re] of RULES) if (re.test(title)) return type;
  return "other";
}

export function isFinalExam(title: string): boolean {
  return /\bfinal\b/i.test(title);
}

/**
 * Estimated hours for every item, keyed by uid.
 * Base hours by type, scaled by how many items of that type the course has:
 * many small ones → each is smaller, a few big ones → each is bigger.
 * Exams get study time instead (midterm vs final).
 */
export function estimateHours(items: Pick<FeedItem, "uid" | "title" | "courseId">[]): Map<string, number> {
  const { baseHours, typicalCount, countExponent, minScale, maxScale, examPrepHours } = config.estimate;
  const types = new Map(items.map((i) => [i.uid, detectWorkType(i.title)]));

  const counts = new Map<string, number>();
  for (const i of items) {
    const key = `${i.courseId ?? "-"}|${types.get(i.uid)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out = new Map<string, number>();
  for (const i of items) {
    const type = types.get(i.uid)!;
    if (type === "exam") {
      out.set(i.uid, isFinalExam(i.title) ? examPrepHours.final : examPrepHours.midterm);
      continue;
    }
    const n = counts.get(`${i.courseId ?? "-"}|${type}`) ?? 1;
    const scale = Math.min(maxScale, Math.max(minScale, (typicalCount[type] / n) ** countExponent));
    out.set(i.uid, round(baseHours[type] * scale));
  }
  return out;
}

/** Round to the nearest quarter hour. */
function round(h: number): number {
  return Math.round(h * 4) / 4;
}
