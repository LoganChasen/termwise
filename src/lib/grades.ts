import { detectWorkType } from "./estimate";
import type { GradeCategory, GradeEntry, LetterCutoff } from "./types";

export const DEFAULT_SCALE: LetterCutoff[] = [
  { letter: "A", min: 93 },
  { letter: "A-", min: 90 },
  { letter: "B+", min: 87 },
  { letter: "B", min: 83 },
  { letter: "B-", min: 80 },
  { letter: "C+", min: 77 },
  { letter: "C", min: 73 },
  { letter: "C-", min: 70 },
  { letter: "D+", min: 67 },
  { letter: "D", min: 60 },
  { letter: "F", min: 0 },
];

export interface CategoryResult {
  name: string;
  weight: number;
  earned: number;
  possible: number;
  /** Null until something in the category is graded. */
  percent: number | null;
  counted: number;
  /** Names of the scores dropped by a drop-lowest rule. */
  dropped: string[];
}

export interface GradeResult {
  /** Current grade over what's been graded so far, 0–100+. Null if nothing is graded. */
  percent: number | null;
  weighted: boolean;
  categories: CategoryResult[];
}

const OTHER = "Other";

/**
 * Canvas-style grade: within each category, points earned / points possible
 * (after dropping the lowest scores if the syllabus says so); across categories,
 * a weighted average re-normalized over the categories that have grades yet.
 * Missing work counts as zero; excused and ungraded work doesn't count.
 */
export function computeGrade(entries: GradeEntry[], categories: GradeCategory[]): GradeResult {
  const weighted = categories.reduce((s, c) => s + c.weight, 0) > 0;
  const groups = new Map<string, { cat: GradeCategory; items: { name: string; earned: number; possible: number }[] }>();
  for (const c of categories) groups.set(c.name, { cat: c, items: [] });

  for (const e of entries) {
    if (e.status === "excused" || e.status === "ungraded" || !e.outOf) continue;
    const earned = e.status === "missing" ? 0 : (e.score ?? 0);
    const name = matchCategory(e, categories)?.name ?? OTHER;
    if (!groups.has(name)) groups.set(name, { cat: { name, weight: 0, dropLowest: 0 }, items: [] });
    groups.get(name)!.items.push({ name: e.name, earned, possible: e.outOf });
  }

  const results: CategoryResult[] = [];
  for (const { cat, items } of groups.values()) {
    let kept = items;
    let dropped: string[] = [];
    if (cat.dropLowest > 0 && items.length > cat.dropLowest) {
      const sorted = [...items].sort((a, b) => a.earned / a.possible - b.earned / b.possible);
      dropped = sorted.slice(0, cat.dropLowest).map((i) => i.name);
      kept = sorted.slice(cat.dropLowest);
    }
    const earned = kept.reduce((s, i) => s + i.earned, 0);
    const possible = kept.reduce((s, i) => s + i.possible, 0);
    results.push({
      name: cat.name,
      weight: cat.weight,
      earned,
      possible,
      percent: possible > 0 ? (earned / possible) * 100 : null,
      counted: kept.length,
      dropped,
    });
  }

  let percent: number | null = null;
  if (weighted) {
    const graded = results.filter((r) => r.percent !== null && r.weight > 0);
    const w = graded.reduce((s, r) => s + r.weight, 0);
    if (w > 0) percent = graded.reduce((s, r) => s + r.weight * r.percent!, 0) / w;
  } else {
    const earned = results.reduce((s, r) => s + r.earned, 0);
    const possible = results.reduce((s, r) => s + r.possible, 0);
    if (possible > 0) percent = (earned / possible) * 100;
  }
  return { percent, weighted, categories: results };
}

/** Which syllabus category a Canvas entry belongs to. */
export function matchCategory(entry: Pick<GradeEntry, "name" | "category">, categories: GradeCategory[]): GradeCategory | null {
  if (categories.length === 0) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
  if (entry.category) {
    const c = norm(entry.category);
    const hit = categories.find((x) => norm(x.name) === c) ?? categories.find((x) => norm(x.name).includes(c) || c.includes(norm(x.name)));
    if (hit) return hit;
  }
  const n = norm(entry.name);
  const byName = categories.find((x) => n.includes(norm(x.name)));
  if (byName) return byName;
  const type = detectWorkType(entry.category ?? entry.name);
  return categories.find((x) => detectWorkType(x.name) === type && type !== "other") ?? null;
}

export function letterFor(percent: number | null, scale: LetterCutoff[] | null = null): string | null {
  if (percent === null) return null;
  const s = [...(scale ?? DEFAULT_SCALE)].sort((a, b) => b.min - a.min);
  return s.find((c) => percent >= c.min - 1e-9)?.letter ?? s.at(-1)?.letter ?? null;
}

export function minForLetter(letter: string, scale: LetterCutoff[] | null = null): number | null {
  return (scale ?? DEFAULT_SCALE).find((c) => c.letter === letter)?.min ?? null;
}

/**
 * Everything still to be graded: ungraded Canvas entries, plus one placeholder
 * for each syllabus category with nothing in Canvas yet (often the final exam).
 */
export function remainingWork(entries: GradeEntry[], categories: GradeCategory[]): GradeEntry[] {
  const out = entries.filter((e) => e.status === "ungraded" && (e.outOf ?? 0) > 0);
  for (const c of categories) {
    if (c.weight <= 0) continue;
    const has = entries.some((e) => e.status !== "excused" && matchCategory(e, categories)?.name === c.name);
    if (!has) out.push({ name: c.name, category: c.name, score: null, outOf: 100, status: "ungraded" });
  }
  return out;
}

/** The final grade if every remaining item scores `pct` percent. */
export function projectGrade(entries: GradeEntry[], categories: GradeCategory[], pct: number): number | null {
  const remaining = remainingWork(entries, categories);
  const filled = remaining.map((e) => ({ ...e, status: "graded" as const, score: ((e.outOf ?? 0) * pct) / 100 }));
  const known = entries.filter((e) => !(e.status === "ungraded" && (e.outOf ?? 0) > 0));
  return computeGrade([...known, ...filled], categories).percent;
}

export interface TargetResult {
  /** Average needed on all remaining work, 0–100. Null if the target can't be reached. */
  needed: number | null;
  /** Final grade with 100% on everything left. */
  best: number | null;
  /** Final grade with 0% on everything left. */
  worst: number | null;
  remaining: GradeEntry[];
}

/** "What do I need on the rest to finish with `target`%?" */
export function solveForTarget(entries: GradeEntry[], categories: GradeCategory[], target: number): TargetResult {
  const remaining = remainingWork(entries, categories);
  const best = projectGrade(entries, categories, 100);
  const worst = projectGrade(entries, categories, 0);
  if (remaining.length === 0 || best === null || worst === null) return { needed: null, best, worst, remaining };
  if (best < target - 1e-9) return { needed: null, best, worst, remaining };
  if (worst >= target) return { needed: 0, best, worst, remaining };
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if ((projectGrade(entries, categories, mid) ?? 0) >= target) hi = mid;
    else lo = mid;
  }
  return { needed: Math.ceil(hi * 10) / 10, best, worst, remaining };
}
