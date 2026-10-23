"use client";

import { useId, useMemo, useState } from "react";
import { computeGrade, letterFor, projectGrade, remainingWork, solveForTarget } from "@/lib/grades";
import { formatPercent } from "@/lib/format";
import type { GradeCategory, GradeEntry, LetterCutoff } from "@/lib/types";
import { Button, Card, cx, focusRing } from "@/ui";
import { RangeTrack } from "./RangeTrack";
import { listNames, plural } from "./shared";

export interface GradeCalculatorProps {
  entries: GradeEntry[];
  categories: GradeCategory[];
  /** Sorted high → low. */
  scale: LetterCutoff[];
  color: string;
  /** Due labels for remaining items, keyed by entry name. */
  dueLabels: Record<string, string>;
}

type Target = { kind: "letter"; letter: string } | { kind: "percent"; value: string };

const num = (s: string | undefined) => {
  if (s === undefined || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function GradeCalculator({ entries, categories, scale, color, dueLabels }: GradeCalculatorProps) {
  const current = useMemo(() => computeGrade(entries, categories).percent, [entries, categories]);
  const remaining = useMemo(() => remainingWork(entries, categories), [entries, categories]);
  const best = useMemo(() => projectGrade(entries, categories, 100), [entries, categories]);
  const worst = useMemo(() => projectGrade(entries, categories, 0), [entries, categories]);
  const pace = useMemo(() => (current === null ? null : projectGrade(entries, categories, Math.min(100, current))), [entries, categories, current]);

  const letters = scale.filter((c) => c.min > 0);
  const [target, setTarget] = useState<Target>(() => ({ kind: "letter", letter: defaultLetter(scale, current, best) }));
  const targetPct = target.kind === "letter" ? (scale.find((c) => c.letter === target.letter)?.min ?? null) : num(target.value);
  const targetName = target.kind === "letter" ? `${/^[AEF]/.test(target.letter) ? "an" : "a"} ${target.letter}` : targetPct !== null ? `${formatPercent(targetPct, targetPct % 1 ? 1 : 0)} (${letterFor(targetPct, scale)})` : "";
  const solved = useMemo(() => (targetPct === null ? null : solveForTarget(entries, categories, targetPct)), [entries, categories, targetPct]);

  // What-if overrides: "g:<entry index>" for graded work, "r:<remaining index>" for work still to come.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showGraded, setShowGraded] = useState(false);
  const realRemaining = useMemo(() => entries.map((e, i) => (e.status === "ungraded" && (e.outOf ?? 0) > 0 ? i : -1)).filter((i) => i >= 0), [entries]);
  const gradedIdx = useMemo(() => entries.map((e, i) => (e.status === "graded" || e.status === "missing" ? i : -1)).filter((i) => i >= 0 && (entries[i]!.outOf ?? 0) > 0), [entries]);

  const whatIf = useMemo(() => {
    const next = entries.map((e, i) => {
      const v = num(overrides[`g:${i}`]);
      return v !== null ? { ...e, status: "graded" as const, score: v } : e;
    });
    const extra: GradeEntry[] = [];
    remaining.forEach((r, j) => {
      const v = num(overrides[`r:${j}`]);
      if (v === null) return;
      if (j < realRemaining.length) next[realRemaining[j]!] = { ...next[realRemaining[j]!]!, status: "graded", score: v };
      else extra.push({ ...r, status: "graded", score: v });
    });
    return computeGrade([...next, ...extra], categories).percent;
  }, [entries, categories, overrides, remaining, realRemaining]);
  const touched = Object.values(overrides).some((v) => num(v) !== null);
  const filledCount = remaining.filter((_, j) => num(overrides[`r:${j}`]) !== null).length;

  const fillBlanks = (pct: number) =>
    setOverrides((o) => {
      const n = { ...o };
      remaining.forEach((r, j) => {
        if (num(n[`r:${j}`]) === null) n[`r:${j}`] = String(Math.round(((r.outOf ?? 100) * pct) / 100 * 10) / 10);
      });
      return n;
    });

  const percentId = useId();

  if (categories.length === 0 && entries.length === 0) return null;

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="border-b border-border px-5 pt-5 pb-4">
        <h2 className="text-[15px] font-semibold text-ink">Grade calculator</h2>
        <p className="mt-0.5 text-sm text-ink-3">Figure out what you need, or try scores and see where you&apos;d land.</p>
      </div>

      {/* 1. What do I need? */}
      <section className="px-5 py-5" aria-labelledby={`${percentId}-need`}>
        <h3 id={`${percentId}-need`} className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">
          What do I need?
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Target letter grade">
          {letters.map((c) => {
            const on = target.kind === "letter" && target.letter === c.letter;
            const reachable = best === null || best >= c.min - 1e-9;
            return (
              <button
                key={c.letter}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTarget({ kind: "letter", letter: c.letter })}
                title={`${c.letter}: ${c.min}% or higher${reachable ? "" : " (out of reach)"}`}
                className={cx(
                  "tabular h-8 min-w-10 rounded-lg border px-2.5 text-[13px] font-semibold transition",
                  on ? "border-accent bg-accent text-accent-ink shadow-sm" : "border-border bg-surface hover:bg-surface-2",
                  !on && (reachable ? "text-ink" : "text-ink-3 line-through decoration-ink-3/50"),
                  focusRing,
                )}
              >
                {c.letter}
              </button>
            );
          })}
          <label htmlFor={percentId} className="ml-1 flex items-center gap-1.5 text-[13px] text-ink-3">
            or
            <span className={cx("relative inline-flex items-center rounded-lg border bg-surface", target.kind === "percent" ? "border-accent ring-1 ring-accent" : "border-border")}>
              <input
                id={percentId}
                inputMode="decimal"
                placeholder="85"
                value={target.kind === "percent" ? target.value : ""}
                onChange={(e) => setTarget({ kind: "percent", value: e.target.value.replace(/[^0-9.]/g, "") })}
                className="tabular h-8 w-14 rounded-lg bg-transparent pr-5 pl-2.5 text-[13px] text-ink outline-none placeholder:text-ink-3"
                aria-label="Target percent"
              />
              <span className="pointer-events-none absolute right-2 text-ink-3">%</span>
            </span>
          </label>
        </div>

        {solved && targetPct !== null && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <NeededBadge solved={solved} />
              <p className="text-[14px] leading-relaxed text-ink-2">
                <Sentence solved={solved} targetName={targetName} scale={scale} />
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] lg:min-w-[220px]">
              <dt className="text-ink-3">Best possible</dt>
              <dd className="tabular text-right font-medium text-ink">
                {formatPercent(solved.best)} <span className="text-ink-3">{letterFor(solved.best, scale)}</span>
              </dd>
              <dt className="text-ink-3">Worst possible</dt>
              <dd className="tabular text-right font-medium text-ink">
                {formatPercent(solved.worst)} <span className="text-ink-3">{letterFor(solved.worst, scale)}</span>
              </dd>
              <dt className="text-ink-3">Current pace</dt>
              <dd className="tabular text-right font-medium text-ink">
                {formatPercent(pace)} <span className="text-ink-3">{letterFor(pace, scale)}</span>
              </dd>
            </dl>
          </div>
        )}
      </section>

      {/* 3. Final grade range */}
      {best !== null && worst !== null && (
        <section className="border-t border-border px-5 py-5">
          <h3 className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">Final grade range</h3>
          <RangeTrack worst={worst} best={best} pace={pace} whatIf={touched ? whatIf : null} target={targetPct} scale={scale} color={color} />
        </section>
      )}

      {/* 2. What if */}
      <section className="border-t border-border bg-surface-2/40 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">What if…</h3>
            <p className="mt-1 text-[13px] text-ink-3">Type scores you think you&apos;ll get. Blank items don&apos;t count yet, same as Canvas.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="sm:text-right" aria-live="polite">
              <div className="text-[12px] text-ink-3">{touched ? "Projected" : "Right now"}</div>
              <div className="tabular text-xl font-semibold tracking-tight text-ink">
                {formatPercent(touched ? whatIf : current)}{" "}
                <span className="text-ink-2">{letterFor(touched ? whatIf : current, scale) ?? ""}</span>
              </div>
              {touched && whatIf !== null && current !== null && (
                <div className={cx("tabular text-[12px] font-medium", whatIf - current >= 0 ? "text-success" : "text-danger")}>
                  {whatIf - current >= 0 ? "+" : "−"}
                  {Math.abs(whatIf - current).toFixed(1)} vs. now
                </div>
              )}
            </div>
            <Button size="sm" onClick={() => setOverrides({})} disabled={!touched} aria-label="Reset what-if scores">
              Reset
            </Button>
          </div>
        </div>

        {remaining.length > 0 ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
              <span className="mr-1">Fill blanks with</span>
              {[...(current !== null ? [Math.round(Math.min(100, current))] : []), 100, 90, 80, 70]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((p, i) => (
                  <button key={p} type="button" onClick={() => fillBlanks(p)} disabled={filledCount === remaining.length} className={cx("tabular h-7 rounded-md border border-border bg-surface px-2 font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-50", focusRing)}>
                    {i === 0 && current !== null ? `Your avg (${p}%)` : `${p}%`}
                  </button>
                ))}
            </div>
            <ScoreList
              title={`Still to come · ${remaining.length}`}
              rows={remaining.map((r, j) => ({ key: `r:${j}`, entry: r, hint: dueLabels[r.name] ?? (j >= realRemaining.length ? "Not in Canvas yet" : null) }))}
              overrides={overrides}
              setOverrides={setOverrides}
            />
          </>
        ) : (
          <p className="mt-4 text-[13px] text-ink-3">Everything is graded. You can still change a graded score below.</p>
        )}

        {gradedIdx.length > 0 && (
          <div className="mt-4">
            <button type="button" aria-expanded={showGraded} onClick={() => setShowGraded((v) => !v)} className={cx("inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent hover:underline", focusRing)}>
              <span className={cx("inline-block transition", showGraded && "rotate-90")}>›</span>
              {showGraded ? "Hide graded work" : `Change a graded score (${gradedIdx.length})`}
            </button>
            {showGraded && (
              <ScoreList
                title="Graded"
                rows={gradedIdx.map((i) => ({ key: `g:${i}`, entry: entries[i]!, hint: entries[i]!.status === "missing" ? "Missing (counts as 0)" : null }))}
                overrides={overrides}
                setOverrides={setOverrides}
                graded
              />
            )}
          </div>
        )}
      </section>
    </Card>
  );
}

