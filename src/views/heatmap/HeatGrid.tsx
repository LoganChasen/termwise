"use client";

import { useRef, type KeyboardEvent } from "react";
import { addDays, parseDay, startOfWeek } from "@/lib/dates";
import { formatHours, longDay, shortDay, weekLabel } from "@/lib/format";
import type { DayCell, Heatmap, WeekRow } from "@/lib/heatmap";
import { cx } from "@/ui";
import { inkOnHeat, plural, spokenHours, type HeatCourse } from "./shared";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

/** Narrow: week · 7 days · total. Wide (card ≥ 36rem): month · week · 7 days · total. */
const COLS = "grid-cols-[44px_repeat(7,minmax(32px,1fr))_36px] @xl:grid-cols-[40px_92px_repeat(7,minmax(36px,1fr))_minmax(136px,170px)]";

export interface HeatGridProps {
  heatmap: Heatmap;
  today: string;
  selected: string;
  onSelect: (day: string) => void;
  onHover: (day: string | null) => void;
  courseById: Map<string, HeatCourse>;
}

export function HeatGrid({ heatmap, today, selected, onSelect, onHover, courseById }: HeatGridProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const inRange = new Set(heatmap.weeks.flatMap((w) => w.days.filter((d) => d.inRange).map((d) => d.date)));
  const maxWeek = Math.max(1, ...heatmap.weeks.map((w) => w.total));
  const thisMonday = startOfWeek(today);

  const move = (from: string, e: KeyboardEvent) => {
    const dow = (parseDay(from).getDay() + 6) % 7;
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -dow, End: 6 - dow };
    const d = delta[e.key];
    if (d === undefined) return;
    e.preventDefault();
    let target = addDays(from, d);
    // Home/End inside a partial week: clamp to the nearest in-range day of that week.
    if (!inRange.has(target) && (e.key === "Home" || e.key === "End")) {
      const step = e.key === "Home" ? 1 : -1;
      while (!inRange.has(target) && target !== from) target = addDays(target, step);
    }
    if (!inRange.has(target)) return;
    onSelect(target);
    refs.current.get(target)?.focus();
  };

  return (
    <div className="@container overflow-x-auto px-3 pb-4 sm:px-5 sm:pb-5" onMouseLeave={() => onHover(null)}>
      <div className="min-w-[328px]" role="group" aria-label="Workload by day. Use arrow keys to move between days.">
        <div className={cx("grid gap-[3px] px-1 pb-1.5 text-[11px] font-medium text-ink-3 @xl:gap-1.5 @xl:px-2", COLS)} aria-hidden>
          <span className="hidden @xl:block" />
          <span />
          {DAYS.map((d) => (
            <span key={d} className="text-center">
              <span className="@xl:hidden">{d[0]}</span>
              <span className="hidden @xl:inline">{d}</span>
            </span>
          ))}
          <span className="pl-1 text-right @xl:pl-2 @xl:text-left">Week</span>
        </div>

        <div className="flex flex-col gap-[3px] @xl:gap-1.5">
          {heatmap.weeks.map((week, wi) => {
            const month = monthLabel(week, wi);
            const current = week.start === thisMonday;
            return (
              <div
                key={week.start}
                className={cx("grid items-center gap-[3px] rounded-lg px-1 @xl:gap-1.5 @xl:px-2", COLS, month && wi > 0 && "mt-1.5 @xl:mt-2")}
                style={week.crunch ? { background: "color-mix(in srgb, var(--heat-4) 9%, transparent)" } : undefined}
              >
                <span className={cx("hidden truncate text-[12px] font-semibold @xl:block", month ? "text-ink" : "text-transparent")}>{month ?? "·"}</span>
                <span className={cx("tabular truncate text-[10.5px] @xl:text-[12px]", current ? "font-semibold text-ink" : "text-ink-3")}>
                  <span className="@xl:hidden">{shortDay(week.start)}</span>
                  <span className="hidden @xl:inline">{weekLabel(week.start)}</span>
                </span>
                {week.days.map((day) =>
                  day.inRange ? (
                    <Cell
                      key={day.date}
                      day={day}
                      today={day.date === today}
                      selected={day.date === selected}
                      courseById={courseById}
                      onSelect={onSelect}
                      onHover={onHover}
                      onKey={move}
                      refFn={(el) => {
                        if (el) refs.current.set(day.date, el);
                        else refs.current.delete(day.date);
                      }}
                    />
                  ) : (
                    <div key={day.date} className="h-9 rounded-md border border-dashed border-border/80 @xl:h-10" aria-hidden />
                  ),
                )}
                <WeekTotal week={week} maxWeek={maxWeek} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function monthLabel(week: WeekRow, index: number): string | null {
  const days = week.days.filter((d) => d.inRange);
  if (days.length === 0) return null;
  if (index === 0) return MONTH.format(parseDay(days[0]!.date));
  const first = days.find((d) => d.date.endsWith("-01"));
  return first ? MONTH.format(parseDay(first.date)) : null;
}

function Cell({
  day,
  today,
  selected,
  courseById,
  onSelect,
  onHover,
  onKey,
  refFn,
}: {
  day: DayCell;
  today: boolean;
  selected: boolean;
  courseById: Map<string, HeatCourse>;
  onSelect: (d: string) => void;
  onHover: (d: string | null) => void;
  onKey: (from: string, e: KeyboardEvent) => void;
  refFn: (el: HTMLButtonElement | null) => void;
}) {
  const date = parseDay(day.date);
  const n = date.getDate();
  const label = [
    `${longDay(day.date)}${today ? " (today)" : ""}: ${spokenHours(day.hours)}`,
    day.exams.length > 0 && plural(day.exams.length, "exam"),
    day.due.length > 0 && `${day.due.length} due`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      ref={refFn}
      type="button"
      tabIndex={selected ? 0 : -1}
      aria-label={label}
      aria-pressed={selected}
      onClick={() => onSelect(day.date)}
      onFocus={() => onSelect(day.date)}
      onMouseEnter={() => onHover(day.date)}
      onKeyDown={(e) => onKey(day.date, e)}
      className={cx(
        "relative h-9 min-w-8 rounded-md text-left transition-[box-shadow,transform] duration-100 outline-none @xl:h-10",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        today && "inset-ring-2 inset-ring-accent",
        selected ? "z-10 ring-2 ring-ink ring-offset-2 ring-offset-surface" : "hover:ring-1 hover:ring-ink/35 hover:ring-offset-1 hover:ring-offset-surface",
      )}
      style={{ background: `var(--heat-${day.level})` }}
    >
      <span
        className={cx("tabular absolute top-1 left-1.5 text-[10px] leading-none @xl:text-[11px]", (n === 1 || today) && "font-semibold")}
        style={{ color: today && day.level < 4 ? "var(--accent)" : inkOnHeat(day.level) }}
      >
        {n}
      </span>
      {day.exams.length > 0 && (
        <span className="absolute right-1 bottom-1 flex -space-x-1 @xl:top-1 @xl:bottom-auto">
          {day.exams.slice(0, 2).map((e) => (
            <span
              key={e.uid}
              className="size-2.5 rounded-full ring-2 ring-surface @xl:size-3"
              style={{ background: courseById.get(e.courseId ?? "")?.color ?? "var(--ink)" }}
            />
          ))}
        </span>
      )}
    </button>
  );
}

function WeekTotal({ week, maxWeek }: { week: WeekRow; maxWeek: number }) {
  const pct = Math.max(week.total > 0 ? 4 : 0, (week.total / maxWeek) * 100);
  const fill = week.crunch ? "var(--heat-5)" : "var(--heat-3)";
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1 pl-1 @xl:pl-2" title={week.crunchReason ? `Crunch week: ${week.crunchReason}` : undefined}>
      <div className="flex items-center gap-2">
        <span className={cx("tabular w-full text-right text-[11px] font-semibold @xl:w-10 @xl:shrink-0 @xl:text-left @xl:text-[13px]", week.total > 0 ? "text-ink" : "text-ink-3")}>
          {formatHours(week.total)}
        </span>
        <span className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2 @xl:block">
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
        </span>
      </div>
      <span className="ml-auto block h-1 w-full overflow-hidden rounded-full bg-surface-2 @xl:hidden">
        <span className="ml-auto block h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
      </span>
      {week.crunch && (
        <span className="hidden items-center gap-1 truncate pl-12 text-[11px] leading-none font-semibold @xl:flex" style={{ color: "var(--heat-5)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2c1 3.5-1.5 5-1.5 8 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.4 2.2-3.2C17.6 11 19 13.6 19 16a7 7 0 1 1-14 0c0-5 4.5-7.4 7-14z" />
          </svg>
          <span className="truncate">{week.crunchReason?.replace(" a normal week", " normal")}</span>
        </span>
      )}
      {week.crunch && <span className="sr-only">Crunch week: {week.crunchReason}</span>}
    </div>
  );
}
