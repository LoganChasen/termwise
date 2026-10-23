import type { ReactNode } from "react";
import { cx } from "./cx";

export function Card({ children, className, padded = true, as: As = "section" }: { children: ReactNode; className?: string; padded?: boolean; as?: "section" | "div" | "article" }) {
  return <As className={cx("rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]", padded && "p-5", className)}>{children}</As>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
