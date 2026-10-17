import type { Metadata } from "next";
import { TeacherTimetable } from "@/features/b2c/components/teacher-timetable";
import { getTeacherTimetable } from "@/features/b2c/server/teacher-timetable";
export const metadata: Metadata = { title: "Thời khóa biểu giáo viên" };
export const dynamic = "force-dynamic";
export default async function TimetablePage() {
  const data = await getTeacherTimetable();
  return <TeacherTimetable data={data} />;
}
