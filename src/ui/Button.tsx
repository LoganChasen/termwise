import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, focusRing } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const styles: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 shadow-sm",
  secondary: "border border-border bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "border border-danger/30 text-danger hover:bg-danger/10",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2" };

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cx("inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition disabled:opacity-50 disabled:pointer-events-none", styles[variant], sizes[size], focusRing, className);
}

export function Button({ variant, size, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({ href, variant, size, className, children, external }: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode; external?: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={buttonClass(variant, size, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
