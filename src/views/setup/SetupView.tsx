"use client";

import type { ReactNode } from "react";
import { shortDay } from "@/lib/format";
import type { AppData } from "@/server/model";
import { cx, focusRing, PageHeader } from "@/ui";
import { LockIcon, StepBadge, StepCard, type StepStatus } from "./parts";
import { CoursesStep, DemoNotice, FeedStep, FinishStep, GradesStep, SemesterStep } from "./steps";
import { SyllabusStep } from "./syllabus";

interface StepDef {
  id: string;
  title: string;
  short: string;
  summary: ReactNode;
  done: boolean;
  optional?: boolean;
  pill?: string;
  body: ReactNode;
}

/** First-run setup, and the settings page afterwards. Every step works on its own. */
export function SetupView({ data, semesterSaved, feedLink }: { data: AppData; semesterSaved: boolean; feedLink: string | null }) {
  const all = data.courses;
  const visible = all.filter((c) => !c.hidden);
  const withSyllabus = visible.filter((c) => c.syllabus).length;
  const withGrades = visible.filter((c) => c.grades).length;
  const hasCourses = all.length > 0;

  const steps: StepDef[] = [
    {
      id: "canvas",
      title: "Connect Canvas",
      short: "Canvas",
      summary: data.feedConnected ? "Your assignments and due dates come from your Canvas calendar feed." : "Paste your Canvas calendar feed link so Termwise can see your assignments.",
      done: data.feedConnected,
      body: <FeedStep data={data} feedLink={feedLink} />,
    },
    {
      id: "semester",
      title: "Semester dates",
      short: "Dates",
      summary: semesterSaved ? `${shortDay(data.semester.start)} to ${shortDay(data.semester.end)}. Used for the heat map and Wrapped.` : "When classes start and end. Used for the heat map and Wrapped.",
      done: semesterSaved,
      body: <SemesterStep data={data} saved={semesterSaved} />,
    },
    {
      id: "courses",
      title: "Courses",
      short: "Courses",
      summary: hasCourses ? `${visible.length} shown${all.length > visible.length ? `, ${all.length - visible.length} hidden` : ""}.` : "Found automatically once Canvas is connected.",
      done: hasCourses,
      body: <CoursesStep courses={all} />,
    },
    {
      id: "syllabi",
      title: "Syllabi",
      short: "Syllabi",
      summary: hasCourses ? `${withSyllabus} of ${visible.length} added. Exam dates, class times and grade weights come from these.` : "Exam dates, class times and grade weights come from these.",
      done: visible.length > 0 && withSyllabus === visible.length,
      pill: visible.length > 0 && withSyllabus > 0 && withSyllabus < visible.length ? `${withSyllabus} of ${visible.length}` : undefined,
      body: <SyllabusStep courses={visible} />,
    },
    {
      id: "grades",
      title: "Grades",
      short: "Grades",
      summary: withGrades ? `${withGrades} of ${visible.length} courses have grades.` : "Paste your Canvas Grades page to see your grade and what you need on the final.",
      done: visible.length > 0 && withGrades === visible.length,
      optional: true,
      body: <GradesStep data={data} />,
    },
    {
      id: "finish",
      title: "Finish",
      short: "Finish",
      summary: data.setupDone ? "Setup is done. This page stays here as your settings." : "Head to your Updates feed.",
      done: data.setupDone,
      body: <FinishStep data={data} missingSyllabi={visible.length - withSyllabus} />,
    },
  ];

  const currentIdx = steps.findIndex((s) => !s.done && !s.optional);
  const status = (s: StepDef, i: number): StepStatus => (s.done ? "done" : i === currentIdx ? "current" : s.optional ? "optional" : "todo");
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;

  return (
    <div className="max-w-[880px]">
      <PageHeader title={data.setupDone ? "Setup & settings" : "Set up Termwise"} subtitle="Five minutes, once. Come back any time to change things." />

      <div className="mb-5 flex flex-col gap-3">
        {data.mode === "demo" && <DemoNotice />}

        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13.5px] font-medium text-ink">
              {doneCount === required.length ? "All steps done" : `${doneCount} of ${required.length} steps done`}
            </div>
            <div className="flex items-start gap-1.5 text-[12.5px] text-ink-3">
              <span className="mt-px shrink-0"><LockIcon size={14} /></span>
              <span>Everything stays on this computer. Only syllabus and grade text is sent to the Claude API to read it.</span>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={doneCount} aria-label="Setup progress">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(doneCount / required.length) * 100}%` }} />
          </div>
          <nav aria-label="Setup steps" className="-mx-1 mt-3 flex gap-1 overflow-x-auto pb-0.5">
            {steps.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={cx(
                  "flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium transition hover:bg-surface-2",
                  status(s, i) === "current" ? "text-ink" : "text-ink-2",
                  focusRing,
                )}
              >
                <StepBadge n={i + 1} status={status(s, i)} size="sm" />
                {s.short}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <ol className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={s.id}>
            <StepCard id={s.id} n={i + 1} title={s.title} summary={s.summary} status={status(s, i)} pill={s.pill}>
              {s.body}
            </StepCard>
          </li>
        ))}
      </ol>

    </div>
  );
}
