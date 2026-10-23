"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { setDemo, syncIfStale, syncNow } from "@/app/actions";
import { cx, focusRing } from "./cx";
import { IconCourses, IconHeat, IconList, IconMoon, IconRefresh, IconSettings, IconSun, IconUpdates, IconWrapped } from "./icons";
import { Logo } from "./Logo";

const NAV = [
  { href: "/", label: "Updates", icon: IconUpdates },
  { href: "/assignments", label: "Assignments", icon: IconList },
  { href: "/calendar", label: "Heat map", icon: IconHeat },
  { href: "/courses", label: "Courses", icon: IconCourses },
  { href: "/wrapped", label: "Wrapped", icon: IconWrapped },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export interface ShellProps {
  mode: "real" | "demo";
  lastSyncAt: string | null;
  feedConnected: boolean;
  updateCount: number;
  children: ReactNode;
}

export function Shell({ mode, lastSyncAt, feedConnected, updateCount, children }: ShellProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Quietly refresh the feed when the app opens (server skips it if it synced recently).
  useEffect(() => {
    if (mode === "real" && feedConnected) void syncIfStale().then((r) => (r.ok ? r.changes > 0 && router.refresh() : setError(r.error)));
  }, [mode, feedConnected, router]);

  const sync = () =>
    start(async () => {
      const r = await syncNow();
      setError(r.ok ? null : r.error);
      router.refresh();
    });
  const toggleDemo = () =>
    start(async () => {
      await setDemo(mode !== "demo");
      router.refresh();
    });

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-border bg-surface md:flex" aria-label="Main">
        <Link href="/" className={cx("mx-3 mt-4 mb-6 flex h-10 items-center rounded-lg px-2", focusRing)} aria-label="Termwise home">
          <Logo />
        </Link>
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition",
                  active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  focusRing,
                )}
              >
                <Icon />
                <span className="flex-1">{n.label}</span>
                {n.href === "/" && updateCount > 0 && (
                  <span className="tabular rounded-full bg-accent px-1.5 py-px text-[11px] font-semibold text-accent-ink">{updateCount}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border p-3">
          {mode === "demo" ? (
            <div className="mb-1 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent">
              <div className="font-semibold">Demo semester</div>
              <div className="text-[12px] opacity-80">Sample data, not your Canvas.</div>
            </div>
          ) : (
            feedConnected && (
              <button type="button" onClick={sync} disabled={pending} className={cx("flex h-9 items-center gap-3 rounded-lg px-2.5 text-left text-sm text-ink-2 hover:bg-surface-2", focusRing)}>
                <IconRefresh className={pending ? "animate-spin" : undefined} />
                <span className="flex-1">
                  {pending ? "Syncing…" : "Sync Canvas"}
                  {lastSyncAt && !pending && <SyncedAgo iso={lastSyncAt} />}
                </span>
              </button>
            )
          )}
          {error && <p className="px-2.5 text-[12px] text-danger">{error}</p>}
          <Link href="/setup" className={cx("flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-ink-2 hover:bg-surface-2", isActive(pathname, "/setup") && "bg-surface-2 text-ink", focusRing)}>
            <IconSettings />
            Setup
          </Link>
          <div className="flex items-center gap-1">
            <button type="button" onClick={toggleDemo} disabled={pending} className={cx("flex h-9 flex-1 items-center gap-3 rounded-lg px-2.5 text-left text-sm text-ink-2 hover:bg-surface-2", focusRing)}>
              <span className={cx("relative h-4 w-7 rounded-full transition", mode === "demo" ? "bg-accent" : "bg-border")}>
                <span className={cx("absolute top-0.5 size-3 rounded-full bg-white shadow transition-all", mode === "demo" ? "left-3.5" : "left-0.5")} />
              </span>
              Demo mode
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur md:hidden">
        <Link href="/" aria-label="Termwise home">
          <Logo size={22} />
        </Link>
        <div className="flex items-center gap-1">
          {mode === "demo" && <span className="rounded-md bg-accent-soft px-2 py-1 text-[12px] font-semibold text-accent">Demo</span>}
          {mode === "real" && feedConnected && (
            <button type="button" onClick={sync} aria-label="Sync Canvas" className={cx("grid size-9 place-items-center rounded-lg text-ink-2", focusRing)}>
              <IconRefresh className={pending ? "animate-spin" : undefined} />
            </button>
          )}
          <Link href="/setup" aria-label="Setup" className={cx("grid size-9 place-items-center rounded-lg text-ink-2", focusRing)}>
            <IconSettings />
          </Link>
        </div>
      </header>

      <main className="px-4 pt-6 pb-28 md:ml-[232px] md:px-8 md:pt-8 md:pb-12">
        <div className="mx-auto max-w-[1120px]">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
        {NAV.map((n) => {
          const active = isActive(pathname, n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-accent" : "text-ink-3")}>
              <Icon size={20} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SyncedAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () => {
      const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
      setLabel(m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`);
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [iso]);
  return <span className="block text-[12px] text-ink-3">Synced {label}</span>;
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const stored = safeGet("tw-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(stored ? stored === "dark" : prefersDark);
  }, []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    safeSet("tw-theme", next ? "dark" : "light");
  };
  return (
    <button type="button" onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className={cx("grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2", focusRing)}>
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage blocked: theme just won't persist */
  }
}
