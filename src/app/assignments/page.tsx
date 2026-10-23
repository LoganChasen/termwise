import { loadAppData } from "@/server/mode";
import { AssignmentsView } from "@/views/assignments/AssignmentsView";

export default async function Page() {
  const data = await loadAppData();
  return <AssignmentsView items={data.items} courses={data.courses} now={data.now} setupDone={data.setupDone} />;
}
