"use client";

import { useMemo, useState } from "react";
import { formatClock } from "@/lib/format";
import type { Weekday } from "@/lib/types";
import { Card, cx, focusRing } from "@/ui";
import { formatRange, toMinutes, WEEKDAY_LONG, WEEKDAYS } from "./shared";

export interface ScheduleCourse {
  id: string;
  name: string;
  color: string;
  meetings: { days: Weekday[]; start: string; end: string; location: string | null; kind: string }[];
  officeHours: { who: string; days: Weekday[]; start: string; end: string; location: string | null }[];
}

interface Session {
  key: string;
  courseId: string;
  name: string;
  color: string;
  day: Weekday;
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
  location: string | null;
  label: string;
  office: boolean;
  lane: number;
  lanes: number;
}

const HOUR_PX = 46;

export function WeekSchedule({ courses, todayIndex }: { courses: ScheduleCourse[]; todayIndex: number }) {
  const [showOffice, setShowOffice] = useState(false);
  const hasOffice = courses.some((c) => c.officeHours.length > 0);

  const sessions = useMemo(() => {
    const out: Omit<Session, "lane" | "lanes">[] = [];
    for (const c of courses) {
      c.meetings.forEach((m, i) =>
        m.days.forEach((day) =>
          out.push({
            key: `${c.id}-m${i}-${day}`,
            courseId: c.id,
            name: c.name,
            color: c.color,
            day,
            start: toMinutes(m.start),
            end: toMinutes(m.end),
            startLabel: m.start,
            endLabel: m.end,
            location: m.location,
            label: m.kind === "lecture" ? "Class" : m.kind[0]!.toUpperCase() + m.kind.slice(1),
            office: false,
          }),
        ),
      );
      if (showOffice)
        c.officeHours.forEach((o, i) =>
          o.days.forEach((day) =>
            out.push({
              key: `${c.id}-o${i}-${day}`,
              courseId: c.id,
              name: c.name,
              color: c.color,
              day,
              start: toMinutes(o.start),
              end: toMinutes(o.end),
              startLabel: o.start,
              endLabel: o.end,
              location: o.location,
              label: o.who.toLowerCase().includes("office") ? o.who : `Office hours · ${o.who}`,
              office: true,
            }),
          ),
        );
    }
    return withLanes(out.filter((s) => WEEKDAYS.includes(s.day) && s.end > s.start));
  }, [courses, showOffice]);

  if (sessions.length === 0 && !hasOffice) {
    return (
      <Card>
        <h2 className="text-[15px] font-semibold text-ink">This week&apos;s classes</h2>
        <p className="mt-1 text-sm text-ink-3">Add a syllabus in Setup and your class times show up here.</p>
      </Card>
    );
  }

  const startHour = Math.max(0, Math.floor(Math.min(...sessions.map((s) => s.start), 9 * 60) / 60));
  const endHour = Math.min(24, Math.ceil(Math.max(...sessions.map((s) => s.end), 17 * 60) / 60));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = hours.length * HOUR_PX;
  const top = (min: number) => ((min - startHour * 60) / 60) * HOUR_PX;

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">This week&apos;s classes</h2>
          <p className="mt-0.5 text-sm text-ink-3">Your regular schedule, from each syllabus.</p>
        </div>
        {hasOffice && (
          <button
            type="button"
            aria-pressed={showOffice}
            onClick={() => setShowOffice((v) => !v)}
            className={cx(
              "inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition",
              showOffice ? "border-accent/40 bg-accent-soft text-accent" : "border-border bg-surface text-ink-2 hover:bg-surface-2",
              focusRing,
            )}
          >
            <span className={cx("relative h-3.5 w-6 rounded-full transition", showOffice ? "bg-accent" : "bg-border")}>
              <span className={cx("absolute top-0.5 size-2.5 rounded-full bg-white shadow-sm transition-all", showOffice ? "left-3" : "left-0.5")} />
            </span>
            Office hours
          </button>
        )}
      </div>

      {/* Desktop / tablet timetable */}
      <div className="hidden border-t border-border sm:block">
        <div className="grid grid-cols-[52px_repeat(5,minmax(0,1fr))] border-b border-border">
          <div />
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={cx("border-l border-border py-2 text-center text-[12px] font-semibold tracking-wide uppercase", i === todayIndex ? "text-accent" : "text-ink-3")}>
              {d}
              {i === todayIndex && <span className="ml-1.5 rounded bg-accent-soft px-1 py-px text-[10px] tracking-normal normal-case">Today</span>}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[52px_repeat(5,minmax(0,1fr))]" style={{ height }}>
          <div className="relative">
            {hours.map((h, i) => (
              <div key={h} className="tabular absolute right-2 -translate-y-1/2 text-[11px] text-ink-3" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : formatClock(`${h}:00`)}
              </div>
            ))}
          </div>
          {WEEKDAYS.map((d, di) => (
            <div key={d} className={cx("relative border-l border-border", di === todayIndex && "bg-accent-soft/40")}>
              {hours.slice(1).map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-border/70" style={{ top: (i + 1) * HOUR_PX }} />
              ))}
              {sessions
                .filter((s) => s.day === d)
                .map((s) => {
                  const h = top(s.end) - top(s.start);
                  const w = 100 / s.lanes;
                  return (
                    <div
                      key={s.key}
                      className={cx("absolute overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight", s.office && "border border-dashed")}
                      style={{
                        top: top(s.start) + 1,
                        height: h - 2,
                        left: `calc(${s.lane * w}% + 3px)`,
                        width: `calc(${w}% - 6px)`,
                        background: `color-mix(in srgb, ${s.color} ${s.office ? 7 : 16}%, var(--surface))`,
                        borderColor: s.office ? `color-mix(in srgb, ${s.color} 45%, transparent)` : undefined,
                        boxShadow: s.office ? undefined : `inset 3px 0 0 ${s.color}`,
                      }}
                      title={`${s.name} ${s.label} · ${formatRange(s.startLabel, s.endLabel)}${s.location ? ` · ${s.location}` : ""}`}
                    >
                      <div className={cx("truncate font-semibold", s.office ? "text-ink-2" : "text-ink")} style={{ paddingLeft: s.office ? 0 : 2 }}>
                        {s.name}
                        {s.office && <span className="font-normal text-ink-3"> · OH</span>}
                      </div>
                      {h >= 34 && (
                        <div className="tabular truncate text-ink-3" style={{ paddingLeft: s.office ? 0 : 2 }}>
                          {formatRange(s.startLabel, s.endLabel)}
                        </div>
                      )}
                      {h >= 50 && s.location && (
                        <div className="truncate text-ink-3" style={{ paddingLeft: s.office ? 0 : 2 }}>
                          {s.location}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Phone: day list */}
      <div className="border-t border-border sm:hidden">
        {WEEKDAYS.map((d, di) => {
          const list = sessions.filter((s) => s.day === d).sort((a, b) => a.start - b.start);
          return (
            <div key={d} className="border-b border-border px-5 py-3 last:border-b-0">
              <div className={cx("mb-2 text-[12px] font-semibold tracking-wide uppercase", di === todayIndex ? "text-accent" : "text-ink-3")}>
                {WEEKDAY_LONG[d]}
                {di === todayIndex && <span className="ml-1.5 rounded bg-accent-soft px-1 py-px text-[10px] tracking-normal normal-case">Today</span>}
              </div>
              {list.length === 0 ? (
                <p className="text-[13px] text-ink-3">No classes</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((s) => (
                    <li key={s.key} className={cx("flex items-center gap-3 text-[13px]", s.office && "opacity-75")}>
                      <span className="tabular w-[108px] shrink-0 whitespace-nowrap text-ink-2">{formatRange(s.startLabel, s.endLabel)}</span>
                      <span className={cx("h-7 w-[3px] shrink-0 rounded-full", s.office && "opacity-50")} style={{ background: s.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">
                          {s.name} <span className="font-normal text-ink-3">· {s.label}</span>
                        </span>
                        {s.location && <span className="block truncate text-[12px] text-ink-3">{s.location}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Side-by-side lanes for sessions that overlap on the same day. */
function withLanes(list: Omit<Session, "lane" | "lanes">[]): Session[] {
  const out: Session[] = [];
  for (const day of WEEKDAYS) {
    const items = list.filter((s) => s.day === day).sort((a, b) => a.start - b.start || b.end - a.end);
    let cluster: Session[] = [];
    let clusterEnd = -1;
    const flush = () => {
      const lanes = Math.max(1, ...cluster.map((s) => s.lane + 1));
      cluster.forEach((s) => (s.lanes = lanes));
      out.push(...cluster);
      cluster = [];
    };
    for (const s of items) {
      if (s.start >= clusterEnd && cluster.length) flush();
      const used = new Set(cluster.filter((c) => c.end > s.start).map((c) => c.lane));
      let lane = 0;
      while (used.has(lane)) lane++;
      cluster.push({ ...s, lane, lanes: 1 });
      clusterEnd = Math.max(clusterEnd, s.end);
    }
    if (cluster.length) flush();
  }
  return out;
}
