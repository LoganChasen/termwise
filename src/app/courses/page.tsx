import { loadAppData } from "@/server/mode";
import { CoursesOverview } from "@/views/courses/CoursesOverview";

export default async function Page() {
  const data = await loadAppData();
  return <CoursesOverview data={data} />;
}
