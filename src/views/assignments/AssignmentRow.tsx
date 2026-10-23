"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { countdown, dueLabel, formatHours, relativeDay } from "@/lib/format";
import { dayKey } from "@/lib/dates";
import type { CourseView, ItemView } from "@/server/model";
import { CourseChip, cx, focusRing, IconCheck, IconExternal, IconMapPin } from "@/ui";
import { IconX } from "./icons";
import { TYPE_LABEL } from "./meta";

export interface RowState {
  done: boolean;
  doneAt: string | null;
  hours: number;
  isOverride: boolean;
}

export function Checkbox({ checked, onChange, label, size = "md" }: { checked: boolean; onChange: (next: boolean) => void; label: string; size?: "md" | "lg" }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "grid shrink-0 place-items-center rounded-full border-[1.5px] transition",
        size === "lg" ? "size-[22px]" : "size-5",
        checked ? "border-success bg-success text-white" : "border-ink-3/60 text-transparent hover:border-success hover:text-success/60",
        focusRing,
      )}
    >
      <IconCheck size={size === "lg" ? 14 : 12} strokeWidth={3} />
    </button>
  );
}

/** One assignment in the stack. */
export function AssignmentRow({
  item,
  course,
  now,
  state,
  location,
  top = false,
  onToggle,
  onEstimate,
}: {
  item: ItemView;
  course: CourseView | undefined;
  now: Date;
  state: RowState;
  location: string | null;
  top?: boolean;
  onToggle: (next: boolean) => void;
  onEstimate: (hours: number | null) => void;
}) {
  const overdue = !state.done && item.dueMs < now.getTime();
  const soon = !overdue && item.dueMs - now.getTime() < 86_400_000;
  const isExam = item.type === "exam";

  return (
    <li
      className={cx(
        "relative flex items-start gap-3 px-4 transition-colors sm:px-5",
        top ? "bg-accent-soft/40 py-4" : "py-3",
        state.done && "opacity-60",
      )}
    >
      {top && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
      <div className={cx("pt-0.5", top && "pt-px")}>
        <Checkbox checked={state.done} onChange={onToggle} label={`Mark “${item.title}” ${state.done ? "not done" : "done"}`} size={top ? "lg" : "md"} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {top && <span className="rounded bg-accent px-1.5 py-px text-[10.5px] font-semibold tracking-wide text-accent-ink uppercase">Next up</span>}
            <span className={cx("min-w-0 break-words text-ink", top ? "text-[15px] font-semibold tracking-tight" : "text-[14px] font-medium", state.done && "line-through decoration-ink-3")}>{item.title}</span>
            {isExam && <span className="rounded bg-ink px-1.5 py-px text-[10.5px] font-semibold tracking-wide text-bg uppercase">Exam</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
            {course && <CourseChip name={course.name} color={course.color} />}
            {!isExam && <span>{TYPE_LABEL[item.type]}</span>}
            {item.source === "syllabus" && <span title="This date comes from your syllabus, not Canvas">From syllabus</span>}
            {location && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <IconMapPin size={13} className="shrink-0" />
                <span className="truncate">{location}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-2">
          <div className="flex min-w-0 items-baseline gap-2 sm:w-[132px] sm:flex-col sm:items-end sm:gap-0.5">
            <span className={cx("tabular text-[13px] font-medium whitespace-nowrap", overdue ? "text-danger" : "text-ink")}>
              {state.done && state.doneAt ? doneLabel(state.doneAt, now) : dueLabel(item, now)}
            </span>
            {!state.done && (
              <span className={cx("tabular text-[12px] whitespace-nowrap", overdue ? "font-medium text-danger" : soon ? "font-medium text-warning" : "text-ink-3")}>
                {overdue ? `Overdue · ${countdown(item.dueMs, now)}` : countdown(item.dueMs, now)}
              </span>
            )}
          </div>
          <span aria-hidden className="h-6 w-px bg-border max-sm:hidden" />
          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <EstimateEditor title={item.title} hours={state.hours} isOverride={state.isOverride} isExam={isExam} disabled={state.done} onSave={onEstimate} />
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open “${item.title}” in Canvas`}
                title="Open in Canvas"
                className={cx("grid size-8 shrink-0 place-items-center rounded-md text-ink-3 transition hover:bg-surface-2 hover:text-ink", focusRing)}
              >
                <IconExternal size={15} />
              </a>
            ) : (
              <span aria-hidden className="size-8 shrink-0 max-sm:hidden" />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** "Done today", "Done yesterday", "Done Oct 12". */
function doneLabel(iso: string, now: Date): string {
  const rel = relativeDay(dayKey(new Date(iso)), now);
  return `Done ${/^(Today|Tomorrow|Yesterday)$/.test(rel) ? rel.toLowerCase() : rel}`;
}

/** Hours chip that turns into a small inline editor. */
function EstimateEditor({ title, hours, isOverride, isExam, disabled, onSave }: { title: string; hours: number; isOverride: boolean; isExam: boolean; disabled: boolean; onSave: (h: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const open = () => {
    setValue(String(Math.round(hours * 4) / 4));
    setError(false);
    setEditing(true);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (!value.trim() || !Number.isFinite(n) || n < 0 || n > 100) {
      setError(true);
      return;
    }
    onSave(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} className="flex items-center gap-1">
        <label className={cx("flex h-8 items-center rounded-md border bg-surface pr-2 focus-within:ring-2 focus-within:ring-accent", error ? "border-danger" : "border-border")}>
          <span className="sr-only">Hours for {title}</span>
          <input
            ref={input}
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0"
            max="100"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="tabular h-full w-12 bg-transparent pl-2 text-[13px] text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[12px] text-ink-3">h</span>
        </label>
        <button type="submit" aria-label="Save hours" className={cx("grid size-8 place-items-center rounded-md bg-accent text-accent-ink hover:brightness-110", focusRing)}>
          <IconCheck size={14} strokeWidth={2.5} />
        </button>
        {isOverride && (
          <button
            type="button"
            onClick={() => {
              onSave(null);
              setEditing(false);
            }}
            className={cx("h-8 rounded-md px-2 text-[12px] font-medium whitespace-nowrap text-ink-2 hover:bg-surface-2", focusRing)}
          >
            Use automatic
          </button>
        )}
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className={cx("grid size-8 place-items-center rounded-md text-ink-3 hover:bg-surface-2", focusRing)}>
          <IconX size={14} />
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={disabled}
      title={isOverride ? "Your estimate. Click to change." : isExam ? "Estimated study time. Click to change." : "Estimated time. Click to change."}
      aria-label={`${formatHours(hours)} ${isOverride ? "(your estimate)" : "(estimated)"}. Edit hours for ${title}`}
      className={cx(
        "tabular flex h-8 w-[84px] items-center justify-end gap-1.5 rounded-md px-2 text-[13px] whitespace-nowrap transition hover:bg-surface-2 disabled:pointer-events-none",
        focusRing,
      )}
    >
      <span className="font-medium text-ink">{formatHours(hours)}</span>
      <span className={cx("rounded px-1 text-[10.5px] font-medium", isOverride ? "bg-accent-soft text-accent" : "text-ink-3")}>{isOverride ? "yours" : isExam ? "prep" : "est."}</span>
    </button>
  );
}
