import { LEVEL_NAMES, levelRanges } from "./shared";

export function Legend() {
  const ranges = levelRanges();
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex items-end gap-2">
        <span className="pb-[15px] text-[12px] text-ink-3">Less</span>
        <ul className="flex gap-1" aria-label="Heat levels: estimated hours of work per day">
          {ranges.map((r, i) => (
            <li key={i} className="flex w-[38px] flex-col sm:w-[46px] items-center gap-1" title={`${LEVEL_NAMES[i]}: ${r.long.toLowerCase()}`}>
              <span className="h-3.5 w-full rounded-[4px]" style={{ background: `var(--heat-${i})` }} aria-hidden />
              <span className="tabular text-[10.5px] whitespace-nowrap text-ink-3">
                <span aria-hidden>{r.short}</span>
                <span className="sr-only">{r.long}</span>
              </span>
            </li>
          ))}
        </ul>
        <span className="pb-[15px] text-[12px] text-ink-3">More</span>
      </div>
      <div className="flex items-center gap-4 pb-[13px] text-[12px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative h-3.5 w-5 rounded-[4px]" style={{ background: "var(--heat-2)" }}>
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-ink ring-2 ring-surface" />
          </span>
          Exam
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-5 rounded-[4px] inset-ring-2 inset-ring-accent" style={{ background: "var(--heat-0)" }} />
          Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-5 rounded-[4px]" style={{ background: "color-mix(in srgb, var(--heat-4) 18%, transparent)" }} />
          Crunch week
        </span>
      </div>
    </div>
  );
}
