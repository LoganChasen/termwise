"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { readSyllabus, saveSyllabus } from "@/app/actions";
import { formatClock, formatDays } from "@/lib/format";
import type { GradeCategory, Meeting, OfficeHours, SyllabusExam, SyllabusInfo, Weekday } from "@/lib/types";
import type { CourseView } from "@/server/model";
import { Button, CourseDot, cx, focusRing, IconPlus, IconUpload } from "@/ui";
import { Field, Input, Notice, Select, Textarea, TrashIcon, WorkingPanel } from "./parts";
import { NeedsFeed } from "./steps";

type Mode = { kind: "idle" } | { kind: "reading"; file: string } | { kind: "review"; info: SyllabusInfo; fresh: boolean };

// ---------- Step ----------

export function SyllabusStep({ courses }: { courses: CourseView[] }) {
  const [active, setActive] = useState<string | null>(null);
  if (courses.length === 0) return <NeedsFeed />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] text-ink-2">
        Upload each syllabus (PDF or .txt). Claude reads out exam dates, class times, office hours and how your grade is weighted. You check everything before it&rsquo;s saved.
      </p>
      <ul className="flex flex-col gap-2">
        {courses.map((c) => (
          <SyllabusRow key={c.id} course={c} active={active === c.id} onActive={(on) => setActive(on ? c.id : null)} />
        ))}
      </ul>
    </div>
  );
}

