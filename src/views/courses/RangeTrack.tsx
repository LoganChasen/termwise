import { formatPercent } from "@/lib/format";
import type { LetterCutoff } from "@/lib/types";
import { cx } from "@/ui";

const pos = (p: number) => `${Math.max(0, Math.min(100, p))}%`;
/** Keep labels from hanging off the ends of the track. */
const labelPos = (p: number) => `${Math.max(7, Math.min(93, p))}%`;

/** Worst … current pace … best on a 0–100 track, with letter cutoffs as ticks. */
export function RangeTrack({
  worst,
  best,
  pace,
  whatIf,
  target,
  scale,
  color,
}: {
  worst: number;
  best: number;
  pace: number | null;
  whatIf: number | null;
  target: number | null;
  scale: LetterCutoff[];
  color: string;
}) {
  const lo = Math.min(worst, best);
  const hi = Math.max(worst, best);
  const cutoffs = scale.filter((c) => c.min > 0 && c.min < 100);
  const crowded = whatIf !== null && pace !== null && Math.abs(whatIf - pace) < 14;

  return (
    <div className="mt-4">
      {/* Marker labels */}
      <div className={cx("relative", crowded ? "h-[44px]" : "h-6")}>
        {pace !== null && (
          <div className="tabular absolute bottom-0 -translate-x-1/2 text-[12px] whitespace-nowrap text-ink-2" style={{ left: labelPos(pace) }}>
            Current pace <b className="font-semibold text-ink">{formatPercent(pace)}</b>
          </div>
        )}
        {whatIf !== null && (
          <div className={cx("tabular absolute -translate-x-1/2 text-[12px] whitespace-nowrap text-accent", crowded ? "top-0" : "bottom-0")} style={{ left: labelPos(whatIf) }}>
            What if <b className="font-semibold">{formatPercent(whatIf)}</b>
          </div>
        )}
      </div>

      {/* Track */}
      <div className="relative mt-1.5 h-3">
        <div className="absolute inset-0 rounded-full bg-surface-2" />
        <div
          className="absolute inset-y-0 rounded-full"
          style={{ left: pos(lo), width: `${Math.max(0.8, hi - lo)}%`, background: `color-mix(in srgb, ${color} 28%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)` }}
          title={`Possible final grade: ${formatPercent(lo)} to ${formatPercent(hi)}`}
        />
        {target !== null && (
          <div className="absolute -inset-y-1.5 w-0 border-l-2 border-dashed border-ink-2" style={{ left: pos(target) }} title={`Target ${formatPercent(target)}`} />
        )}
        {pace !== null && (
          <div
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow"
            style={{ left: pos(pace), background: color }}
            title={`Current pace ${formatPercent(pace)}`}
          />
        )}
        {whatIf !== null && (
          <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] border-2 border-surface bg-accent shadow" style={{ left: pos(whatIf) }} title={`What if ${formatPercent(whatIf)}`} />
        )}
      </div>

      {/* Letter ticks */}
      <div className="relative mt-1 h-8" aria-hidden>
        {[0, 100].map((v) => (
          <span key={v} className={cx("tabular absolute top-3 text-[10px] text-ink-3", v === 0 ? "left-0" : "right-0")}>
            {v}
          </span>
        ))}
        {cutoffs.map((c) => {
          const minor = /[+-]$/.test(c.letter);
          return (
            <div key={c.letter} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(c.min) }}>
              <span className={cx("w-px", minor ? "h-1.5 bg-border" : "h-2 bg-ink-3/60")} />
              <span className={cx("mt-0.5 text-[10px] leading-none font-medium", minor ? "hidden text-ink-3/80 lg:block" : "text-ink-2")}>{c.letter}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: `color-mix(in srgb, ${color} 28%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)` }} />
          <span className="tabular">
            Possible: {formatPercent(lo)} – {formatPercent(hi)}
          </span>
        </span>
        {pace !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: color }} />
            If you keep your current average
          </span>
        )}
        {target !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0 border-l-2 border-dashed border-ink-2" />
            <span className="tabular">Target {formatPercent(target, target % 1 ? 1 : 0)}</span>
          </span>
        )}
        {whatIf !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rotate-45 rounded-[2px] bg-accent" />
            Your what-if scores
          </span>
        )}
      </div>
    </div>
  );
}
