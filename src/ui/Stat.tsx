import type { ReactNode } from "react";

/** A labeled number: "12h this week". */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[13px] text-ink-3">{hint}</div>}
    </div>
  );
}
