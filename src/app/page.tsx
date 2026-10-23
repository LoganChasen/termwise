import { loadAppData } from "@/server/mode";
import { UpdatesView } from "@/views/updates/UpdatesView";

export default async function Page() {
  const data = await loadAppData();
  return <UpdatesView data={data} />;
}
