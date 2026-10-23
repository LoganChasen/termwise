"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { markSeen } from "@/app/actions";
import { addDays, dayKey, startOfWeek } from "@/lib/dates";
import { ago, countdown, dueLabel, formatHours, longDay, relativeDay, formatTime } from "@/lib/format";
import { buildHeatmap } from "@/lib/heatmap";
import type { AppData, CourseView, ItemView } from "@/server/model";
import { ButtonLink, Card, CourseChip, cx, EmptyState, focusRing, IconArrowRight, IconCalendar, IconCheck, IconClock, IconPlus, IconUpdates, IconMapPin, PageHeader } from "@/ui";
import { IconAward, IconInfo, IconPencil, IconSwap, IconTrash } from "../assignments/icons";
import { courseMap, examLocation, isTest } from "../assignments/meta";

type Update = AppData["updates"][number];

export function UpdatesView({ data }: { data: AppData }) {
  const now = useMemo(() => new Date(data.now), [data.now]);
  const byCourse = useMemo(() => courseMap(data.courses), [data.courses]);

  // Mark this visit as seen once. No refresh, so this visit's "New" markers stay put.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    void markSeen();
  }, []);

  const seenMs = data.lastSeenAt ? new Date(data.lastSeenAt).getTime() : 0;
  const updates = useMemo(() => [...data.updates].sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id), [data.updates]);
  const fresh = updates.filter((u) => new Date(u.at).getTime() > seenMs);
  const earlier = updates.filter((u) => new Date(u.at).getTime() <= seenMs);
  const earlierByDay = groupByDay(earlier);

  const live = data.items.filter((i) => !i.removedAt);
  const nowMs = now.getTime();
  const upcoming = live.filter((i) => !i.doneAt && i.dueMs >= nowMs);
  const tests = upcoming.filter((i) => isTest(i) && i.dueMs < nowMs + 7 * 86_400_000);
  const next3 = upcoming.filter((i) => !isTest(i)).slice(0, 3);

  if (!data.setupDone && live.length === 0 && updates.length === 0) {
    return (
      <>
        <PageHeader title="Updates" />
        <Card>
          <EmptyState
            icon={<IconUpdates />}
            title="Welcome to Termwise"
            body="Connect your Canvas calendar and Termwise will tell you what changed each time you open it: new assignments, moved due dates, and posted grades."
            action={
              <ButtonLink href="/setup" variant="primary">
                Set up Termwise
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  }

  const subtitle = data.lastSeenAt ? (
    <>
      {fresh.length === 0 ? "Nothing new" : `${fresh.length} ${fresh.length === 1 ? "change" : "changes"}`} since your last visit ({ago(data.lastSeenAt, now).replace(/^Yesterday$/, "yesterday")})
    </>
  ) : (
    "What changed in your classes"
  );

  return (
    <>
      <PageHeader title="Updates" subtitle={subtitle} />

      <div className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ComingUp tests={tests} next={next3} byCourse={byCourse} now={now} />
        <ThisWeek data={data} now={now} />
      </div>

      {updates.length === 0 ? (
        <Card>
          <EmptyState icon={<IconUpdates />} title="No changes yet" body="When a class adds an assignment, moves a due date, or posts a grade, it shows up here." />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {fresh.length > 0 && (
            <FeedSection
              title={
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-accent" />
                  New since your last visit
                  <span className="tabular rounded-full bg-accent-soft px-1.5 text-[12px] font-semibold text-accent">{fresh.length}</span>
                </span>
              }
            >
              <Card padded={false}>
                <ul className="divide-y divide-border">
                  {fresh.map((u) => (
                    <UpdateRow key={u.id} u={u} course={u.courseId ? byCourse.get(u.courseId) : undefined} now={now} isNew />
                  ))}
                </ul>
              </Card>
            </FeedSection>
          )}
          {earlierByDay.length > 0 && (
            <FeedSection title={fresh.length > 0 ? "Earlier" : "Recent changes"}>
              <Card padded={false}>
                {earlierByDay.map(([day, list], gi) => (
                  <div key={day} className={cx(gi > 0 && "border-t border-border")}>
                    <h3 className="bg-surface-2/60 px-4 py-1.5 text-[12px] font-semibold text-ink-2 sm:px-5">
                      {relativeDay(day, now)}
                      {/^(Today|Yesterday)$/.test(relativeDay(day, now)) && <span className="ml-2 font-normal text-ink-3">{longDay(day)}</span>}
                    </h3>
                    <ul className="divide-y divide-border border-t border-border">
                      {list.map((u) => (
                        <UpdateRow key={u.id} u={u} course={u.courseId ? byCourse.get(u.courseId) : undefined} now={now} />
                      ))}
                    </ul>
                  </div>
                ))}
              </Card>
            </FeedSection>
          )}
        </div>
      )}

      <p className="mt-10 flex items-start gap-2 text-[12.5px] text-ink-3">
        <IconInfo size={14} className="mt-0.5 shrink-0" />
        Announcements aren&apos;t included: Canvas only shares those through its API, which Emory doesn&apos;t allow for students.
      </p>
    </>
  );
}

function FeedSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

// ---------- Coming up ----------

function ComingUp({ tests, next, byCourse, now }: { tests: ItemView[]; next: ItemView[]; byCourse: Map<string, CourseView>; now: Date }) {
  return (
    <Card padded={false} className="flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold text-ink">Coming up</h2>
        <Link href="/assignments" className={cx("flex items-center gap-1 rounded text-[13px] font-medium text-accent hover:underline", focusRing)}>
          All assignments <IconArrowRight size={14} />
        </Link>
      </div>

      <div className="px-5 pb-1 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Exams &amp; quizzes · next 7 days</div>
      {tests.length === 0 ? (
        <p className="px-5 pt-1 pb-3 text-[13px] text-ink-3">No exams or quizzes this week.</p>
      ) : (
        <ul className="flex flex-col gap-2 px-3 pt-1 pb-3">
          {tests.map((i) => {
            const c = i.courseId ? byCourse.get(i.courseId) : undefined;
            const loc = examLocation(i, c);
            const hoursLeft = (i.dueMs - now.getTime()) / 3_600_000;
            return (
              <li key={i.uid} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
                <div className={cx("grid w-14 shrink-0 place-items-center rounded-md py-1 text-center", hoursLeft < 24 ? "bg-warning/15 text-warning" : "bg-surface text-ink")}>
                  <span className="tabular text-[15px] leading-tight font-semibold">{countdown(i.dueMs, now).replace(/^in /, "")}</span>
                  <span className="text-[10.5px] leading-tight opacity-70">to go</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[14px] font-medium text-ink">{i.title}</span>
                    <span className={cx("rounded px-1.5 py-px text-[10.5px] font-semibold tracking-wide uppercase", i.type === "exam" ? "bg-ink text-bg" : "border border-border text-ink-2")}>{i.type === "exam" ? "Exam" : "Quiz"}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-ink-3">
                    {c && <CourseChip name={c.name} color={c.color} />}
                    <span className="tabular text-ink-2">{dueLabel(i, now)}</span>
                    {loc && (
                      <span className="inline-flex items-center gap-1">
                        <IconMapPin size={12} /> {loc}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto border-t border-border px-5 pt-3 pb-1 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Next deadlines</div>
      {next.length === 0 ? (
        <p className="px-5 pt-1 pb-4 text-[13px] text-ink-3">Nothing else due. You&apos;re all caught up.</p>
      ) : (
        <ul className="px-5 pb-3">
          {next.map((i) => {
            const c = i.courseId ? byCourse.get(i.courseId) : undefined;
            const soon = i.dueMs - now.getTime() < 86_400_000;
            return (
              <li key={i.uid} className="flex items-center gap-3 py-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ background: c?.color ?? "var(--ink-3)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">
                    {i.title}
                    {c && <span className="ml-2 text-[12.5px] text-ink-3 max-sm:hidden">{c.name}</span>}
                  </span>
                  <span className="tabular block text-[12px] text-ink-3 sm:hidden">
                    {c ? `${c.name} · ` : ""}
                    {dueLabel(i, now)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-[12.5px] text-ink-2 max-sm:hidden">{dueLabel(i, now)}</span>
                <span className={cx("tabular w-14 shrink-0 text-right text-[12.5px]", soon ? "font-medium text-warning" : "text-ink-3")}>{countdown(i.dueMs, now)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------- This week ----------

function ThisWeek({ data, now }: { data: AppData; now: Date }) {
  const today = dayKey(now);
  const monday = startOfWeek(today);
  const sunday = addDays(monday, 6);
  const live = data.items.filter((i) => !i.removedAt);

  const { hours, normal } = useMemo(() => {
    const map = buildHeatmap(live, data.semester);
    const week = map.weeks.find((w) => w.start === monday);
    return { hours: week?.total ?? 0, normal: map.medianWeek };
  }, [data.items, data.semester, monday]);

  const inWeek = live.filter((i) => i.day >= monday && i.day <= sunday);
  const due = inWeek.filter((i) => i.type !== "exam");
  const doneCount = due.filter((i) => i.doneAt).length;
  const exams = inWeek.filter((i) => i.type === "exam");
  const ratio = normal > 0 ? hours / normal : 0;
  const scaleMax = Math.max(hours, normal) * 1.15 || 1;
  const verdict =
    normal <= 0 ? null : ratio >= 1.4 ? "Heavier than usual" : ratio >= 1.1 ? "A bit busier than usual" : ratio <= 0.7 ? "Lighter than usual" : "About a normal week";
  const heavy = ratio >= 1.4;

  return (
    <Card className="flex flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">This week</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            {longDay(monday).replace(/^\w+, /, "")} – {longDay(sunday).replace(/^\w+, /, "")}
          </p>
        </div>
        <Link href="/calendar" className={cx("rounded text-[13px] font-medium text-accent hover:underline", focusRing)}>
          Heat map
        </Link>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="tabular text-[28px] leading-none font-semibold tracking-tight text-ink">{formatHours(hours)}</span>
        <span className="text-[13px] text-ink-3">of work estimated</span>
      </div>
      {verdict && <p className={cx("mt-1.5 text-[13px] font-medium", heavy ? "text-[var(--heat-4)]" : "text-ink-2")}>{verdict}{normal > 0 && <span className="font-normal text-ink-3"> · a normal week is ~{formatHours(normal)}</span>}</p>}

      {normal > 0 && (
        <div className="mt-3 flex flex-col gap-1.5" aria-hidden>
          <Bar label="This week" value={hours} max={scaleMax} color={`var(--heat-${heavy ? 4 : ratio >= 1.1 ? 3 : 2})`} />
          <Bar label="Normal" value={normal} max={scaleMax} color="color-mix(in srgb, var(--ink-3) 45%, transparent)" />
        </div>
      )}

      <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-4 max-lg:mt-5">
        <div>
          <dt className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <IconCalendar size={13} /> Due this week
          </dt>
          <dd className="tabular mt-0.5 text-[18px] font-semibold text-ink">
            {due.length}
            {doneCount > 0 && <span className="ml-1.5 text-[12.5px] font-normal text-success">{doneCount} done</span>}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <IconClock size={13} /> Exams
          </dt>
          <dd className="tabular mt-0.5 text-[18px] font-semibold text-ink">{exams.length}</dd>
        </div>
      </dl>
    </Card>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
      <span className="w-16 shrink-0">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: color }} />
      </span>
      <span className="tabular w-9 shrink-0 text-right">{formatHours(value)}</span>
    </div>
  );
}

// ---------- Feed rows ----------

const KIND_STYLE: Record<Update["kind"], { icon: (p: { size?: number }) => ReactNode; tone: string }> = {
  added: { icon: IconPlus, tone: "bg-accent-soft text-accent" },
  rescheduled: { icon: IconSwap, tone: "bg-warning/12 text-warning" },
  renamed: { icon: IconPencil, tone: "bg-surface-2 text-ink-2" },
  removed: { icon: IconTrash, tone: "bg-danger/10 text-danger" },
  "grade-posted": { icon: IconAward, tone: "bg-success/12 text-success" },
  "grade-changed": { icon: IconCheck, tone: "bg-success/12 text-success" },
};

function UpdateRow({ u, course, now, isNew = false }: { u: Update; course: CourseView | undefined; now: Date; isNew?: boolean }) {
  const { icon: Icon, tone } = KIND_STYLE[u.kind];
  const s = sentence(u, now);
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", tone)}>
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug break-words text-ink-2">
          <span>{s.lead}: </span>
          <span className="font-medium text-ink">{s.title}</span>
          {s.detail && <span className="tabular text-ink-2"> {s.detail}</span>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
          {course && <CourseChip name={course.name} color={course.color} />}
          <span className="tabular">{ago(u.at, now)}</span>
        </div>
      </div>
      {isNew && <span className="mt-1 shrink-0 rounded-full bg-accent-soft px-2 py-px text-[11px] font-semibold text-accent">New</span>}
    </li>
  );
}

/** Format a stored before/after value: "YYYY-MM-DD" for all-day, otherwise an ISO time. */
function when(v: string | null, now: Date): string {
  if (!v) return "?";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return relativeDay(v, now);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${relativeDay(dayKey(d), now)} ${formatTime(d)}`;
}

function toMs(v: string | null): number {
  if (!v) return 0;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T23:59:00`).getTime() : new Date(v).getTime();
}

function percent(score: string | null): string {
  const m = score?.match(/^([\d.]+)\s*\/\s*([\d.]+)$/);
  if (!m) return "";
  const p = (Number(m[1]) / Number(m[2])) * 100;
  return Number.isFinite(p) ? ` (${Math.round(p)}%)` : "";
}

function sentence(u: Update, now: Date): { lead: string; title: string; detail: string | null } {
  switch (u.kind) {
    case "added":
      return { lead: "New assignment", title: u.title, detail: u.after ? `· due ${when(u.after, now)}` : null };
    case "rescheduled": {
      const earlier = toMs(u.after) < toMs(u.before);
      return { lead: `Due date moved ${earlier ? "earlier" : "later"}`, title: u.title, detail: `— ${when(u.before, now)} → ${when(u.after, now)}` };
    }
    case "renamed":
      return { lead: "Renamed", title: `${u.before ?? "?"} → ${u.after ?? u.title}`, detail: null };
    case "removed":
      return { lead: "Removed from Canvas", title: u.title, detail: u.before ? `· was due ${when(u.before, now)}` : null };
    case "grade-posted":
      return { lead: "Grade posted", title: u.title, detail: `— ${u.after ?? ""}${percent(u.after)}` };
    case "grade-changed":
      return { lead: "Grade changed", title: u.title, detail: `— ${u.before ?? "?"} → ${u.after ?? "?"}${percent(u.after)}` };
  }
}

function groupByDay(list: Update[]): [string, Update[]][] {
  const m = new Map<string, Update[]>();
  for (const u of list) {
    const k = dayKey(new Date(u.at));
    m.set(k, [...(m.get(k) ?? []), u]);
  }
  return [...m.entries()];
}