function ScoreList({
  title,
  rows,
  overrides,
  setOverrides,
  graded,
}: {
  title: string;
  rows: { key: string; entry: GradeEntry; hint: string | null }[];
  overrides: Record<string, string>;
  setOverrides: (fn: (o: Record<string, string>) => Record<string, string>) => void;
  graded?: boolean;
}) {
  const LIMIT = 8;
  const [all, setAll] = useState(false);
  const hiddenCount = rows.length - LIMIT;
  // Always show rows with a typed score, even when collapsed.
  const shown = all || hiddenCount <= 1 ? rows : rows.filter((r, i) => i < LIMIT || (overrides[r.key] ?? "") !== "");
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-3 py-2 text-[12px] font-medium text-ink-3">{title}</div>
      <ul className="divide-y divide-border">
        {shown.map(({ key, entry, hint }) => {
          const raw = overrides[key] ?? "";
          const v = num(raw);
          const out = entry.outOf ?? 100;
          const actual = entry.status === "missing" ? 0 : entry.score;
          const changed = v !== null && (!graded || v !== actual);
          return (
            <li key={key} className={cx("flex items-center gap-3 px-3 py-2", changed && "bg-accent-soft/50")}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-ink">{entry.name}</div>
                <div className="truncate text-[12px] text-ink-3">
                  {[
                    entry.category && entry.category !== entry.name ? { t: entry.category, cls: hint || graded ? "hidden sm:inline" : "" } : null,
                    hint ? { t: hint, cls: "" } : null,
                    graded && actual !== null ? { t: `was ${actual}/${out}`, cls: "tabular" } : null,
                  ]
                    .filter((x) => x !== null)
                    .map((x, i, parts) => (
                      <span key={i} className={x.cls}>
                        {i > 0 && <span className={i === 1 && parts[0]!.cls.includes("hidden") ? "hidden sm:inline" : ""}> · </span>}
                        {x.t}
                      </span>
                    ))}
                </div>
              </div>
              <span className="tabular hidden w-12 text-right text-[12px] text-ink-3 sm:block">{v !== null ? formatPercent((v / out) * 100, 0) : ""}</span>
              <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-3">
                <span className="sr-only">Score for {entry.name}</span>
                <input
                  inputMode="decimal"
                  value={raw}
                  placeholder={graded && actual !== null ? String(actual) : "—"}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, "");
                    setOverrides((o) => ({ ...o, [key]: val }));
                  }}
                  className={cx(
                    "tabular h-8 w-16 rounded-md border bg-surface px-2 text-right text-[13px] text-ink placeholder:text-ink-3",
                    changed ? "border-accent" : "border-border",
                    focusRing,
                  )}
                />
                <span className="tabular w-10">/ {out}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 1 && (all || shown.length < rows.length) && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className={cx("w-full border-t border-border px-3 py-2 text-left text-[13px] font-medium text-accent hover:bg-surface-2", focusRing)}>
          {all ? "Show fewer" : `Show ${rows.length - shown.length} more`}
        </button>
      )}
    </div>
  );
}

