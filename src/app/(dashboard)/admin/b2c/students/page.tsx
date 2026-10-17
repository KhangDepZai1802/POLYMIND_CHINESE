import type { Metadata } from "next";
import { getStudentDashboard } from "@/features/b2c/server/student-dashboard";
import { StudentDashboard } from "@/features/b2c/components/student-dashboard";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Học viên" };
export default async function B2CStudentsPage() {
  const actor = await requireManager();
  return (
    <StudentDashboard
      data={await getStudentDashboard()}
      canViewHistory={actor.role === "super_admin"}
    />
  );
}
