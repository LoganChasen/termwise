"use client";

import Link from "next/link";
import { daysBetween } from "@/lib/dates";
import { formatHours, formatTime, longDay, weekLabel } from "@/lib/format";
import type { Contribution, DayCell, WeekRow } from "@/lib/heatmap";
import { Card, IconArrowRight, IconCheck, cx, focusRing } from "@/ui";
import { LEVEL_NAMES, PERSONAL, plural, type HeatCourse, type HeatItem } from "./shared";

export interface DayDetailProps {
  day: DayCell;
  week: WeekRow;
  today: string;
  medianWeek: number;
  courseById: Map<string, HeatCourse>;
  itemById: Map<string, HeatItem>;
  preview: boolean;
}

export function DayDetail({ day, week, today, medianWeek, courseById, itemById, preview }: DayDetailProps) {
  const course = (c: Contribution) => courseById.get(c.courseId ?? PERSONAL.id) ?? PERSONAL;
  const diff = daysBetween(today, day.date);
  const rel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
  const timeOf = (c: Contribution) => {
    const item = itemById.get(c.uid);
    if (!item) return null;
    return item.allDay ? "All day" : formatTime(new Date(item.start));
  };
  const busiest = day.contributions[0]?.hours ?? 0;

  return (
    <Card padded={false} className={cx("overflow-hidden transition-shadow", preview && "shadow-[0_1px_2px_rgb(0_0_0/0.04),0_0_0_1px_var(--border)]")}>
      <div className="relative px-5 pt-5 pb-4">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: `var(--heat-${day.level})` }} aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <span className={cx("text-[12px] font-medium uppercase tracking-wide", diff === 0 ? "text-accent" : "text-ink-3")}>{rel}</span>
          {preview && <span className="text-[11px] text-ink-3">Click to pin</span>}
        </div>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{longDay(day.date)}</h2>
        <div className="mt-3 flex items-end gap-3">
          <span className="tabular text-[34px] leading-none font-semibold tracking-tight text-ink">{formatHours(day.hours)}</span>
          <span className="mb-0.5 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-medium text-ink-2">
            <span className="size-2 rounded-full" style={{ background: `var(--heat-${Math.max(1, day.level)})` }} />
            {LEVEL_NAMES[day.level]}
          </span>
        </div>
        <p className="mt-2 text-[13px] text-ink-3">
          Week of {weekLabel(week.start)}: <span className="tabular font-medium text-ink-2">{formatHours(week.total)}</span>
          {medianWeek > 0 && week.total > 0 && <> ({vsNormal(week.total / medianWeek)})</>}
        </p>
        {week.crunch && (
          <div
            className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium"
            style={{ color: "var(--heat-5)", background: "color-mix(in srgb, var(--heat-4) 12%, transparent)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2c1 3.5-1.5 5-1.5 8 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.4 2.2-3.2C17.6 11 19 13.6 19 16a7 7 0 1 1-14 0c0-5 4.5-7.4 7-14z" />
            </svg>
            Crunch week: {week.crunchReason}
          </div>
        )}
      </div>

      {day.exams.length > 0 && (
        <Section title={plural(day.exams.length, "Exam")}>
          {day.exams.map((e) => (
            <li key={e.uid} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-md" style={{ color: course(e).color, background: `color-mix(in srgb, ${course(e).color} 14%, transparent)` }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="5" y="4" width="14" height="17" rx="2" />
                  <path d="M9 2h6v4H9zM9 12l2 2 4-4" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-ink">{e.title}</div>
                <div className="text-[12px] text-ink-3">
                  {course(e).name}
                  {timeOf(e) && ` · ${timeOf(e)}`}
                </div>
              </div>
            </li>
          ))}
        </Section>
      )}

      {day.due.length > 0 && (
        <Section title="Due this day">
          {day.due.map((d) => {
            const done = !!itemById.get(d.uid)?.doneAt;
            return (
              <li key={d.uid} className="flex items-center gap-2.5 py-1">
                {done ? (
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-success text-white">
                    <IconCheck size={11} strokeWidth={3} />
                  </span>
                ) : (
                  <span className="grid size-4 shrink-0 place-items-center">
                    <span className="size-2 rounded-full" style={{ background: course(d).color }} />
                  </span>
                )}
                <span className={cx("min-w-0 flex-1 truncate text-[13.5px]", done ? "text-ink-3 line-through" : "text-ink")}>{d.title}</span>
                <span className="tabular shrink-0 text-[12px] text-ink-3">{timeOf(d)}</span>
              </li>
            );
          })}
        </Section>
      )}

      <Section title="Where the hours go" aside={day.contributions.length > 0 ? plural(day.contributions.length, "item") : undefined}>
        {day.contributions.length === 0 ? (
          <li className="rounded-lg bg-surface-2 px-3 py-3 text-[13px] text-ink-3">
            {diff < 0 ? "Nothing was planned for this day." : "Nothing planned. A good day to get ahead."}
          </li>
        ) : (
          day.contributions.map((c) => {
            const item = itemById.get(c.uid);
            const away = item ? daysBetween(day.date, item.day) : null;
            return (
              <li key={c.uid} className="py-1.5">
                <div className="flex items-baseline gap-2.5">
                  <span className="size-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: course(c).color }} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{c.title}</span>
                  <span className="tabular shrink-0 text-[13px] font-medium text-ink">{formatHours(c.hours)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2.5 pl-[18px]">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (c.hours / busiest) * 100)}%`, background: course(c).color }} />
                  </span>
                  <span className="w-[86px] shrink-0 text-right text-[11.5px] text-ink-3">{away === null ? course(c).name : dueIn(away, c.type === "exam")}</span>
                </div>
              </li>
            );
          })
        )}
      </Section>

      <div className="border-t border-border px-5 py-3">
        <Link href="/assignments" className={cx("inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent hover:underline", focusRing)}>
          Adjust estimates in Assignments
          <IconArrowRight size={14} />
        </Link>
      </div>
    </Card>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[12px] font-medium uppercase tracking-wide text-ink-3">{title}</h3>
        {aside && <span className="text-[12px] text-ink-3">{aside}</span>}
      </div>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  );
}

function vsNormal(ratio: number): string {
  if (ratio >= 1.15) return `${ratio.toFixed(1)}× a normal week`;
  if (ratio <= 0.85) return "lighter than normal";
  return "about normal";
}

function dueIn(days: number, exam: boolean): string {
  const what = exam ? "Exam" : "Due";
  if (days <= 0) return exam ? "Exam this day" : "Due this day";
  if (days === 1) return `${what} next day`;
  return `${what} in ${days} days`;
}
