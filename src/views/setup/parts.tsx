"use client";

import { useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx, IconAlert, IconCheck } from "@/ui";

export type StepStatus = "done" | "current" | "todo" | "optional";

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputClass, "pr-7 pl-2.5", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, "h-auto py-2.5 leading-relaxed", className)} {...rest} />;
}

/** A labeled field. `label` is visually small but always present for screen readers. */
export function Field({ label, children, hint, className, hideLabel }: { label: string; children: ReactNode; hint?: ReactNode; className?: string; hideLabel?: boolean }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className={cx("text-[12px] font-medium text-ink-2", hideLabel && "sr-only")}>{label}</span>
      {children}
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function Notice({ tone = "info", children, action }: { tone?: "info" | "success" | "warning" | "danger"; children: ReactNode; action?: ReactNode }) {
  const styles = {
    info: "border-accent/20 bg-accent-soft text-accent",
    success: "border-success/25 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
    danger: "border-danger/25 bg-danger/10 text-danger",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border px-3.5 py-2.5 text-[13.5px] leading-snug", styles)}>
      <span className="mt-px shrink-0">{tone === "success" ? <IconCheck size={16} /> : <IconAlert size={16} />}</span>
      <div className="min-w-0 flex-1 basis-48">{children}</div>
      {action}
    </div>
  );
}

export function StatusPill({ status, label }: { status: StepStatus; label?: string }) {
  const map = {
    done: ["bg-success/10 text-success", "Done"],
    current: ["bg-accent-soft text-accent", "Up next"],
    todo: ["bg-surface-2 text-ink-3", "To do"],
    optional: ["bg-surface-2 text-ink-3", "Optional"],
  } as const;
  const [cls, text] = map[status];
  return <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium", cls)}>{label ?? text}</span>;
}

export function StepCard({
  id,
  n,
  title,
  summary,
  status,
  pill,
  children,
}: {
  id: string;
  n: number;
  title: string;
  summary: ReactNode;
  status: StepStatus;
  pill?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cx(
        "scroll-mt-20 rounded-xl border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition",
        status === "current" ? "border-accent/40 ring-4 ring-accent/10" : "border-border",
      )}
    >
      <header className="flex items-start gap-3.5 p-5 pb-0 sm:gap-4">
        <StepBadge n={n} status={status} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 id={`${id}-title`} className="text-[15px] font-semibold tracking-tight text-ink">
              {title}
            </h2>
            <StatusPill status={status} label={pill} />
          </div>
          <p className="mt-0.5 text-[13.5px] text-ink-3">{summary}</p>
        </div>
      </header>
      <div className="p-5 pt-4 sm:pl-[68px]">{children}</div>
    </section>
  );
}

export function StepBadge({ n, status, size = "md" }: { n: number; status: StepStatus; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "tabular grid shrink-0 place-items-center rounded-full font-semibold",
        size === "md" ? "size-8 text-[13px]" : "size-6 text-[12px]",
        status === "done" && "bg-success text-white",
        status === "current" && "bg-accent text-accent-ink",
        (status === "todo" || status === "optional") && "border border-border bg-surface-2 text-ink-3",
      )}
    >
      {status === "done" ? <IconCheck size={size === "md" ? 16 : 13} strokeWidth={2.5} /> : n}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cx("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}

/** "Working…" panel with a seconds counter, for slow Claude calls. */
export function WorkingPanel({ title, hint }: { title: string; hint: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent-soft px-4 py-3.5 text-accent">
      <Spinner />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{title}</div>
        <div className="text-[12.5px] opacity-80">{hint}</div>
      </div>
      <span className="tabular text-[13px] font-medium opacity-80">{secs}s</span>
    </div>
  );
}

/** Accessible on/off switch. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-5 w-9 shrink-0 rounded-full transition outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50",
        checked ? "bg-accent" : "bg-border",
      )}
    >
      <span className={cx("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

export function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}
