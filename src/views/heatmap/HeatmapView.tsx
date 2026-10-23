"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dayKey, daysBetween, startOfWeek } from "@/lib/dates";
import { formatHours, shortDay, weekLabel } from "@/lib/format";
import { buildHeatmap, type DayCell, type Heatmap, type WeekRow } from "@/lib/heatmap";
import { Card, Stat, cx, focusRing } from "@/ui";
import { DayDetail } from "./DayDetail";
import { HeatGrid } from "./HeatGrid";
import { Legend } from "./Legend";
import { PERSONAL, type HeatCourse, type HeatItem } from "./shared";

export interface HeatmapViewProps {
  initial: Heatmap;
  items: HeatItem[];
  courses: HeatCourse[];
  semester: { start: string; end: string };
  now: string;
}

export function HeatmapView({ initial, items, courses, semester, now }: HeatmapViewProps) {
  const today = dayKey(new Date(now));
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [hideDone, setHideDone] = useState(false);

  const filterCourses = useMemo(() => {
    const list = [...courses];
    if (items.some((i) => i.courseId === null)) list.push(PERSONAL);
    return list;
  }, [courses, items]);

  const courseById = useMemo(() => new Map(filterCourses.map((c) => [c.id, c])), [filterCourses]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.uid, i])), [items]);

  const heatmap = useMemo(() => {
    if (off.size === 0 && !hideDone) return initial;
    const kept = items.filter((i) => !off.has(i.courseId ?? PERSONAL.id) && !(hideDone && i.doneAt));
    return buildHeatmap(kept, semester);
  }, [initial, items, off, hideDone, semester]);

  const inRange = today >= semester.start && today <= semester.end;
  const defaultDay = inRange ? today : semester.start;
  const [selected, setSelected] = useState(defaultDay);
  const [hovered, setHovered] = useState<string | null>(null);

  const dayByDate = useMemo(() => {
    const m = new Map<string, { day: DayCell; week: WeekRow }>();
    for (const week of heatmap.weeks) for (const day of week.days) m.set(day.date, { day, week });
    return m;
  }, [heatmap]);

  const shown = dayByDate.get(hovered ?? selected) ?? dayByDate.get(selected);
  const stats = useMemo(() => summarize(heatmap, today), [heatmap, today]);

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <Card padded={false} className="grid grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cx(
              "px-5 py-4",
              i % 2 === 1 && "border-l border-border",
              i >= 2 && "border-t border-border md:border-t-0",
              i === 2 && "md:border-l",
            )}
          >
            <Stat label={s.label} value={s.value} hint={s.hint} />
          </div>
        ))}
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:w-auto sm:flex-1" role="group" aria-label="Show courses">
          <span className="mr-1 text-[13px] font-medium text-ink-3">Courses</span>
          {filterCourses.map((c) => {
            const on = !off.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                className={cx(
                  "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition",
                  on ? "border-transparent text-ink" : "border-border bg-transparent text-ink-3 hover:text-ink-2",
                  focusRing,
                )}
                style={on ? { background: `color-mix(in srgb, ${c.color} 13%, var(--surface))`, borderColor: `color-mix(in srgb, ${c.color} 28%, transparent)` } : undefined}
              >
                <span
                  className="size-2 shrink-0 rounded-full transition"
                  style={on ? { background: c.color } : { boxShadow: `inset 0 0 0 1.5px ${c.color}`, opacity: 0.7 }}
                />
                <span className={cx(!on && "line-through decoration-ink-3/60")}>{c.name}</span>
              </button>
            );
          })}
          {off.size > 0 && (
            <button type="button" onClick={() => setOff(new Set())} className={cx("ml-1 h-8 rounded-full px-2.5 text-[13px] font-medium text-accent hover:bg-accent-soft", focusRing)}>
              Show all
            </button>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hideDone}
          onClick={() => setHideDone((v) => !v)}
          className={cx("inline-flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium text-ink-2 hover:bg-surface-2", focusRing)}
        >
          <span className={cx("relative h-4 w-7 rounded-full transition", hideDone ? "bg-accent" : "bg-border")}>
            <span className={cx("absolute top-0.5 size-3 rounded-full bg-white shadow transition-all", hideDone ? "left-3.5" : "left-0.5")} />
          </span>
          Hide finished work
        </button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card padded={false} className="min-w-0">
          <div className="flex items-start justify-between gap-4 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink">Week by week</h2>
              <p className="mt-0.5 text-[13px] text-ink-3">Hover or tap a day to see what makes it heavy.</p>
            </div>
            {inRange && selected !== today && (
              <button type="button" onClick={() => setSelected(today)} className={cx("h-8 shrink-0 rounded-lg border border-border px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2", focusRing)}>
                Today
              </button>
            )}
          </div>
          <HeatGrid
            heatmap={heatmap}
            today={today}
            selected={selected}
            onSelect={(d) => {
              setSelected(d);
              setHovered(null);
            }}
            onHover={setHovered}
            courseById={courseById}
          />
          <div className="border-t border-border px-4 py-3.5 sm:px-5">
            <Legend />
          </div>
        </Card>

        <div className="min-w-0 lg:sticky lg:top-8">
          {shown && <DayDetail day={shown.day} week={shown.week} today={today} medianWeek={heatmap.medianWeek} courseById={courseById} itemById={itemById} preview={!!hovered && hovered !== selected} />}
        </div>
      </div>

      <HowEstimated />
    </div>
  );
}

