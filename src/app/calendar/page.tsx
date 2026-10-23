import { buildHeatmap } from "@/lib/heatmap";
import { shortDay } from "@/lib/format";
import { loadAppData } from "@/server/mode";
import { ButtonLink, Card, EmptyState, IconHeat, PageHeader } from "@/ui";
import { HeatmapView } from "@/views/heatmap/HeatmapView";
import type { HeatCourse, HeatItem } from "@/views/heatmap/shared";

export default async function Page() {
  const data = await loadAppData();
  const { semester } = data;
  const subtitle = `Estimated hours of work per day, ${shortDay(semester.start)} – ${shortDay(semester.end)}`;

  if (data.items.length === 0) {
    return (
      <>
        <PageHeader title="Heat map" subtitle={subtitle} />
        <Card>
          <EmptyState
            icon={<IconHeat size={20} />}
            title="Nothing to map yet"
            body="Connect your Canvas calendar feed and Termwise will estimate how heavy each day of your semester is."
            action={
              <ButtonLink href="/setup" variant="primary">
                Go to setup
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  }

  const items: HeatItem[] = data.items.map((i) => ({
    uid: i.uid,
    courseId: i.courseId,
    title: i.title,
    type: i.type,
    start: i.start,
    allDay: i.allDay,
    hours: i.hours,
    doneAt: i.doneAt,
    day: i.day,
  }));
  const courses: HeatCourse[] = data.courses.filter((c) => !c.hidden).map((c) => ({ id: c.id, name: c.name, color: c.color }));

  return (
    <>
      <PageHeader title="Heat map" subtitle={subtitle} />
      <HeatmapView initial={buildHeatmap(items, semester)} items={items} courses={courses} semester={semester} now={data.now} />
    </>
  );
}
