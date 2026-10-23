import { computeWrapped } from "@/lib/wrapped";
import { loadAppData } from "@/server/mode";
import { WrappedView } from "@/views/wrapped/WrappedView";

export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const data = await loadAppData();
  const stats = computeWrapped(data, new Date(data.now));
  const slide = Number((await searchParams).slide);
  return <WrappedView stats={stats} feedConnected={data.feedConnected} initialSlide={Number.isFinite(slide) ? slide : 0} />;
}