function SyllabusRow({ course, active, onActive }: { course: CourseView; active: boolean; onActive: (on: boolean) => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [, startTransition] = useTransition();
  const s = course.syllabus;
  const shown: Mode = active ? mode : { kind: "idle" };

  const pick = () => fileRef.current?.click();

  const upload = (file: File) => {
    setError(null);
    setSavedMsg(false);
    onActive(true);
    setMode({ kind: "reading", file: file.name });
    const form = new FormData();
    form.set("file", file);
    form.set("courseId", course.id);
    startTransition(async () => {
      try {
        const r = await readSyllabus(form);
        if (r.ok) setMode({ kind: "review", info: normalize(r.info), fresh: true });
        else {
          setError(r.error);
          setMode({ kind: "idle" });
        }
      } catch {
        setError("Couldn't upload that file. Try again.");
        setMode({ kind: "idle" });
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const edit = () => {
    if (!s) return;
    setError(null);
    setSavedMsg(false);
    onActive(true);
    setMode({ kind: "review", info: normalize(structuredClone(s)), fresh: false });
  };

  const close = () => {
    setMode({ kind: "idle" });
    onActive(false);
  };

  return (
    <li className={cx("rounded-lg border bg-surface transition", shown.kind === "review" ? "border-accent/40" : "border-border")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
        <CourseDot color={course.color} className="size-2.5" />
        <div className="min-w-0 flex-1 basis-48">
          <div className="text-[14px] font-medium text-ink">
            {course.name}
            {s?.courseTitle && <span className="font-normal text-ink-3"> · {s.courseTitle}</span>}
          </div>
          <div className="text-[12.5px] text-ink-3">{savedMsg ? <span className="text-success">Saved</span> : s ? summarize(s) : "No syllabus yet"}</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-label={`Syllabus file for ${course.name}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        {shown.kind === "idle" && (
          <div className="flex gap-2">
            {s ? (
              <>
                <Button size="sm" onClick={edit}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={pick}>
                  <IconUpload size={15} /> Replace
                </Button>
              </>
            ) : (
              <Button size="sm" variant="primary" onClick={pick}>
                <IconUpload size={15} /> Upload syllabus
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-3.5 pb-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {shown.kind === "reading" && (
        <div className="px-3.5 pb-3.5">
          <WorkingPanel title={`Reading ${shown.file}…`} hint="Reading syllabus… usually 20–40 seconds." />
        </div>
      )}
      {shown.kind === "review" && (
        <SyllabusEditor
          key={course.id}
          courseName={course.name}
          initial={shown.info}
          fresh={shown.fresh}
          onCancel={close}
          onSave={async (info) => {
            const r = await saveSyllabus(course.id, info);
            if (!r.ok) return r.error;
            close();
            setSavedMsg(true);
            router.refresh();
            return null;
          }}
        />
      )}
    </li>
  );
}

function summarize(s: SyllabusInfo): string {
  const parts: string[] = [];
  if (s.exams.length) parts.push(`${s.exams.length} ${s.exams.length === 1 ? "exam" : "exams"}`);
  if (s.categories.length) parts.push(`${s.categories.length} grade categories`);
  if (s.meetings[0]) parts.push(`${formatDays(s.meetings[0].days)} ${formatClock(s.meetings[0].start)}`);
  if (s.instructor) parts.push(s.instructor);
  return parts.join(" · ") || "Saved";
}

/** Make sure every list exists so the form never trips over a missing field. */
function normalize(i: SyllabusInfo): SyllabusInfo {
  return {
    courseTitle: i.courseTitle ?? null,
    instructor: i.instructor ?? null,
    meetings: i.meetings ?? [],
    officeHours: i.officeHours ?? [],
    exams: i.exams ?? [],
    categories: i.categories ?? [],
    letterScale: i.letterScale ?? null,
    latePolicy: i.latePolicy ?? null,
    notes: i.notes ?? [],
  };
}

// ---------- Review & confirm ----------

const DAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const blankExam = (): SyllabusExam => ({ title: "", date: "", time: null, type: "midterm", location: null });
const blankCat = (): GradeCategory => ({ name: "", weight: 0, dropLowest: 0 });
const blankMeeting = (): Meeting => ({ days: [], start: "", end: "", location: null, kind: "lecture" });
const blankOH = (): OfficeHours => ({ who: "", days: [], start: "", end: "", location: null });

function SyllabusEditor({
  courseName,
  initial,
  fresh,
  onCancel,
  onSave,
}: {
  courseName: string;
  initial: SyllabusInfo;
  fresh: boolean;
  onCancel: () => void;
  onSave: (info: SyllabusInfo) => Promise<string | null>;
}) {
  const [d, setD] = useState<SyllabusInfo>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SyllabusInfo>(k: K, v: SyllabusInfo[K]) => setD((p) => ({ ...p, [k]: v }));
  const patchAt = <K extends "exams" | "categories" | "meetings" | "officeHours">(k: K, i: number, patch: Partial<SyllabusInfo[K][number]>) =>
    setD((p) => ({ ...p, [k]: (p[k] as SyllabusInfo[K][number][]).map((row, j) => (j === i ? { ...row, ...patch } : row)) }));
  const removeAt = (k: "exams" | "categories" | "meetings" | "officeHours" | "notes", i: number) =>
    setD((p) => ({ ...p, [k]: (p[k] as unknown[]).filter((_, j) => j !== i) }));

  const total = d.categories.reduce((s, c) => s + (Number.isFinite(c.weight) ? c.weight : 0), 0);
  const totalOk = Math.abs(total - 100) < 0.01;

  const save = async () => {
    const { info, problems } = clean(d);
    if (problems.length) return setError(problems.join(" "));
    setError(null);
    setSaving(true);
    try {
      const err = await onSave(info);
      if (err) setError(err);
    } catch {
      setError("Couldn't save. Try again.");
    }
    setSaving(false);
  };

  return (
    <div className="border-t border-border px-3.5 pt-4 pb-4 sm:px-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">{fresh ? "Check what Claude found" : "Edit syllabus"}</h3>
          <p className="text-[13px] text-ink-3">
            {fresh ? `Fix anything that's off for ${courseName}, then save. Nothing is saved until you do.` : `Changes apply to ${courseName} everywhere in Termwise.`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Course title">
            <Input value={d.courseTitle ?? ""} onChange={(e) => set("courseTitle", e.target.value || null)} placeholder="e.g. Corporate Finance" />
          </Field>
          <Field label="Instructor">
            <Input value={d.instructor ?? ""} onChange={(e) => set("instructor", e.target.value || null)} placeholder="e.g. Prof. Whitfield" />
          </Field>
        </div>

        <Section title="Exams" count={d.exams.length} onAdd={() => set("exams", [...d.exams, blankExam()])} addLabel="Add exam">
          {d.exams.map((e, i) => (
            <Row key={i} onRemove={() => removeAt("exams", i)} label={`exam ${i + 1}`}>
              <Field label="Title" className="col-span-2 sm:col-span-4">
                <Input value={e.title} onChange={(ev) => patchAt("exams", i, { title: ev.target.value })} placeholder="Midterm" />
              </Field>
              <Field label="Date" className="col-span-2 sm:col-span-3">
                <Input type="date" value={e.date} onChange={(ev) => patchAt("exams", i, { date: ev.target.value })} />
              </Field>
              <Field label="Time" className="sm:col-span-3">
                <Input type="time" value={e.time ?? ""} onChange={(ev) => patchAt("exams", i, { time: ev.target.value || null })} />
              </Field>
              <Field label="Type" className="sm:col-span-2">
                <Select value={e.type} onChange={(ev) => patchAt("exams", i, { type: ev.target.value as SyllabusExam["type"] })}>
                  <option value="midterm">Midterm</option>
                  <option value="final">Final</option>
                  <option value="quiz">Quiz</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
            </Row>
          ))}
        </Section>

        <Section
          title="Grade breakdown"
          count={d.categories.length}
          onAdd={() => set("categories", [...d.categories, blankCat()])}
          addLabel="Add category"
          extra={
            d.categories.length > 0 && (
              <span className={cx("tabular rounded-full px-2 py-0.5 text-[12px] font-semibold", totalOk ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                Total {Math.round(total * 100) / 100}%
              </span>
            )
          }
        >
          {d.categories.map((c, i) => (
            <Row key={i} onRemove={() => removeAt("categories", i)} label={`category ${i + 1}`}>
              <Field label="Category" className="col-span-2 sm:col-span-6">
                <Input value={c.name} onChange={(ev) => patchAt("categories", i, { name: ev.target.value })} placeholder="Problem Sets" />
              </Field>
              <Field label="Weight (%)" className="sm:col-span-3">
                <Input type="number" min={0} max={100} step="any" inputMode="decimal" value={Number.isFinite(c.weight) ? c.weight : ""} onChange={(ev) => patchAt("categories", i, { weight: ev.target.value === "" ? NaN : Number(ev.target.value) })} />
              </Field>
              <Field label="Drop lowest" className="sm:col-span-3">
                <Input type="number" min={0} max={20} step={1} inputMode="numeric" value={c.dropLowest} onChange={(ev) => patchAt("categories", i, { dropLowest: Math.max(0, Math.floor(Number(ev.target.value) || 0)) })} />
              </Field>
            </Row>
          ))}
          {d.categories.length > 0 && !totalOk && (
            <Notice tone="warning">Weights add up to {Math.round(total * 100) / 100}%, not 100%. Check the syllabus; grades are still worked out from whatever is here.</Notice>
          )}
        </Section>

        <Section title="Class meetings" count={d.meetings.length} onAdd={() => set("meetings", [...d.meetings, blankMeeting()])} addLabel="Add meeting">
          {d.meetings.map((m, i) => (
            <Row key={i} onRemove={() => removeAt("meetings", i)} label={`meeting ${i + 1}`}>
              <DayPicker className="col-span-2 sm:col-span-12" value={m.days} onChange={(days) => patchAt("meetings", i, { days })} />
              <Field label="Starts" className="sm:col-span-3">
                <Input type="time" value={m.start} onChange={(ev) => patchAt("meetings", i, { start: ev.target.value })} />
              </Field>
              <Field label="Ends" className="sm:col-span-3">
                <Input type="time" value={m.end} onChange={(ev) => patchAt("meetings", i, { end: ev.target.value })} />
              </Field>
              <Field label="Kind" className="sm:col-span-2">
                <Select value={m.kind} onChange={(ev) => patchAt("meetings", i, { kind: ev.target.value as Meeting["kind"] })}>
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab</option>
                  <option value="section">Section</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Location" className="sm:col-span-4">
                <Input value={m.location ?? ""} onChange={(ev) => patchAt("meetings", i, { location: ev.target.value || null })} placeholder="Room" />
              </Field>
            </Row>
          ))}
        </Section>

        <Section title="Office hours" count={d.officeHours.length} onAdd={() => set("officeHours", [...d.officeHours, blankOH()])} addLabel="Add office hours">
          {d.officeHours.map((o, i) => (
            <Row key={i} onRemove={() => removeAt("officeHours", i)} label={`office hours ${i + 1}`}>
              <Field label="Who" className="col-span-2 sm:col-span-5">
                <Input value={o.who} onChange={(ev) => patchAt("officeHours", i, { who: ev.target.value })} placeholder="Prof. Whitfield" />
              </Field>
              <DayPicker className="col-span-2 sm:col-span-7" value={o.days} onChange={(days) => patchAt("officeHours", i, { days })} />
              <Field label="Starts" className="sm:col-span-3">
                <Input type="time" value={o.start} onChange={(ev) => patchAt("officeHours", i, { start: ev.target.value })} />
              </Field>
              <Field label="Ends" className="sm:col-span-3">
                <Input type="time" value={o.end} onChange={(ev) => patchAt("officeHours", i, { end: ev.target.value })} />
              </Field>
              <Field label="Location" className="col-span-2 sm:col-span-6">
                <Input value={o.location ?? ""} onChange={(ev) => patchAt("officeHours", i, { location: ev.target.value || null })} placeholder="Office or Zoom" />
              </Field>
            </Row>
          ))}
        </Section>

        <Field label="Late policy">
          <Textarea rows={2} value={d.latePolicy ?? ""} onChange={(e) => set("latePolicy", e.target.value || null)} placeholder="e.g. 10% off per day late" />
        </Field>

        <Section title="Other rules worth knowing" count={d.notes.length} onAdd={() => set("notes", [...d.notes, ""])} addLabel="Add note">
          {d.notes.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <Field label={`Note ${i + 1}`} hideLabel className="flex-1">
                <Input value={n} onChange={(e) => set("notes", d.notes.map((x, j) => (j === i ? e.target.value : x)))} placeholder="e.g. Lowest quiz is dropped" />
              </Field>
              <RemoveButton label={`note ${i + 1}`} onClick={() => removeAt("notes", i)} />
            </div>
          ))}
        </Section>

        {d.letterScale && d.letterScale.length > 0 && (
          <p className="text-[12.5px] text-ink-3">
            Uses the syllabus&rsquo;s own letter scale ({d.letterScale.slice(0, 3).map((l) => `${l.letter} ≥ ${l.min}`).join(", ")}…).
          </p>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 rounded-lg bg-surface/90 py-2 backdrop-blur md:bottom-0">
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save syllabus"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, count, children, onAdd, addLabel, extra }: { title: string; count: number; children: ReactNode; onAdd: () => void; addLabel: string; extra?: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-2.5 flex w-full items-center gap-2">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        <span className="tabular text-[12px] text-ink-3">{count}</span>
        {extra}
      </legend>
      {count === 0 && <p className="text-[13px] text-ink-3">None found.</p>}
      {children}
      <div>
        <Button size="sm" variant="ghost" onClick={onAdd} className="-ml-2 text-accent hover:text-accent">
          <IconPlus size={15} /> {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}

function Row({ children, onRemove, label }: { children: ReactNode; onRemove: () => void; label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-surface-2/60 p-2.5 sm:p-3">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2.5 sm:grid-cols-12">{children}</div>
      <RemoveButton label={label} onClick={onRemove} />
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Remove ${label}`} className={cx("grid size-9 shrink-0 place-items-center self-end rounded-lg text-ink-3 hover:bg-danger/10 hover:text-danger", focusRing)}>
      <TrashIcon />
    </button>
  );
}

function DayPicker({ value, onChange, className }: { value: Weekday[]; onChange: (d: Weekday[]) => void; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)} role="group" aria-label="Days">
      <span className="text-[12px] font-medium text-ink-2">Days</span>
      <div className="flex flex-wrap gap-1">
        {DAYS.map((day) => {
          const on = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== day) : DAYS.filter((x) => x === day || value.includes(x)))}
              className={cx(
                "h-8 min-w-10 rounded-md px-2 text-[12.5px] font-medium transition",
                on ? "bg-accent text-accent-ink" : "border border-border bg-surface text-ink-2 hover:bg-surface-2",
                focusRing,
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Trim, drop fully empty rows, and list anything half-filled. */
function clean(d: SyllabusInfo): { info: SyllabusInfo; problems: string[] } {
  const problems: string[] = [];
  const t = (s: string | null) => (s ?? "").trim();

  const exams = d.exams
    .map((e) => ({ ...e, title: t(e.title), location: t(e.location) || null }))
    .filter((e) => e.title || e.date);
  exams.forEach((e, i) => {
    if (!e.title) problems.push(`Exam ${i + 1} needs a title.`);
    if (!e.date) problems.push(`${e.title || `Exam ${i + 1}`} needs a date.`);
  });

  const categories = d.categories.map((c) => ({ ...c, name: t(c.name) })).filter((c) => c.name || c.weight);
  categories.forEach((c, i) => {
    if (!c.name) problems.push(`Grade category ${i + 1} needs a name.`);
    if (!Number.isFinite(c.weight) || c.weight < 0 || c.weight > 100) problems.push(`${c.name || `Category ${i + 1}`} needs a weight from 0 to 100.`);
  });

  const meetings = d.meetings.map((m) => ({ ...m, location: t(m.location) || null })).filter((m) => m.days.length || m.start || m.end);
  meetings.forEach((m, i) => {
    if (!m.days.length || !m.start || !m.end) problems.push(`Class meeting ${i + 1} needs days, a start and an end time.`);
  });

  const officeHours = d.officeHours.map((o) => ({ ...o, who: t(o.who), location: t(o.location) || null })).filter((o) => o.who || o.days.length || o.start || o.end);
  officeHours.forEach((o, i) => {
    if (!o.days.length || !o.start || !o.end) problems.push(`Office hours ${i + 1} need days, a start and an end time.`);
  });

  return {
    problems,
    info: {
      courseTitle: t(d.courseTitle) || null,
      instructor: t(d.instructor) || null,
      exams: exams.sort((a, b) => a.date.localeCompare(b.date)),
      categories,
      meetings,
      officeHours: officeHours.map((o) => ({ ...o, who: o.who || "Office hours" })),
      letterScale: d.letterScale,
      latePolicy: t(d.latePolicy) || null,
      notes: d.notes.map((n) => n.trim()).filter(Boolean),
    },
  };
}
