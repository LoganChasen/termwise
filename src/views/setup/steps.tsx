"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { connectFeed, finishSetup, saveGradesPaste, saveSemester, setDemo, updateCourse } from "@/app/actions";
import { ago, formatPercent, longDay } from "@/lib/format";
import type { AppData, CourseView } from "@/server/model";
import { Button, ButtonLink, CourseDot, cx, IconArrowRight, IconCheck } from "@/ui";
import { Field, Input, Notice, Spinner, Switch, Textarea, WorkingPanel } from "./parts";

// ---------- 1. Canvas feed ----------

export function FeedStep({ data, feedLink }: { data: AppData; feedLink: string | null }) {
  const router = useRouter();
  const demo = data.mode === "demo";
  const [replacing, setReplacing] = useState(false);
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{ courses: number; items: number } | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await connectFeed(url);
      if (!r.ok) return setError(r.error);
      setFound({ courses: r.courses, items: r.items });
      setReplacing(false);
      setUrl("");
      router.refresh();
    });
  };

  const connected = data.feedConnected && !replacing;

  return (
    <div className="flex flex-col gap-4">
      {found && (
        <Notice tone="success">
          Connected. Found <strong>{found.courses} {found.courses === 1 ? "course" : "courses"}</strong> and <strong>{found.items} assignments</strong>.
        </Notice>
      )}

      {connected ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2/60 px-4 py-3">
          <span className="grid size-8 place-items-center rounded-full bg-success/15 text-success">
            <IconCheck size={16} strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-ink">{demo ? "Sample calendar (demo mode)" : "Canvas calendar connected"}</div>
            <div className="truncate text-[12.5px] text-ink-3">
              {demo ? "The demo semester uses made-up courses." : (feedLink ?? "Saved link")}
              {!demo && data.lastSyncAt && ` · synced ${ago(data.lastSyncAt, new Date(data.now)).toLowerCase()}`}
            </div>
          </div>
          {!demo && (
            <Button size="sm" onClick={() => setReplacing(true)}>
              Replace link
            </Button>
          )}
        </div>
      ) : (
        <>
          <ol className="grid gap-2 text-[13.5px] text-ink-2 sm:grid-cols-2">
            {[
              <>Open Canvas and click <strong className="font-semibold text-ink">Calendar</strong> in the left sidebar.</>,
              <>At the bottom right, click <strong className="font-semibold text-ink">Calendar Feed</strong>.</>,
              <>Copy the link it shows (it ends in <code className="rounded bg-surface-2 px-1 text-[12.5px]">.ics</code>).</>,
              <>Paste it below and press <strong className="font-semibold text-ink">Connect</strong>.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-2.5 rounded-lg bg-surface-2/60 px-3 py-2.5">
                <span className="tabular grid size-5 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-semibold text-ink-2 ring-1 ring-border">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Calendar Feed link" className="flex-1">
              <Input
                type="url"
                inputMode="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://canvas.emory.edu/feeds/calendars/user_….ics"
                disabled={pending || demo}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <div className="flex gap-2">
              {replacing && (
                <Button onClick={() => (setReplacing(false), setError(null))} disabled={pending}>
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={pending || demo || !url.trim()} className="flex-1 sm:flex-none">
                {pending ? <Spinner /> : null}
                {pending ? "Checking link…" : "Connect"}
              </Button>
            </div>
          </form>
          <p className="text-[12.5px] text-ink-3">The link is private to you. It only lets Termwise read your calendar; it can&rsquo;t change anything in Canvas.</p>
        </>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

// ---------- 2. Semester dates ----------

export function SemesterStep({ data, saved }: { data: AppData; saved: boolean }) {
  const router = useRouter();
  const [start, setStart] = useState(data.semester.start);
  const [end, setEnd] = useState(data.semester.end);
  const [pending, run] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = start !== data.semester.start || end !== data.semester.end;

  const save = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await saveSemester(start, end);
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      {!saved && <p className="text-[13.5px] text-ink-2">These are a guess. Check them against your school&rsquo;s academic calendar and save.</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="First day of classes" className="sm:w-48">
          <Input type="date" value={start} onChange={(e) => (setStart(e.target.value), setMsg(null))} required />
        </Field>
        <Field label="Last day (incl. finals)" className="sm:w-48">
          <Input type="date" value={end} onChange={(e) => (setEnd(e.target.value), setMsg(null))} required />
        </Field>
        <Button type="submit" variant={saved && !dirty ? "secondary" : "primary"} disabled={pending || (saved && !dirty)}>
          {pending && <Spinner />}
          {saved && !dirty ? "Saved" : "Save dates"}
        </Button>
      </div>
      {msg && (msg.ok ? <p className="text-[13px] text-success">{msg.text}</p> : <Notice tone="danger">{msg.text}</Notice>)}
    </form>
  );
}

// ---------- 3. Courses ----------

export function CoursesStep({ courses }: { courses: CourseView[] }) {
  if (courses.length === 0) return <NeedsFeed />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] text-ink-2">Give each class a short name. Hide calendars that aren&rsquo;t real classes (clubs, advising, old courses).</p>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {courses.map((c) => (
          <CourseRow key={c.id} course={c} />
        ))}
      </ul>
    </div>
  );
}

function CourseRow({ course }: { course: CourseView }) {
  const router = useRouter();
  const [name, setName] = useState(course.name);
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = name.trim() !== course.name;

  const save = () =>
    run(async () => {
      const r = await updateCourse(course.id, { name });
      setError(r.ok ? null : r.error);
      if (r.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  const toggle = (show: boolean) =>
    run(async () => {
      const r = await updateCourse(course.id, { hidden: !show });
      setError(r.ok ? null : r.error);
      router.refresh();
    });

  return (
    <li className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 bg-surface px-3.5 py-3", course.hidden && "bg-surface-2/50")}>
      <CourseDot color={course.color} className={cx("size-2.5", course.hidden && "opacity-40")} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save();
        }}
        className="flex min-w-0 flex-1 basis-56 items-center gap-2"
      >
        <Field label={`Short name for ${course.label}`} hideLabel className="w-40 shrink-0 sm:w-48">
          <Input value={name} onChange={(e) => (setName(e.target.value), setSaved(false))} className="h-9" disabled={course.hidden} />
        </Field>
        {dirty ? (
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            Save
          </Button>
        ) : (
          saved && <span className="text-[12.5px] text-success">Saved</span>
        )}
        <span className="hidden min-w-0 truncate font-mono text-[12px] text-ink-3 md:inline" title={course.label}>
          {course.label}
        </span>
      </form>
      <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-2">
        <span>{course.hidden ? "Hidden" : "Shown"}</span>
        <Switch checked={!course.hidden} onChange={toggle} label={`Show ${course.name}`} disabled={pending} />
      </label>
      {error && <p className="w-full text-[12.5px] text-danger">{error}</p>}
    </li>
  );
}

export function NeedsFeed() {
  return <p className="rounded-lg border border-dashed border-border px-4 py-3 text-[13.5px] text-ink-3">Connect your Canvas calendar first. Your courses come from it.</p>;
}

// ---------- 5. Grades ----------

export function GradesStep({ data }: { data: AppData }) {
  const courses = data.courses.filter((c) => !c.hidden);
  const [open, setOpen] = useState<string | null>(null);
  if (courses.length === 0) return <NeedsFeed />;
  const demo = data.mode === "demo";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] text-ink-2">
        Canvas doesn&rsquo;t share grades in the calendar, so paste them in. Open the course&rsquo;s <strong className="font-semibold text-ink">Grades</strong> page, press{" "}
        <Kbd>⌘A</Kbd> then <Kbd>⌘C</Kbd>, and paste below. Paste again any time to pick up new grades.
      </p>
      {demo && <Notice tone="info">Grade pastes are turned off in demo mode. The sample semester already has grades.</Notice>}
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {courses.map((c) => (
          <GradeRow key={c.id} course={c} now={new Date(data.now)} open={open === c.id} onOpen={(o) => setOpen(o ? c.id : null)} disabled={demo} />
        ))}
      </ul>
    </div>
  );
}

