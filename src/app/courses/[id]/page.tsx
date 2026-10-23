import { notFound } from "next/navigation";
import { loadAppData } from "@/server/mode";
import { CourseDetail } from "@/views/courses/CourseDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadAppData();
  const course = data.courses.find((c) => c.id === id);
  if (!course) notFound();
  return <CourseDetail data={data} course={course} />;
}
