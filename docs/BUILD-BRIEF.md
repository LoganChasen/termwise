# Termwise build brief (for contributors and agents)

Termwise is a local Next.js 16 app (React 19, TypeScript strict, Tailwind v4) that shows a student's semester:
Updates feed, Assignments stack, workload Heat map, Courses (grades, class times, grade calculator), Semester Wrapped, Setup.
Data comes from the Canvas calendar feed (iCal), syllabi parsed by the Claude API, and pasted Canvas Grades pages.
Emory forbids Canvas API tokens, so never add Canvas API calls or scraping.

## Architecture
- `src/lib/` — pure logic, unit-tested: `types.ts` (all shared types), `ics.ts`, `diff.ts`, `estimate.ts`, `heatmap.ts`
  (`buildHeatmap(items, range)` → weeks/days/levels/crunch), `grades.ts` (`computeGrade`, `solveForTarget`, `projectGrade`,
  `remainingWork`, `letterFor`, `minForLetter`, `DEFAULT_SCALE`), `dates.ts` (day keys "YYYY-MM-DD", local time),
  `format.ts` (`dueLabel`, `countdown`, `formatHours`, `relativeDay`, `longDay`, `shortDay`, `formatClock`, `formatDays`, `ago`, `weekLabel`),
  `config.ts` (all tunables, `courseColor(i)`).
- `src/server/` — server-only: `db.ts` (SQLite store), `model.ts` (`buildAppData` → `AppData` with `CourseView[]`, `ItemView[]`, updates),
  `mode.ts` (`loadAppData()` for pages; demo vs real via cookie), `sync.ts`.
- `src/app/actions.ts` — server actions for every write: `setDone`, `setEstimate`, `markSeen`, `syncNow`, `setDemo`, `updateCourse`,
  `connectFeed`, `saveSemester`, `finishSetup`, `readSyllabus(FormData)`, `saveSyllabus`, `saveGradesPaste`. They return `Result`.
- `src/ui/` — design system: `Card`, `CardHeader`, `Button`, `ButtonLink`, `buttonClass`, `CourseChip`, `CourseDot`, `EmptyState`,
  `PageHeader`, `Stat`, icons (`Icon*`), `cx`, `focusRing`, `Shell` (layout, already wired in `src/app/layout.tsx`).

## Page pattern
Pages are async server components: `const data = await loadAppData();` then pass plain data to client components
(`"use client"`) under `src/views/<feature>/`. Interactive writes call server actions, then `router.refresh()`.
Use `new Date(data.now)` as "now" in client components so server and client agree. Read `ItemView` fields
(`type`, `hours`, `dueMs`, `day`, `doneAt`, `source`, `url`) instead of recomputing.

## Design rules ("fresh look", must look polished)
- Tokens only (no raw hex except course colors from data): `bg-bg`, `bg-surface`, `bg-surface-2`, `border-border`, `text-ink`,
  `text-ink-2`, `text-ink-3`, `bg-accent`/`text-accent`/`bg-accent-soft`, `text-success|warning|danger`, heat ramp `var(--heat-0..5)`.
- Light theme default, dark mode via tokens (test both). Inter font, `tabular` class for numbers.
- Cards: `rounded-xl border bg-surface`. Spacing generous, 13–15px body text, headings semibold, tight tracking.
- Course identity = color dot/chip from `course.color`. Workload = heat ramp only. Accent (indigo) = interactive/selected.
- Must work at 390px wide with no horizontal page scroll (wide grids may scroll inside their own container).
- Accessible: buttons are `<button>`, labels on inputs, `aria-*` on toggles, visible focus (`focusRing`).
- Plain-English microcopy, no jargon.

## Commands
- `npm test` (vitest, TZ=America/New_York), `npx tsc --noEmit`.
- Dev server is already running at http://localhost:3500 (do not start another; it hot-reloads).
- Screenshots: `node /private/tmp/claude-501/-Users-loganchasen/af0373e1-9cb8-48ae-8bad-21c71a39a3ed/scratchpad/pw/shot.mjs <path> <out.png> [width=1360] [demo=1] [theme=light|dark]`
  — prints console errors and horizontal overflow. Run from the `pw` folder. Demo mode (cookie) gives a full fake semester.
- Do not commit; the lead reviews and commits. Do not edit files outside your ownership list; report needed shared changes instead.
