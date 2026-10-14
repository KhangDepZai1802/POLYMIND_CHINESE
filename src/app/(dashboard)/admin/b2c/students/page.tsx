import type { Metadata } from "next";
import { getStudentDashboard } from "@/features/b2c/server/student-dashboard";
import { StudentDashboard } from "@/features/b2c/components/student-dashboard";

export const metadata: Metadata = { title: "Học viên B2C" };
export default async function B2CStudentsPage() {
  return <StudentDashboard data={await getStudentDashboard()} />;
}
