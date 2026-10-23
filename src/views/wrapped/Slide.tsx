"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "@/ui";

/**
 * Slide styling. Every tone is built from design tokens only (accent + heat ramp + ink),
 * and text uses --accent-ink (white in light mode, near-black in dark mode), which reads
 * well on the accent and on the hot end of the heat ramp in both themes.
 */
export type Tone = "dusk" | "indigo" | "ember" | "ink" | "sunrise";

const TONES: Record<Tone, CSSProperties> = {
  dusk: {
    background:
      "radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, var(--heat-4) 70%, transparent), transparent 60%), linear-gradient(135deg, var(--accent) 0%, color-mix(in oklab, var(--accent) 55%, var(--heat-4)) 70%, var(--heat-4) 100%)",
    color: "var(--accent-ink)",
  },
  indigo: {
    background:
      "radial-gradient(90% 80% at 0% 100%, color-mix(in oklab, var(--accent) 60%, var(--ink)), transparent 70%), linear-gradient(160deg, var(--accent), color-mix(in oklab, var(--accent) 80%, var(--ink)))",
    color: "var(--accent-ink)",
  },
  ember: {
    background:
      "radial-gradient(110% 90% at 100% 100%, var(--heat-5), transparent 65%), linear-gradient(150deg, color-mix(in oklab, var(--heat-4) 85%, var(--heat-5)), var(--heat-5))",
    color: "var(--accent-ink)",
  },
  sunrise: {
    background:
      "radial-gradient(100% 100% at 0% 0%, var(--heat-4), transparent 70%), linear-gradient(200deg, var(--heat-5) 0%, color-mix(in oklab, var(--heat-5) 50%, var(--accent)) 100%)",
    color: "var(--accent-ink)",
  },
  // --w-ink-* are set in WrappedView: near-black in both themes so the heat ramp reads right.
  ink: {
    background:
      "radial-gradient(80% 70% at 100% 0%, color-mix(in oklab, var(--heat-4) 28%, transparent), transparent 70%), radial-gradient(70% 60% at 0% 100%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 70%), var(--w-ink-bg)",
    color: "var(--w-ink-fg)",
  },
};

/** Translucent panel on top of a slide (works on every tone in both themes). */
export const panel: CSSProperties = {
  background: "color-mix(in srgb, currentColor 10%, transparent)",
  border: "1px solid color-mix(in srgb, currentColor 18%, transparent)",
};

export function SlideFrame({ tone, kicker, children, mosaic = 0, className }: { tone: Tone; kicker: ReactNode; children: ReactNode; mosaic?: number; className?: string }) {
  return (
    <section
      className={cx("tw-slide relative isolate flex min-h-[460px] flex-col overflow-hidden rounded-2xl p-6 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.35)] sm:p-10 md:min-h-[500px] md:p-12", className)}
      style={TONES[tone]}
    >
      <Mosaic seed={mosaic} />
      <div className="relative flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] opacity-85">{kicker}</div>
      <div className="relative mt-auto flex flex-col pt-10">{children}</div>
    </section>
  );
}

/** Big headline number with an optional unit; counts up when `animate` is set. */
export function BigNumber({ value, unit, decimals = 0, animate, prefix }: { value: number; unit?: string; decimals?: number; animate: boolean; prefix?: string }) {
  const shown = useCountUp(value, animate);
  return (
    <div className="tabular flex items-baseline gap-2 leading-[0.9] font-semibold tracking-[-0.045em]">
      <span className="text-[76px] sm:text-[104px] md:text-[132px]">
        {prefix}
        {shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </span>
      {unit && <span className="text-[26px] tracking-[-0.02em] opacity-90 sm:text-[34px] md:text-[42px]">{unit}</span>}
    </div>
  );
}

export function Headline({ children, size = "lg" }: { children: ReactNode; size?: "lg" | "xl" }) {
  return (
    <div className={cx("font-semibold leading-[0.95] tracking-[-0.04em]", size === "xl" ? "text-[56px] sm:text-[84px] md:text-[104px]" : "text-[44px] sm:text-[64px] md:text-[80px]")}>
      {children}
    </div>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-4 max-w-[34ch] text-[18px] leading-snug font-medium opacity-90 sm:text-[21px] md:max-w-[40ch] md:text-[24px]">{children}</p>;
}

export function Footnote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[13px] leading-snug opacity-75 sm:text-[14px]">{children}</p>;
}

/** Heat-map motif: a little grid of squares at the corner, in the slide's text color. */
function Mosaic({ seed }: { seed: number }) {
  const cols = 6;
  const rows = 4;
  const cells = Array.from({ length: cols * rows }, (_, i) => {
    // Integer hash so server and client agree exactly.
    const r = (((i + 1) * 2654435761 + seed * 40503) % 1000) / 1000;
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Fade toward the bottom-left so the corner stays busy and the text area stays clean.
    const fade = Math.max(0, (col / (cols - 1)) * 0.7 + (1 - row / (rows - 1)) * 0.5 - 0.25);
    return r * fade;
  });
  return (
    <div aria-hidden className="pointer-events-none absolute top-5 right-5 grid grid-cols-6 gap-1 sm:top-8 sm:right-8 sm:gap-1.5">
      {cells.map((o, i) => (
        <span key={i} className="size-3 rounded-[3px] sm:size-4 md:size-5" style={{ backgroundColor: "currentColor", opacity: (Math.round((0.04 + o * 0.42) * 100) / 100).toString() }} />
      ))}
    </div>
  );
}

function useCountUp(target: number, animate: boolean): number {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  return v;
}
