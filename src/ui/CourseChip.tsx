import { cx } from "./cx";

/** Colored course tag, e.g. "FIN 320". */
export function CourseChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cx("inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[12px] font-medium", className)}
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

/** Just the colored dot. */
export function CourseDot({ color, className }: { color: string; className?: string }) {
  return <span className={cx("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: color }} />;
}