function GradeRow({ course, now, open, onOpen, disabled }: { course: CourseView; now: Date; open: boolean; onOpen: (o: boolean) => void; disabled: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const g = course.grades;
  const graded = g?.entries.filter((e) => e.status === "graded").length ?? 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    run(async () => {
      const r = await saveGradesPaste(course.id, text);
      if (!r.ok) return setError(r.error);
      setResult(`Read ${r.entries} ${r.entries === 1 ? "grade" : "grades"} · ${r.posted} new`);
      setText("");
      onOpen(false);
      router.refresh();
    });
  };

  return (
    <li className="bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3">
        <CourseDot color={course.color} className="size-2.5" />
        <span className="text-[14px] font-medium text-ink">{course.name}</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-3">
          {result ? <span className="text-success">{result}</span> : g ? `${graded} graded · ${formatPercent(course.grade?.percent ?? null)} · pasted ${ago(g.pastedAt, now).toLowerCase()}` : "No grades yet"}
        </span>
        {!open && (
          <Button size="sm" onClick={() => onOpen(true)} disabled={disabled}>
            {g ? "Paste again" : "Paste grades"}
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="flex flex-col gap-2 px-3.5 pb-3.5">
          {pending ? (
            <WorkingPanel title="Reading grades…" hint="Usually 10–20 seconds." />
          ) : (
            <Field label={`Paste your Canvas Grades page for ${course.name}`}>
              <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the whole Grades page here (⌘A, ⌘C on the Canvas page, then ⌘V here)" autoFocus />
            </Field>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => (onOpen(false), setError(null))} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" type="submit" variant="primary" disabled={pending || text.trim().length < 20}>
              Read grades
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1 py-px font-sans text-[12px] text-ink">{children}</kbd>;
}

// ---------- 6. Finish ----------

export function FinishStep({ data, missingSyllabi }: { data: AppData; missingSyllabi: number }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (data.setupDone) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink-2">You&rsquo;re all set. Come back here any time to change links, dates, courses or syllabi.</p>
        <ButtonLink href="/" variant="secondary">
          Go to Updates <IconArrowRight size={16} />
        </ButtonLink>
      </div>
    );
  }

  const finish = () =>
    run(async () => {
      const r = await finishSetup();
      if (!r.ok) return setError(r.error);
      router.push("/");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink-2">
          {!data.feedConnected
            ? "Connect your Canvas calendar to finish."
            : missingSyllabi > 0
              ? `${missingSyllabi} ${missingSyllabi === 1 ? "course has" : "courses have"} no syllabus yet. That's fine; you can add ${missingSyllabi === 1 ? "it" : "them"} later.`
              : `Everything's in. Semester runs ${longDay(data.semester.start)} to ${longDay(data.semester.end)}.`}
        </p>
        <Button variant="primary" onClick={finish} disabled={pending || !data.feedConnected}>
          {pending && <Spinner />}
          Finish setup <IconArrowRight size={16} />
        </Button>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

// ---------- Demo notice ----------

export function DemoNotice() {
  const router = useRouter();
  const [pending, run] = useTransition();
  return (
    <Notice
      tone="warning"
      action={
        <Button
          size="sm"
          onClick={() =>
            run(async () => {
              await setDemo(false);
              router.refresh();
            })
          }
          disabled={pending}
        >
          {pending && <Spinner />}
          Turn off demo mode
        </Button>
      }
    >
      <strong className="font-semibold">Demo mode is on.</strong> You&rsquo;re looking at the sample semester, so changes here only edit the demo. Turn off demo mode to set up
      your own Canvas.
    </Notice>
  );
}
