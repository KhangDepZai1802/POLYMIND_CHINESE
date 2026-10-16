import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireManager } from "@/lib/auth/session";
import { getB2CTeacherMetrics } from "@/features/b2c/server/teacher-metrics";
import { TeacherDashboard } from "@/features/b2c/components/teacher-dashboard";

export const metadata: Metadata = { title: "Giáo viên B2C" };
export default async function TeachersPage() {
  const me = await requireManager();
  const metrics = await getB2CTeacherMetrics();
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button asChild variant="outline">
          <Link href="/admin/b2c/timetable">Xem thời khóa biểu giáo viên</Link>
        </Button>
      </div>
      <TeacherDashboard
        rows={[...metrics.values()]}
        initialMonth={month}
        canManageAccounts={me.role === "super_admin"}
      />
    </>
  );
}
