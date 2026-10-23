import { formatPercent } from "@/lib/format";
import type { AppData } from "@/server/model";
import { ButtonLink, Card, EmptyState, IconCourses, PageHeader } from "@/ui";
import { CourseCard } from "./CourseCard";
import { WEEKDAYS } from "./shared";
import { WeekSchedule, type ScheduleCourse } from "./WeekSchedule";

export function CoursesOverview({ data }: { data: AppData }) {
  const now = new Date(data.now);
  const courses = data.courses.filter((c) => !c.hidden);

  if (courses.length === 0) {
    return (
      <>
        <PageHeader title="Courses" />
        <Card>
          <EmptyState
            icon={<IconCourses />}
            title="No courses yet"
            body="Connect your Canvas calendar feed and your courses show up here, with grades and class times once you add them."
            action={<ButtonLink href="/setup" variant="primary">Go to Setup</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  const graded = courses.filter((c) => c.grade?.percent != null);
  const avg = graded.length ? graded.reduce((s, c) => s + c.grade!.percent!, 0) / graded.length : null;
  const missingSyllabus = courses.filter((c) => !c.syllabus).length;
  const missingGrades = courses.filter((c) => !c.grades).length;

  const schedule: ScheduleCourse[] = courses.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    meetings: c.syllabus?.meetings ?? [],
    officeHours: c.syllabus?.officeHours ?? [],
  }));
  const dow = (now.getDay() + 6) % 7;
  const todayIndex = dow < WEEKDAYS.length ? dow : -1;

  const subtitle = [
    `${courses.length} ${courses.length === 1 ? "course" : "courses"}`,
    avg !== null ? `${formatPercent(avg)} average across ${graded.length === courses.length ? "all of them" : `${graded.length} graded`}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle={subtitle}
        actions={
          (missingSyllabus > 0 || missingGrades > 0) && (
            <ButtonLink href="/setup" size="sm">
              {missingSyllabus > 0 ? "Add missing syllabi" : "Paste missing grades"}
            </ButtonLink>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} items={data.items} now={now} />
        ))}
      </div>
      <div className="mt-8">
        <WeekSchedule courses={schedule} todayIndex={todayIndex} />
      </div>
    </>
  );
}
