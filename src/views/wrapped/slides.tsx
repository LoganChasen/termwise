"use client";

import type { ReactNode } from "react";
import { earlyLabel, spanDays, type WrappedStats } from "@/lib/wrapped";
import { formatHours, longDay, shortDay } from "@/lib/format";
import { IconCheck, IconClock, IconHeat, IconMoon, IconWrapped } from "@/ui";
import { BigNumber, Caption, Footnote, Headline, panel, SlideFrame } from "./Slide";

export interface SlideDef {
  id: string;
  label: string;
  render: (animate: boolean) => ReactNode;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/** The slide deck for a recap. Slides whose stat can't be computed are left out. */
export function buildSlides(s: WrappedStats): SlideDef[] {
  const out: SlideDef[] = [];
  const soFar = s.inProgress;

  out.push({
    id: "intro",
    label: "Intro",
    render: () => (
      <SlideFrame tone="dusk" mosaic={1} kicker={<><IconWrapped size={16} /> Termwise Wrapped</>}>
        <div className="text-[18px] font-medium opacity-85 sm:text-[22px]">{soFar ? "Your semester so far" : "Your semester, wrapped"}</div>
        <Headline size="xl">{s.season}</Headline>
        <Caption>
          {plural(s.courseCount, "class", "classes")}. {soFar ? `${s.week} of ${s.weeksTotal} weeks down.` : `${s.weeksTotal} weeks.`} Here&rsquo;s how it{soFar ? "’s going" : " went"}.
        </Caption>
        <Footnote>Press → or tap Next.</Footnote>
      </SlideFrame>
    ),
  });

  if (s.completed > 0) {
    out.push({
      id: "completed",
      label: "Assignments",
      render: (a) => (
        <SlideFrame tone="indigo" mosaic={2} kicker={<><IconCheck size={16} /> Checked off</>}>
          <BigNumber value={s.completed} animate={a} />
          <Caption>
            assignments done.{" "}
            {s.onTimeRate === 1 ? "Every single one before the deadline." : `${s.onTime} of them on time (${pct(s.onTimeRate!)}).`}
          </Caption>
          {soFar && s.remaining > 0 && <Footnote>{plural(s.remaining, "more")} still to go this semester.</Footnote>}
        </SlideFrame>
      ),
    });
  }

  if (s.hours > 0) {
    const top = s.hoursByCourse[0]!;
    out.push({
      id: "hours",
      label: "Hours",
      render: (a) => (
        <SlideFrame tone="ember" mosaic={3} kicker={<><IconClock size={16} /> Time put in</>}>
          <BigNumber value={Math.round(s.hours)} unit="hours" animate={a} />
          <Caption>
            of work, by Termwise&rsquo;s estimate. {top.name} took the most: {formatHours(top.hours)}.
          </Caption>
          <CourseBars rows={s.hoursByCourse} total={s.hours} />
        </SlideFrame>
      ),
    });
  }

  if (s.busiestWeek) {
    const w = s.busiestWeek;
    out.push({
      id: "week",
      label: "Busiest week",
      render: () => (
        <SlideFrame tone="ink" mosaic={4} kicker={<><IconHeat size={16} /> Busiest week</>}>
          <Headline>{w.label}</Headline>
          <Caption>
            About {formatHours(w.hours)} of work, {plural(w.due, "thing")} due{w.exams > 0 ? ` and ${plural(w.exams, "exam")}` : ""}. You got through it.
          </Caption>
          <div className="mt-6 grid max-w-md grid-cols-7 gap-1.5 sm:gap-2">
            {w.levels.map((l, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="aspect-square w-full rounded-md" style={{ background: `var(--heat-${l})`, boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 14%, transparent)" }} />
                <span className="text-[11px] font-medium opacity-70">{DOW[i]}</span>
              </div>
            ))}
          </div>
          {s.busiestDay && <Footnote>Heaviest single day: {longDay(s.busiestDay.date)}, about {formatHours(s.busiestDay.hours)}.</Footnote>}
        </SlideFrame>
      ),
    });
  }

  if (s.examsTaken > 0) {
    out.push({
      id: "exams",
      label: "Exams",
      render: (a) => (
        <SlideFrame tone="sunrise" mosaic={5} kicker="Exams">
          <BigNumber value={s.examsTaken} animate={a} />
          <Caption>{s.examsTaken === 1 ? "exam taken" : "exams taken"}. {s.examsLeft > 0 ? `${plural(s.examsLeft, "more")} to go.` : "That's all of them."}</Caption>
        </SlideFrame>
      ),
    });
  }

  if (s.streak && s.streak.count >= 3) {
    const st = s.streak;
    out.push({
      id: "streak",
      label: "Streak",
      render: (a) => (
        <SlideFrame tone="dusk" mosaic={6} kicker="Longest streak">
          <BigNumber value={st.count} animate={a} />
          <Caption>
            deadlines in a row, all on time. {shortDay(st.from)} to {shortDay(st.to)}: {spanDays(st.from, st.to)} days without slipping.
          </Caption>
        </SlideFrame>
      ),
    });
  }

  if (s.earliest) {
    const e = s.earliest;
    out.push({
      id: "early",
      label: "Early bird",
      render: () => (
        <SlideFrame tone="ember" mosaic={7} kicker="Early bird">
          <Headline>{earlyLabel(e.msEarly)}</Headline>
          <Caption>
            Your earliest finish: {e.title} for {e.name}, done well before it was due.
          </Caption>
        </SlideFrame>
      ),
    });
  }

  if (s.nightOwl && s.nightOwl.count > 0) {
    const n = s.nightOwl;
    out.push({
      id: "night",
      label: "Night owl",
      render: (a) => (
        <SlideFrame tone="ink" mosaic={8} kicker={<><IconMoon size={16} /> Night owl</>}>
          <BigNumber value={n.count} animate={a} />
          <Caption>
            late-night deadlines finished on the day they were due, out of {n.of}. {n.count / n.of < 0.35 ? "Mostly, you got ahead of them." : "Some things just happen after dark."}
          </Caption>
          <Footnote>Counts work due at 9pm or later that you checked off the same day.</Footnote>
        </SlideFrame>
      ),
    });
  }

  if (s.best) {
    const b = s.best;
    out.push({
      id: "grades",
      label: "Grades",
      render: () => (
        <SlideFrame tone="indigo" mosaic={9} kicker={soFar ? "Best class right now" : "Best class"}>
          <Headline>{b.name}</Headline>
          <Caption>
            {b.percent.toFixed(1)}%{b.letter ? ` · ${b.letter}` : ""}. Your strongest grade {soFar ? "so far" : "this semester"}.
          </Caption>
          {s.grades.length > 1 && (
            <ul className="mt-6 grid max-w-lg gap-1.5 rounded-xl p-2" style={panel}>
              {s.grades.map((g, i) => (
                <li key={g.courseId} className="tabular flex items-center gap-3 rounded-lg px-3 py-1.5 text-[15px]" style={i === 0 ? { background: "color-mix(in srgb, currentColor 12%, transparent)" } : undefined}>
                  <span className="w-4 text-[12px] opacity-70">{i + 1}</span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.color, boxShadow: "0 0 0 2px color-mix(in srgb, currentColor 35%, transparent)" }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
                  <span className="opacity-90">{g.percent.toFixed(1)}%</span>
                  <span className="w-7 text-right font-semibold">{g.letter}</span>
                </li>
              ))}
            </ul>
          )}
        </SlideFrame>
      ),
    });
  }

  if (s.mostImproved) {
    const m = s.mostImproved;
    out.push({
      id: "improved",
      label: "Most improved",
      render: (a) => (
        <SlideFrame tone="sunrise" mosaic={10} kicker="Most improved">
          <BigNumber value={m.delta} decimals={1} prefix="+" unit="pts" animate={a} />
          <Caption>
            in {m.name}. Your average score went from {m.from.toFixed(1)}% on the first half of graded work to {m.to.toFixed(1)}% on the second.
          </Caption>
          <Footnote>Based on {m.graded} graded items, in due-date order.</Footnote>
        </SlideFrame>
      ),
    });
  }

  out.push({ id: "summary", label: "Summary", render: () => <Summary s={s} /> });
  return out;
}

function CourseBars({ rows, total }: { rows: WrappedStats["hoursByCourse"]; total: number }) {
  return (
    <div className="mt-6 max-w-xl rounded-xl p-3 sm:p-4" style={panel}>
      <div className="flex h-3 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, currentColor 14%, transparent)" }}>
        {rows.map((r) => (
          <span key={r.courseId} style={{ width: `${(r.hours / total) * 100}%`, background: r.color, boxShadow: "inset -1px 0 0 color-mix(in srgb, currentColor 40%, transparent)" }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
        {rows.map((r) => (
          <li key={r.courseId} className="tabular flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: r.color, boxShadow: "0 0 0 1.5px color-mix(in srgb, currentColor 40%, transparent)" }} />
            <span className="truncate font-medium">{r.name}</span>
            <span className="ml-auto opacity-80">{formatHours(r.hours)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Summary({ s }: { s: WrappedStats }) {
  const tiles: { label: string; value: string; hint?: string }[] = [];
  tiles.push({ label: "Done", value: s.completed.toLocaleString("en-US"), hint: s.remaining > 0 && s.inProgress ? `${s.remaining} to go` : undefined });
  if (s.onTimeRate !== null) tiles.push({ label: "On time", value: pct(s.onTimeRate), hint: `${s.onTime} of ${s.completed}` });
  if (s.hours > 0) tiles.push({ label: "Hours of work", value: `${Math.round(s.hours)}h`, hint: s.hoursByCourse[0] ? `Most: ${s.hoursByCourse[0].name}` : undefined });
  tiles.push({ label: "Exams taken", value: String(s.examsTaken), hint: s.examsLeft > 0 ? `${s.examsLeft} left` : undefined });
  if (s.best) tiles.push({ label: "Best class", value: s.best.name, hint: `${s.best.percent.toFixed(1)}%${s.best.letter ? ` · ${s.best.letter}` : ""}` });
  if (s.streak) tiles.push({ label: "On-time streak", value: String(s.streak.count), hint: "deadlines in a row" });
  if (s.busiestWeek) tiles.push({ label: "Busiest week", value: s.busiestWeek.label, hint: `~${formatHours(s.busiestWeek.hours)} of work` });
  if (s.mostImproved) tiles.push({ label: "Most improved", value: s.mostImproved.name, hint: `+${s.mostImproved.delta.toFixed(1)} pts` });
  else if (s.topType) tiles.push({ label: "Most done", value: String(s.topType.count), hint: s.topType.label });

  return (
    <SlideFrame tone="dusk" mosaic={11} kicker={<><IconWrapped size={16} /> Termwise Wrapped</>} className="md:min-h-[520px]">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="text-[40px] leading-none font-semibold tracking-[-0.04em] sm:text-[56px]">{s.season}</div>
        <div className="text-[14px] font-medium opacity-85">{s.inProgress ? `So far · week ${s.week} of ${s.weeksTotal}` : `${s.weeksTotal} weeks · ${s.courseCount} classes`}</div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0 rounded-xl px-3.5 py-3 sm:px-4 sm:py-4" style={panel}>
            <div className="text-[11px] font-semibold tracking-[0.08em] uppercase opacity-75">{t.label}</div>
            <div className="tabular mt-1.5 truncate text-[24px] leading-tight font-semibold tracking-[-0.03em] sm:text-[30px]">{t.value}</div>
            {t.hint && <div className="mt-0.5 truncate text-[12.5px] opacity-80">{t.hint}</div>}
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}
