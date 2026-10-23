/** Termwise mark: a 3×3 week grid with a warm "crunch" cell, plus the wordmark. */
export function Logo({ size = 26, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const c = (x: number, y: number, fill: string) => <rect x={x} y={y} width="8" height="8" rx="2" fill={fill} />;
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden>
        {c(1, 1, "var(--heat-1)")}
        {c(11, 1, "var(--heat-2)")}
        {c(21, 1, "var(--heat-1)")}
        {c(1, 11, "var(--heat-2)")}
        {c(11, 11, "var(--heat-4)")}
        {c(21, 11, "var(--heat-3)")}
        {c(1, 21, "var(--heat-1)")}
        {c(11, 21, "var(--heat-3)")}
        {c(21, 21, "var(--accent)")}
      </svg>
      {wordmark && <span className="text-[17px] font-semibold tracking-tight text-ink">Termwise</span>}
    </span>
  );
}
