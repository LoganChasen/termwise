import Link from "next/link";
import { matchCategory, remainingWork, type GradeResult } from "@/lib/grades";
import { ago, countdown, dueLabel, formatDays, formatPercent, longDay } from "@/lib/format";
import type { GradeCategory, GradeEntry } from "@/lib/types";
import type { AppData, CourseView, ItemView } from "@/server/model";
import { ButtonLink, Card, CardHeader, cx, focusRing, IconAlert, IconCalendar, IconClock, IconExternal, IconMapPin, IconUpload } from "@/ui";
import { CategoryBar } from "./CategoryBar";
import { GradeCalculator } from "./GradeCalculator";
import { categoriesFor, formatRange, gradeTone, plural, scaleFor, upcomingFor } from "./shared";

export function CourseDetail({ data, course }: { data: AppData; course: CourseView }) {
  const now = new Date(data.now);
  const s = course.syllabus;
  const categories = categoriesFor(course);
  const scale = scaleFor(course);
  const entries = course.grades?.entries ?? [];
  const courseItems = data.items.filter((i) => i.courseId === course.id);
  const upcoming = upcomingFor(data.items, course.id, now.getTime());
  const remaining = remainingWork(entries, categories);
  const dueLabels = Object.fromEntries(
    remaining.flatMap((r) => {
      const item = courseItems.find((i) => i.title === r.name) ?? courseItems.find((i) => !i.doneAt && /^[:(\s-]/.test(i.title.slice(r.name.length)) && i.title.toLowerCase().startsWith(r.name.toLowerCase()));
      return item ? [[r.name, `Due ${dueLabel(item, now)}`]] : [];
    }),
  );
  const canCalc = categories.length > 0 || entries.length > 0;

  return (
    <>
      <Link href="/courses" className={cx("mb-4 inline-flex items-center gap-1 rounded text-[13px] font-medium text-ink-3 hover:text-ink", focusRing)}>
        <span aria-hidden>←</span> All courses
      </Link>

      <header className="relative mb-6 overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6">
        <div className="absolute inset-y-0 left-0 w-1" style={{ background: course.color }} />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-medium tracking-wide text-ink-3 uppercase">
              <span className="size-2 rounded-full" style={{ background: course.color }} />
              {course.label}
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">
              {course.name}
              {s?.courseTitle && <span className="font-normal text-ink-2"> · {s.courseTitle}</span>}
            </h1>
            {s?.instructor && <p className="mt-1 text-sm text-ink-3">{s.instructor}</p>}
          </div>
          {course.grades && (
            <div className="flex items-end gap-4">
              <div className="sm:text-right">
                <div className="text-[12px] font-medium text-ink-3">Current grade</div>
                <div className="tabular text-[13px] text-ink-3">Updated {ago(course.grades.pastedAt, now).toLowerCase()}</div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cx("tabular text-[40px] leading-none font-semibold tracking-tight", gradeTone(course.grade?.percent ?? null))}>{course.letter ?? "—"}</span>
                <span className="tabular text-lg font-medium text-ink-2">{formatPercent(course.grade?.percent ?? null)}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {!course.grades && <PasteGradesHint hasSyllabus={!!s} />}
          {canCalc && <GradeCalculator entries={entries} categories={categories} scale={scale} color={course.color} dueLabels={dueLabels} />}
          {course.grade && <Breakdown grade={course.grade} color={course.color} />}
          {entries.length > 0 && <EntriesTable entries={entries} categories={categories} grade={course.grade} />}
        </div>

        <aside className="min-w-0 space-y-6">
          <ClassInfo course={course} />
          <Card>
            <CardHeader title="Coming up" subtitle={upcoming.length ? `${plural(upcoming.length, "item")} left this semester` : undefined} />
            {upcoming.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing left on the calendar for this course.</p>
            ) : (
              <ul className="-mx-2 space-y-0.5">
                {upcoming.slice(0, 5).map((i) => (
                  <UpcomingRow key={i.uid} item={i} now={now} />
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function PasteGradesHint({ hasSyllabus }: { hasSyllabus: boolean }) {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <IconUpload />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">No grades yet</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">
            <li>Open this course in Canvas and click Grades.</li>
            <li>Select the whole page (Cmd+A) and copy it (Cmd+C).</li>
            <li>Paste it into Termwise under Setup → Grades.</li>
          </ol>
          <p className="mt-2 text-[13px] text-ink-3">
            {hasSyllabus ? "Until then, the calculator below plans with your syllabus weights." : "Add the syllabus too, so Termwise knows how each part is weighted."}
          </p>
        </div>
        <ButtonLink href="/setup" variant="primary" size="sm">
          Paste grades
        </ButtonLink>
      </div>
    </Card>
  );
}

function Breakdown({ grade, color }: { grade: GradeResult; color: string }) {
  const cats = grade.categories.filter((c) => c.weight > 0 || c.possible > 0);
  return (
    <Card>
      <CardHeader title="Grade breakdown" subtitle={grade.weighted ? "Weighted by category, re-scaled over what's been graded so far." : "Total points earned out of points possible."} />
      {grade.weighted && (
        <div className="mb-5">
          <CategoryBar categories={grade.categories} color={color} labels />
        </div>
      )}
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-border bg-surface-2/50 text-left text-[12px] text-ink-3">
              <th className="py-2 pl-5 font-medium">Category</th>
              {grade.weighted && <th className="py-2 text-right font-medium">Weight</th>}
              <th className="hidden py-2 text-right font-medium sm:table-cell">Points</th>
              <th className="py-2 pr-5 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cats.map((c) => (
              <tr key={c.name}>
                <td className="py-2.5 pl-5">
                  <div className="font-medium text-ink">{c.name}</div>
                  <div className="text-[12px] text-ink-3">
                    {c.counted > 0 ? plural(c.counted, "score") + " counted" : "Nothing graded yet"}
                    {c.possible > 0 && <span className="tabular sm:hidden"> · {trim(c.earned)}/{trim(c.possible)} pts</span>}
                    {c.dropped.length > 0 && <span> · dropped {c.dropped.join(", ")}</span>}
                    {grade.weighted && c.weight === 0 && c.possible > 0 && <span> · not weighted</span>}
                  </div>
                </td>
                {grade.weighted && <td className="tabular py-2.5 pl-3 text-right text-ink-2">{c.weight}%</td>}
                <td className="tabular hidden py-2.5 text-right text-ink-2 sm:table-cell">{c.possible > 0 ? `${trim(c.earned)} / ${trim(c.possible)}` : "—"}</td>
                <td className={cx("tabular py-2.5 pr-5 text-right font-semibold", gradeTone(c.percent))}>{formatPercent(c.percent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EntriesTable({ entries, categories, grade }: { entries: GradeEntry[]; categories: GradeCategory[]; grade: GradeResult | null }) {
  const dropped = new Set(grade?.categories.flatMap((c) => c.dropped) ?? []);
  const scored = entries.filter((e) => e.status === "graded" || e.status === "missing" || e.status === "excused");
  const ungraded = entries.filter((e) => e.status === "ungraded");
  const cat = (e: GradeEntry) => matchCategory(e, categories)?.name ?? e.category ?? "Other";
  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <CardHeader title="All grades" subtitle={`${plural(scored.length, "graded item")}, ${ungraded.length} not graded yet`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-border bg-surface-2/50 text-left text-[12px] text-ink-3">
              <th className="py-2 pl-5 font-medium">Assignment</th>
              <th className="hidden py-2 font-medium sm:table-cell">Category</th>
              <th className="py-2 text-right font-medium">Score</th>
              <th className="py-2 pr-5 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...scored].reverse().map((e, i) => {
              const pct = e.status === "missing" ? 0 : e.score !== null && e.outOf ? (e.score / e.outOf) * 100 : null;
              const isDropped = dropped.has(e.name);
              return (
                <tr key={`${e.name}-${i}`} className={cx(isDropped && "text-ink-3")}>
                  <td className="max-w-0 py-2.5 pl-5">
                    <div className={cx("truncate font-medium", isDropped ? "text-ink-3 line-through decoration-ink-3/40" : "text-ink")}>{e.name}</div>
                    <div className="truncate text-[12px] text-ink-3 sm:hidden">{cat(e)}</div>
                    {(isDropped || e.status !== "graded") && (
                      <span
                        className={cx(
                          "mt-0.5 inline-block rounded px-1.5 py-px text-[11px] font-medium",
                          e.status === "missing" ? "bg-danger/10 text-danger" : "bg-surface-2 text-ink-3",
                        )}
                      >
                        {e.status === "missing" ? "Missing" : e.status === "excused" ? "Excused" : "Dropped"}
                      </span>
                    )}
                  </td>
                  <td className="hidden max-w-[160px] truncate py-2.5 pr-3 text-ink-2 sm:table-cell">{cat(e)}</td>
                  <td className="tabular py-2.5 text-right whitespace-nowrap text-ink-2">
                    {e.status === "excused" ? "—" : `${trim(e.status === "missing" ? 0 : (e.score ?? 0))} / ${trim(e.outOf ?? 0)}`}
                  </td>
                  <td className={cx("tabular py-2.5 pr-5 text-right font-medium", isDropped ? "text-ink-3" : gradeTone(pct))}>{e.status === "excused" ? "—" : formatPercent(pct, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ungraded.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          <div className="mb-2 text-[12px] font-medium text-ink-3">Not graded yet</div>
          <div className="flex flex-wrap gap-1.5">
            {ungraded.map((e, i) => (
              <span key={`${e.name}-${i}`} className="rounded-md border border-border bg-surface-2/50 px-2 py-0.5 text-[12px] text-ink-2">
                {e.name}
                {e.outOf ? <span className="tabular text-ink-3"> · {trim(e.outOf)} pts</span> : null}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ClassInfo({ course }: { course: CourseView }) {
  const s = course.syllabus;
  if (!s) {
    return (
      <Card>
        <CardHeader title="Class info" />
        <p className="text-sm text-ink-3">Upload the syllabus and Termwise pulls out class times, office hours, exam dates, and how your grade is weighted.</p>
        <ButtonLink href="/setup" size="sm" className="mt-4">
          Add syllabus
        </ButtonLink>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Class info" />
      <div className="space-y-5 text-[13px]">
        {s.meetings.length > 0 && (
          <InfoGroup label="Class times">
            {s.meetings.map((m, i) => (
              <div key={i} className="flex items-start gap-2">
                <IconClock size={15} className="mt-px shrink-0 text-ink-3" />
                <div className="min-w-0">
                  <div className="text-ink">
                    {formatDays(m.days)} · <span className="tabular">{formatRange(m.start, m.end)}</span>
                    {m.kind !== "lecture" && <span className="ml-1.5 rounded bg-surface-2 px-1 py-px text-[11px] font-medium text-ink-3 capitalize">{m.kind}</span>}
                  </div>
                  {m.location && (
                    <div className="flex items-center gap-1 text-ink-3">
                      <IconMapPin size={12} /> {m.location}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </InfoGroup>
        )}
        {s.officeHours.length > 0 && (
          <InfoGroup label="Office hours">
            {s.officeHours.map((o, i) => (
              <div key={i}>
                <div className="font-medium text-ink">{o.who}</div>
                <div className="text-ink-2">
                  {formatDays(o.days)} · <span className="tabular">{formatRange(o.start, o.end)}</span>
                  {o.location && <span className="text-ink-3"> · {o.location}</span>}
                </div>
              </div>
            ))}
          </InfoGroup>
        )}
        {s.exams.length > 0 && (
          <InfoGroup label="Exams">
            {s.exams.map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <IconCalendar size={15} className="mt-px shrink-0 text-ink-3" />
                <div>
                  <span className="font-medium text-ink">{e.title}</span>
                  <div className="tabular text-ink-3">
                    {longDay(e.date)}
                    {e.time && ` · ${formatRange(e.time, e.time).split("–")[1]}`}
                    {e.location && ` · ${e.location}`}
                  </div>
                </div>
              </div>
            ))}
          </InfoGroup>
        )}
        {s.latePolicy && (
          <InfoGroup label="Late work">
            <p className="leading-relaxed text-ink-2">{s.latePolicy}</p>
          </InfoGroup>
        )}
        {s.notes.length > 0 && (
          <InfoGroup label="Good to know">
            <ul className="space-y-1.5">
              {s.notes.map((n, i) => (
                <li key={i} className="flex gap-2 leading-relaxed text-ink-2">
                  <IconAlert size={14} className="mt-0.5 shrink-0 text-ink-3" />
                  {n}
                </li>
              ))}
            </ul>
          </InfoGroup>
        )}
      </div>
    </Card>
  );
}

function InfoGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function UpcomingRow({ item, now }: { item: ItemView; now: Date }) {
  const soon = item.dueMs - now.getTime() < 2 * 86_400_000;
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cx("truncate text-[13px] font-medium", item.type === "exam" ? "text-ink" : "text-ink")}>{item.title}</span>
          {item.type === "exam" && <span className="shrink-0 rounded bg-danger/10 px-1 py-px text-[10px] font-semibold text-danger uppercase">Exam</span>}
        </div>
        <div className="tabular text-[12px] text-ink-3">{dueLabel(item, now)}</div>
      </div>
      <span className={cx("tabular shrink-0 text-[12px] font-medium", soon ? "text-warning" : "text-ink-3")}>{countdown(item.dueMs, now)}</span>
      {item.url && <IconExternal size={13} className="shrink-0 text-ink-3 opacity-0 transition group-hover:opacity-100" />}
    </>
  );
  return (
    <li>
      {item.url ? (
        <a href={item.url} target="_blank" rel="noreferrer" className={cx("group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2", focusRing)}>
          {body}
        </a>
      ) : (
        <div className="flex items-center gap-3 px-2 py-2">{body}</div>
      )}
    </li>
  );
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