function summarize(h: Heatmap, today: string) {
  const thisMonday = startOfWeek(today);
  const thisWeek = h.weeks.find((w) => w.start === thisMonday);
  const ahead = h.weeks.filter((w) => w.start >= thisMonday);
  const busiest = ahead.reduce<WeekRow | null>((best, w) => (!best || w.total > best.total ? w : best), null);
  const crunch = ahead.find((w) => w.crunch && w.start !== thisMonday) ?? (thisWeek?.crunch ? thisWeek : undefined);
  const weeksAway = (w: WeekRow) => {
    const n = Math.round(daysBetween(thisMonday, w.start) / 7);
    return n === 0 ? "this week" : n === 1 ? "next week" : `in ${n} weeks`;
  };
  const vsNormal = thisWeek && h.medianWeek > 0 ? thisWeek.total / h.medianWeek : null;

  return [
    {
      label: "This week",
      value: thisWeek ? formatHours(thisWeek.total) : "—",
      hint: thisWeek ? (vsNormal === null ? weekLabel(thisWeek.start) : vsNormal >= 1.15 ? `${Math.round((vsNormal - 1) * 100)}% above normal` : vsNormal <= 0.85 ? `${Math.round((1 - vsNormal) * 100)}% below normal` : "About normal") : "Outside the semester",
    },
    {
      label: "Busiest week ahead",
      value: busiest && busiest.total > 0 ? formatHours(busiest.total) : "—",
      hint: busiest && busiest.total > 0 ? `Week of ${shortDay(busiest.start)}` : "Nothing ahead",
    },
    {
      label: "Next crunch",
      value: crunch ? shortDay(crunch.start) : "None",
      hint: crunch ? `${crunch.crunchReason ?? "Heavy week"}, ${weeksAway(crunch)}` : "No crunch weeks ahead",
    },
    {
      label: "Normal week",
      value: formatHours(h.medianWeek),
      hint: "Median across the term",
    },
  ];
}

function HowEstimated() {
  return (
    <details className="group rounded-xl border border-border bg-surface">
      <summary className={cx("flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-3.5 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden", focusRing)}>
        How this is estimated
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-ink-3 transition group-open:rotate-180" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="grid gap-4 border-t border-border px-5 py-4 text-[14px] leading-relaxed text-ink-2 sm:grid-cols-3">
        <p>
          <span className="font-medium text-ink">Hours per assignment</span> are a guess based on what kind of work it is (a problem set, an essay, a lab) and how
          many of them the class has. Twenty-five discussion posts are each quick; three essays are each big.
        </p>
        <p>
          <span className="font-medium text-ink">Those hours are spread</span> over the days before the deadline, heavier as it gets close, since that is when
          most people actually do the work. Exams add study time over the 5 days before.
        </p>
        <p>
          <span className="font-medium text-ink">Think a guess is off?</span> You can change any estimate in{" "}
          <Link href="/assignments" className="font-medium text-accent hover:underline">
            Assignments
          </Link>
          , and the heat map updates. Checking something off stops it from counting after that day.
        </p>
      </div>
    </details>
  );
}

