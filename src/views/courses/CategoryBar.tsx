import type { CategoryResult } from "@/lib/grades";
import { formatPercent } from "@/lib/format";

/**
 * Tiny breakdown bar: one segment per weighted category, width = weight,
 * filled to the category's current percent (empty track = nothing graded yet).
 */
export function CategoryBar({ categories, color, labels = false }: { categories: CategoryResult[]; color: string; labels?: boolean }) {
  const cats = categories.filter((c) => c.weight > 0);
  const total = cats.reduce((s, c) => s + c.weight, 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="flex gap-[3px]" role="img" aria-label={cats.map((c) => `${c.name} ${c.weight}%: ${c.percent === null ? "not graded yet" : formatPercent(c.percent, 0)}`).join(", ")}>
        {cats.map((c) => (
          <div key={c.name} className="relative h-1.5 overflow-hidden rounded-full bg-surface-2" style={{ flex: `${c.weight} 1 0` }} title={`${c.name} (${c.weight}%): ${c.percent === null ? "not graded yet" : formatPercent(c.percent)}`}>
            {c.percent !== null && <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, c.percent)}%`, background: color }} />}
          </div>
        ))}
      </div>
      {labels ? (
        <div className="mt-1.5 hidden gap-[3px] sm:flex" aria-hidden>
          {cats.map((c) => (
            <div key={c.name} className="min-w-0 truncate text-[11px] text-ink-3" style={{ flex: `${c.weight} 1 0` }}>
              {c.weight >= 10 ? c.name : ""}
            </div>
          ))}
        </div>
      ) : (
        <p className="tabular mt-1.5 text-[12px] text-ink-3">
          {(() => {
            const done = cats.filter((c) => c.percent !== null);
            const left = Math.round((cats.filter((c) => c.percent === null).reduce((s, c) => s + c.weight, 0) / total) * 100);
            return `${done.length} of ${cats.length} parts graded${left > 0 ? ` · ${left}% of the grade still to come` : ""}`;
          })()}
        </p>
      )}
    </div>
  );
}
