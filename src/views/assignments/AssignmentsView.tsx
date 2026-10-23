"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { setDone, setEstimate } from "@/app/actions";
import { addDays, dayKey, startOfWeek } from "@/lib/dates";
import { formatHours, longDay, shortDay } from "@/lib/format";
import type { CourseView, ItemView } from "@/server/model";
import { ButtonLink, Card, cx, EmptyState, focusRing, IconAlert, IconCheck, IconList, PageHeader } from "@/ui";
import { AssignmentRow, type RowState } from "./AssignmentRow";
import { IconChevron, IconSearch, IconUndo, IconX } from "./icons";
import { courseMap, examLocation, TYPE_LABEL } from "./meta";

type GroupKey = "overdue" | "today" | "tomorrow" | "week" | "next" | "later";

interface Group {
  key: GroupKey;
  label: string;
  detail: string | null;
  items: ItemView[];
}

const DONE_PAGE = 15;
/** "Later" can be long; show the soonest few until asked. */
const LATER_PREVIEW = 8;

export function AssignmentsView({ items, courses, now: nowIso, setupDone }: { items: ItemView[]; courses: CourseView[]; now: string; setupDone: boolean }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const byCourse = useMemo(() => courseMap(courses), [courses]);

  // Optimistic overrides, keyed by uid. They agree with the server once it refreshes.
  const [doneMap, setDoneMap] = useState<Record<string, string | null>>({});
  const [hoursMap, setHoursMap] = useState<Record<string, number | null>>({});
  const [lingering, setLingering] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ uid: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneLimit, setDoneLimit] = useState(DONE_PAGE);
  const [laterAll, setLaterAll] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (toastTimer.current && clearTimeout(toastTimer.current)), []);

  const stateOf = (i: ItemView): RowState => {
    const doneAt = i.uid in doneMap ? (doneMap[i.uid] ?? null) : i.doneAt;
    const override = i.uid in hoursMap ? (hoursMap[i.uid] ?? null) : i.estimateOverride;
    return { done: doneAt !== null, doneAt, hours: override ?? i.estimatedHours, isOverride: override !== null };
  };

  const toggle = (item: ItemView, next: boolean) => {
    const prev = item.uid in doneMap ? (doneMap[item.uid] ?? null) : item.doneAt;
    setDoneMap((m) => ({ ...m, [item.uid]: next ? new Date().toISOString() : null }));
    if (next) {
      // Keep the row in place for a beat so the check registers before it leaves the stack.
      setLingering((s) => new Set(s).add(item.uid));
      setTimeout(() => setLingering((s) => (s.delete(item.uid) ? new Set(s) : s)), 700);
      setToast({ uid: item.uid, title: item.title });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    } else if (toast?.uid === item.uid) setToast(null);
    startTransition(async () => {
      const r = await setDone(item.uid, next);
      if (!r.ok) {
        setDoneMap((m) => ({ ...m, [item.uid]: prev }));
        setError(r.error);
      } else setError(null);
      router.refresh();
    });
  };

  const saveHours = (item: ItemView, hours: number | null) => {
    const prev = item.uid in hoursMap ? (hoursMap[item.uid] ?? null) : item.estimateOverride;
    setHoursMap((m) => ({ ...m, [item.uid]: hours }));
    startTransition(async () => {
      const r = await setEstimate(item.uid, hours);
      if (!r.ok) {
        setHoursMap((m) => ({ ...m, [item.uid]: prev }));
        setError(r.error);
      } else setError(null);
      router.refresh();
    });
  };

  // ---------- filtering ----------
  const live = useMemo(() => items.filter((i) => !i.removedAt), [items]);
  const courseOptions = useMemo(() => courses.filter((c) => !c.hidden && live.some((i) => i.courseId === c.id)), [courses, live]);
  const q = query.trim().toLowerCase();
  const matches = (i: ItemView) => {
    if (picked.size > 0 && !(i.courseId && picked.has(i.courseId))) return false;
    if (!q) return true;
    const c = i.courseId ? byCourse.get(i.courseId) : undefined;
    return [i.title, c?.name, c?.label, TYPE_LABEL[i.type]].some((s) => s?.toLowerCase().includes(q));
  };
  const filtering = picked.size > 0 || q.length > 0;

  const nowMs = now.getTime();
  const isOpen = (i: ItemView) => !stateOf(i).done || lingering.has(i.uid);
  // Overdue: only Canvas items (syllabus exams in the past just happened).
  const openItems = live.filter((i) => isOpen(i) && (i.dueMs >= nowMs || i.source === "feed"));
  const shown = openItems.filter(matches);
  const finished = live.filter((i) => stateOf(i).done && !lingering.has(i.uid)).filter(matches);

  const groups = groupItems(shown, now);
  const topUid = shown.find((i) => i.dueMs >= nowMs && !stateOf(i).done)?.uid ?? null;

  const weekAhead = shown.filter((i) => i.dueMs >= nowMs && i.dueMs < nowMs + 7 * 86_400_000 && !stateOf(i).done);
  const weekHours = weekAhead.reduce((s, i) => s + stateOf(i).hours, 0);
  const overdueCount = groups.find((g) => g.key === "overdue")?.items.length ?? 0;

  const pickCourse = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ---------- empty: nothing at all ----------
  if (live.length === 0) {
    return (
      <>
        <PageHeader title="Assignments" />
        <Card>
          <EmptyState
            icon={<IconList />}
            title={setupDone ? "No assignments yet" : "Connect Canvas to see your assignments"}
            body={
              setupDone
                ? "Your Canvas calendar doesn't list anything yet. Once your classes post work, it shows up here, soonest first."
                : "Termwise reads your Canvas calendar feed and stacks every assignment by due date. It takes about two minutes."
            }
            action={
              <ButtonLink href="/setup" variant="primary">
                {setupDone ? "Check setup" : "Set up Termwise"}
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  }

  const summary = (
    <span className="tabular">
      {weekAhead.length === 0 ? "Nothing due in the next 7 days" : `${weekAhead.length} ${weekAhead.length === 1 ? "assignment" : "assignments"} in the next 7 days`}
      {weekHours > 0 && <> · ~{formatHours(weekHours)} of work</>}
      {overdueCount > 0 && <span className="font-medium text-danger"> · {overdueCount} overdue</span>}
      {filtering && <span className="text-ink-3"> (filtered)</span>}
    </span>
  );

  return (
    <>
      <PageHeader title="Assignments" subtitle={summary} />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex h-9 min-w-0 flex-1 items-center sm:max-w-[320px]">
            <span className="sr-only">Search assignments</span>
            <IconSearch className="pointer-events-none absolute left-3 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assignments"
              className="h-full w-full rounded-lg border border-border bg-surface pr-8 pl-9 text-[13.5px] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className={cx("absolute right-1.5 grid size-6 place-items-center rounded text-ink-3 hover:text-ink", focusRing)}>
                <IconX size={14} />
              </button>
            )}
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={showDone}
            onClick={() => setShowDone((v) => !v)}
            className={cx("ml-auto flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2", focusRing)}
          >
            <span className={cx("relative h-4 w-7 rounded-full transition", showDone ? "bg-accent" : "bg-border")}>
              <span className={cx("absolute top-0.5 size-3 rounded-full bg-white shadow transition-all", showDone ? "left-3.5" : "left-0.5")} />
            </span>
            Show finished
          </button>
        </div>
        {courseOptions.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by course">
            {courseOptions.map((c) => {
              const on = picked.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickCourse(c.id)}
                  className={cx("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition", on ? "" : "border-border bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink", focusRing)}
                  style={on ? { color: c.color, borderColor: `color-mix(in srgb, ${c.color} 45%, transparent)`, background: `color-mix(in srgb, ${c.color} 12%, transparent)` } : undefined}
                >
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                  {on && <IconCheck size={12} strokeWidth={2.5} />}
                </button>
              );
            })}
            {picked.size > 0 && (
              <button type="button" onClick={() => setPicked(new Set())} className={cx("h-8 rounded-full px-2.5 text-[12.5px] font-medium text-ink-3 hover:text-ink", focusRing)}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          <IconAlert size={15} /> {error}
        </p>
      )}

      {groups.length === 0 ? (
        <Card>
          {filtering ? (
            <EmptyState
              icon={<IconSearch size={18} />}
              title="Nothing matches"
              body="No upcoming assignments match these filters."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setPicked(new Set());
                  }}
                  className={cx("h-9 rounded-lg border border-border bg-surface px-3.5 text-[13px] font-medium text-ink hover:bg-surface-2", focusRing)}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <EmptyState icon={<IconCheck />} title="You're all caught up" body="Nothing left on your list. New work shows up here as soon as Canvas posts it." />
          )}
        </Card>
      ) : (
        <Card padded={false} className="overflow-clip">
          {groups.map((g, gi) => {
            const hours = g.items.reduce((s, i) => s + (stateOf(i).done ? 0 : stateOf(i).hours), 0);
            const open = g.items.filter((i) => !stateOf(i).done).length;
            const overdue = g.key === "overdue";
            return (
              <section key={g.key} aria-labelledby={`grp-${g.key}`}>
                <header
                  className={cx(
                    "sticky top-14 z-10 flex items-center justify-between gap-3 border-b border-border px-4 py-2 backdrop-blur sm:px-5 md:top-0",
                    gi > 0 && "border-t",
                    !overdue && "bg-surface-2/90",
                  )}
                  style={overdue ? { background: "color-mix(in srgb, var(--danger) 7%, var(--surface))" } : undefined}
                >
                  <h2 id={`grp-${g.key}`} className={cx("flex min-w-0 items-center gap-2 text-[12.5px] font-semibold", overdue ? "text-danger" : "text-ink")}>
                    {overdue && <IconAlert size={14} />}
                    {g.label}
                    {g.detail && <span className="truncate font-normal text-ink-3">{g.detail}</span>}
                  </h2>
                  <span className={cx("tabular shrink-0 text-[12px]", overdue ? "text-danger/80" : "text-ink-3")}>
                    {open} {open === 1 ? "item" : "items"}
                    {hours > 0 && <> · {formatHours(hours)}</>}
                  </span>
                </header>
                <ul className="divide-y divide-border">
                  {(g.key === "later" && !laterAll && !filtering ? g.items.slice(0, LATER_PREVIEW) : g.items).map((i) => {
                    const c = i.courseId ? byCourse.get(i.courseId) : undefined;
                    return (
                      <AssignmentRow
                        key={i.uid}
                        item={i}
                        course={c}
                        now={now}
                        state={stateOf(i)}
                        location={examLocation(i, c)}
                        top={i.uid === topUid}
                        onToggle={(next) => toggle(i, next)}
                        onEstimate={(h) => saveHours(i, h)}
                      />
                    );
                  })}
                </ul>
                {g.key === "later" && !filtering && g.items.length > LATER_PREVIEW && (
                  <div className="border-t border-border p-2 text-center">
                    <button type="button" aria-expanded={laterAll} onClick={() => setLaterAll((v) => !v)} className={cx("h-8 rounded-md px-3 text-[13px] font-medium text-accent hover:bg-accent-soft", focusRing)}>
                      {laterAll ? "Show fewer" : `Show all ${g.items.length} later assignments`}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </Card>
      )}

      {showDone && (
        <Card padded={false} className="mt-4 overflow-clip">
          <button
            type="button"
            aria-expanded={doneOpen}
            onClick={() => setDoneOpen((v) => !v)}
            className={cx("flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2/60 sm:px-5", focusRing)}
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <IconChevron size={14} className={cx("text-ink-3 transition-transform", doneOpen && "rotate-90")} />
              Done
              <span className="tabular font-normal text-ink-3">{finished.length}</span>
            </span>
            <span className="tabular text-[12px] text-ink-3">{formatHours(finished.reduce((s, i) => s + stateOf(i).hours, 0))} of work finished</span>
          </button>
          {doneOpen &&
            (finished.length === 0 ? (
              <p className="border-t border-border px-5 py-6 text-center text-[13px] text-ink-3">Nothing checked off{filtering ? " that matches these filters" : " yet"}.</p>
            ) : (
              <>
                <ul className="divide-y divide-border border-t border-border">
                  {[...finished]
                    .sort((a, b) => (stateOf(b).doneAt ?? "").localeCompare(stateOf(a).doneAt ?? "") || b.dueMs - a.dueMs)
                    .slice(0, doneLimit)
                    .map((i) => {
                      const c = i.courseId ? byCourse.get(i.courseId) : undefined;
                      return <AssignmentRow key={i.uid} item={i} course={c} now={now} state={stateOf(i)} location={null} onToggle={(next) => toggle(i, next)} onEstimate={(h) => saveHours(i, h)} />;
                    })}
                </ul>
                {finished.length > doneLimit && (
                  <div className="border-t border-border p-2 text-center">
                    <button type="button" onClick={() => setDoneLimit((n) => n + 30)} className={cx("h-8 rounded-md px-3 text-[13px] font-medium text-accent hover:bg-accent-soft", focusRing)}>
                      Show {Math.min(30, finished.length - doneLimit)} more
                    </button>
                  </div>
                )}
              </>
            ))}
        </Card>
      )}

      {toast && (
        <div role="status" className="fixed bottom-20 left-1/2 z-40 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-xl bg-ink py-2 pr-2 pl-4 text-[13px] text-bg shadow-lg md:bottom-6 md:ml-[116px]">
          <IconCheck size={14} strokeWidth={2.5} className="shrink-0 text-success" />
          <span className="min-w-0 truncate">
            Done: <span className="font-medium">{toast.title}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              const item = live.find((i) => i.uid === toast.uid);
              if (item) toggle(item, false);
              setToast(null);
            }}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-medium hover:bg-bg/15 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <IconUndo size={14} /> Undo
          </button>
        </div>
      )}
    </>
  );
}

/** Overdue, Today, Tomorrow, This week, Next week, Later. Empty groups are dropped. */
function groupItems(items: ItemView[], now: Date): Group[] {
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(startOfWeek(today), 6);
  const nextStart = addDays(weekEnd, 1);
  const nextEnd = addDays(weekEnd, 7);
  const nowMs = now.getTime();

  const groups: Group[] = [
    { key: "overdue", label: "Overdue", detail: null, items: [] },
    { key: "today", label: "Today", detail: longDay(today), items: [] },
    { key: "tomorrow", label: "Tomorrow", detail: longDay(tomorrow), items: [] },
    { key: "week", label: "This week", detail: addDays(tomorrow, 1) <= weekEnd ? `${shortDay(addDays(tomorrow, 1))} – ${shortDay(weekEnd)}` : null, items: [] },
    { key: "next", label: "Next week", detail: `${shortDay(nextStart)} – ${shortDay(nextEnd)}`, items: [] },
    { key: "later", label: "Later", detail: null, items: [] },
  ];
  const at = (k: GroupKey) => groups.find((g) => g.key === k)!.items;
  for (const i of items) {
    if (i.dueMs < nowMs && !i.doneAt) at("overdue").push(i);
    else if (i.day <= today) at("today").push(i);
    else if (i.day === tomorrow) at("tomorrow").push(i);
    else if (i.day <= weekEnd) at("week").push(i);
    else if (i.day <= nextEnd) at("next").push(i);
    else at("later").push(i);
  }
  return groups.filter((g) => g.items.length > 0);
}