function NeededBadge({ solved }: { solved: ReturnType<typeof solveForTarget> }) {
  let label: string;
  let tone: string;
  if (solved.remaining.length === 0) {
    label = "Done";
    tone = "bg-surface-2 text-ink-2";
  } else if (solved.needed === null) {
    label = "Out of reach";
    tone = "bg-danger/10 text-danger";
  } else if (solved.needed === 0) {
    label = "Locked in";
    tone = "bg-success/10 text-success";
  } else {
    label = formatPercent(solved.needed, solved.needed % 1 ? 1 : 0);
    tone = solved.needed > 95 ? "bg-danger/10 text-danger" : solved.needed > 85 ? "bg-warning/10 text-warning" : "bg-accent-soft text-accent";
  }
  const isPct = label.endsWith("%");
  return (
    <div className={cx("grid h-[68px] w-[92px] shrink-0 place-items-center rounded-xl text-center", tone)}>
      <div>
        <div className={cx("tabular leading-none font-semibold tracking-tight", isPct ? (label.length > 4 ? "text-[23px]" : "text-[28px]") : "text-[14px]")}>{label}</div>
        {isPct && <div className="mt-1 text-[11px] font-medium opacity-80">needed</div>}
      </div>
    </div>
  );
}

function Sentence({ solved, targetName, scale }: { solved: ReturnType<typeof solveForTarget>; targetName: string; scale: LetterCutoff[] }) {
  const n = solved.remaining.length;
  const names = listNames(solved.remaining.map((r) => r.name));
  const items = n === 1 ? `the last item left (${names})` : `the ${plural(n, "item")} left (${names})`;
  if (n === 0 || solved.best === null || solved.worst === null) {
    return solved.best === null ? (
      <>Nothing is graded yet and there&apos;s no remaining work to plan around.</>
    ) : (
      <>
        Everything is graded. You&apos;re finishing at <b className="text-ink">{formatPercent(solved.best)}</b> ({letterFor(solved.best, scale)}).
      </>
    );
  }
  if (solved.needed === null) {
    return (
      <>
        {targetName.charAt(0).toUpperCase() + targetName.slice(1)} is out of reach now. Even with 100% on {items}, you&apos;d finish at{" "}
        <b className="text-ink">{formatPercent(solved.best)}</b> ({letterFor(solved.best, scale)}).
      </>
    );
  }
  if (solved.needed === 0) {
    return (
      <>
        You&apos;ve locked in {targetName} or better. Even scoring zero on {items}, you&apos;d finish at <b className="text-ink">{formatPercent(solved.worst)}</b>.
      </>
    );
  }
  return (
    <>
      You need to average about <b className="text-ink">{formatPercent(solved.needed, solved.needed % 1 ? 1 : 0)}</b> on {items} to finish with {targetName}.
      {solved.needed > 95 && " That's a tall order, but it's still possible."}
    </>
  );
}

/** The next letter up if it's still reachable, else the current letter. */
function defaultLetter(scale: LetterCutoff[], current: number | null, best: number | null): string {
  const letters = scale.filter((c) => c.min > 0);
  if (current === null) return letters[0]?.letter ?? "A";
  const idx = letters.findIndex((c) => current >= c.min - 1e-9);
  const cur = idx === -1 ? letters.length - 1 : idx;
  const up = letters[cur - 1];
  if (up && (best === null || best >= up.min)) return up.letter;
  return letters[cur]?.letter ?? letters[0]!.letter;
}
