"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WrappedStats } from "@/lib/wrapped";
import { Button, ButtonLink, Card, cx, EmptyState, focusRing, IconArrowRight, IconWrapped, PageHeader } from "@/ui";
import { buildSlides } from "./slides";

const ANIM_CSS = `
.tw-wrap { --w-ink-bg: var(--ink); --w-ink-fg: var(--bg); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .tw-wrap { --w-ink-bg: var(--surface-2); --w-ink-fg: var(--ink); } }
:root[data-theme="dark"] .tw-wrap { --w-ink-bg: var(--surface-2); --w-ink-fg: var(--ink); }
@keyframes tw-slide-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
.tw-slide-enter { animation: tw-slide-in 380ms cubic-bezier(.2,.7,.2,1) both; }
@media (prefers-reduced-motion: reduce) { .tw-slide-enter { animation: none; } }
`;

export function WrappedView({ stats, feedConnected, initialSlide }: { stats: WrappedStats; feedConnected: boolean; initialSlide: number }) {
  const slides = useMemo(() => buildSlides(stats), [stats]);
  const last = slides.length - 1;
  const [index, setIndex] = useState(() => Math.min(Math.max(0, Math.floor(initialSlide)), last));
  const moved = useRef(false);

  const go = useCallback(
    (i: number) => {
      moved.current = true;
      setIndex(Math.min(Math.max(0, i), last));
    },
    [last],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moved.current = true;
        setIndex((i) => Math.min(i + 1, last));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moved.current = true;
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  const empty = stats.completed === 0 && stats.grades.length === 0 && stats.examsTaken === 0;
  if (empty) {
    return (
      <>
        <PageHeader title="Semester Wrapped" subtitle="Your semester in numbers." />
        <Card>
          <EmptyState
            icon={<IconWrapped />}
            title={feedConnected ? "Nothing to wrap yet" : "Connect Canvas to get your Wrapped"}
            body={
              feedConnected
                ? "Check off a few assignments or paste your grades, and your recap will start filling in."
                : "Wrapped is built from your Canvas calendar, your check-offs and your grades. Connect your calendar to start."
            }
            action={!feedConnected && <ButtonLink href="/setup" variant="primary">Go to setup</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  const slide = slides[index]!;
  return (
    <div className="tw-wrap">
      <style>{ANIM_CSS}</style>
      <PageHeader title="Semester Wrapped" subtitle={`${stats.season} · your semester in numbers`} />

      {stats.inProgress && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-accent/20 bg-accent-soft px-4 py-2.5 text-[13.5px] text-accent">
          <span className="flex items-start gap-2.5">
            <span className="relative mt-[5px] flex size-2 shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
            <span className="font-semibold">Semester in progress — this is your recap so far.</span>
          </span>
          <span className="pl-[18px] opacity-80 sm:pl-0">
            Week {stats.week} of {stats.weeksTotal}
          </span>
        </div>
      )}

      <div className="mb-3 flex gap-1" role="group" aria-label="Slides">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}: ${s.label}`}
            aria-current={i === index ? "step" : undefined}
            className={cx("group flex h-6 flex-1 items-center rounded", focusRing)}
          >
            <span className={cx("h-1.5 w-full rounded-full transition-colors", i <= index ? "bg-accent" : "bg-border group-hover:bg-ink-3/40")} />
          </button>
        ))}
      </div>

      <div key={slide.id} className="tw-slide-enter" aria-live="polite" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}: ${slide.label}`}>
        {slide.render(moved.current)}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide">
          <IconArrowRight className="rotate-180" size={16} />
          Back
        </Button>
        <div className="tabular text-[13px] text-ink-3">
          <span className="font-semibold text-ink">{index + 1}</span> / {slides.length}
          <span className="ml-2 hidden sm:inline">· {slide.label}</span>
        </div>
        {index < last ? (
          <Button variant="primary" onClick={() => go(index + 1)} aria-label="Next slide">
            Next
            <IconArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={() => go(0)}>Start over</Button>
        )}
      </div>
      <p className="mt-3 hidden text-center text-[12px] text-ink-3 md:block">Tip: use the ← and → keys.</p>
    </div>
  );
}
