import Link from "next/link";
import { countdown, dueLabel, formatDays, formatPercent } from "@/lib/format";
import type { CourseView, ItemView } from "@/server/model";
import { cx, focusRing, IconArrowRight, IconCalendar, IconClock, IconMapPin, IconPlus } from "@/ui";
import { CategoryBar } from "./CategoryBar";
import { formatRange, gradeTone, upcomingFor } from "./shared";

export function CourseCard({ course, items, now }: { course: CourseView; items: ItemView[]; now: Date }) {
  const s = course.syllabus;
  const upcoming = upcomingFor(items, course.id, now.getTime());
  const exam = upcoming.find((i) => i.type === "exam");
  const deadline = upcoming.find((i) => i.kind === "assignment");
  const percent = course.grade?.percent ?? null;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition hover:border-ink-3/40 hover:shadow-[0_4px_16px_-6px_rgb(0_0_0/0.12)]">
      <div className="h-1 w-full" style={{ background: course.color }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: course.color }} />
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink">
                <Link href={`/courses/${course.id}`} className={cx("rounded after:absolute after:inset-0", focusRing)}>
                  {course.name}
                </Link>
              </h2>
            </div>
            <p className="mt-0.5 truncate text-[13px] text-ink-2">{s?.courseTitle ?? course.label}</p>
            {s?.instructor && <p className="truncate text-[13px] text-ink-3">{s.instructor}</p>}
          </div>
          {course.grades ? (
            <div className="shrink-0 text-right">
              <div className={cx("tabular text-[26px] leading-none font-semibold tracking-tight", gradeTone(percent))}>{course.letter ?? "—"}</div>
              <div className="tabular mt-1 text-[13px] font-medium text-ink-2">{formatPercent(percent)}</div>
            </div>
          ) : (
            <Link href="/setup" className={cx("relative z-10 inline-flex shrink-0 items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-[12px] font-medium text-accent hover:brightness-95", focusRing)}>
              <IconPlus size={14} />
              Paste grades
            </Link>
          )}
        </div>

        {course.grade && course.grade.categories.some((c) => c.weight > 0) && (
          <div className="mt-4">
            <CategoryBar categories={course.grade.categories} color={course.color} />
          </div>
        )}

        <div className="mt-4 space-y-2 border-t border-border pt-4 text-[13px]">
          {s ? (
            s.meetings.length > 0 ? (
              s.meetings.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-ink-2">
                  <IconMapPin size={15} className="mt-px shrink-0 text-ink-3" />
                  <span className="min-w-0">
                    {formatDays(m.days)} · <span className="tabular">{formatRange(m.start, m.end)}</span>
                    {m.location && <span className="text-ink-3"> · {m.location}</span>}
                    {m.kind !== "lecture" && <span className="ml-1.5 rounded bg-surface-2 px-1 py-px text-[11px] font-medium text-ink-3 capitalize">{m.kind}</span>}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 text-ink-3">
                <IconMapPin size={15} className="shrink-0" />
                No class times in the syllabus
              </div>
            )
          ) : (
            <Link href="/setup" className={cx("relative z-10 flex items-center gap-2 font-medium text-accent hover:underline", focusRing)}>
              <IconPlus size={15} className="shrink-0" />
              Add syllabus for class times and weights
            </Link>
          )}
          <Row icon={<IconCalendar size={15} />} label="Next exam" item={exam} now={now} strong />
          <Row icon={<IconClock size={15} />} label="Next due" item={deadline} now={now} />
        </div>

        <div className="mt-auto flex items-center gap-1 pt-4 text-[13px] font-medium text-ink-3 transition group-hover:text-accent">
          Grades and calculator
          <IconArrowRight size={14} className="transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </article>
  );
}

function Row({ icon, label, item, now, strong }: { icon: React.ReactNode; label: string; item: ItemView | undefined; now: Date; strong?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-px shrink-0 text-ink-3">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-ink-3">{label}: </span>
        {item ? (
          <>
            <span className={cx("text-ink", strong && "font-medium")}>{item.title}</span>
            <span className="tabular text-ink-3">
              {" "}
              · {dueLabel(item, now)} <span className={cx(item.dueMs - now.getTime() < 3 * 86_400_000 && "text-warning")}>({countdown(item.dueMs, now)})</span>
            </span>
          </>
        ) : (
          <span className="text-ink-3">nothing coming up</span>
        )}
      </div>
    </div>
  );
}
