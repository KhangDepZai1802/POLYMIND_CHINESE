import type { Metadata } from "next";
import {
  getMyClasses,
  getPendingGrading,
  getSessionsNeedingAttendance,
  getTeacherAtRiskStudents,
  getTeacherSessionsToday,
} from "@/features/dashboard/server/teacher-queries";
import { requireTeaching } from "@/lib/auth/session";
import {
  getMyB2CClasses,
  getMyB2CToday,
} from "@/features/b2c/server/teacher-class-queries";
import { getB2CClassesToday } from "@/features/b2c/domain/teacher-today";
import { TeacherHomeDashboard } from "@/features/dashboard/components/teacher-home-dashboard";
import { getMyB2CPermissionsAction } from "@/features/b2c/server/permission-actions";
export const metadata: Metadata = { title: "Hôm nay" };
export default async function TeacherDashboardPage() {
  const [
    user,
    today,
    needAttendance,
    pendingGrading,
    atRisk,
    myClasses,
    b2cClasses,
    b2cMeetings,
    b2cPermissions,
  ] = await Promise.all([
    requireTeaching(),
    getTeacherSessionsToday(),
    getSessionsNeedingAttendance(),
    getPendingGrading(),
    getTeacherAtRiskStudents(),
    getMyClasses(),
    getMyB2CClasses(),
    getMyB2CToday(),
    getMyB2CPermissionsAction(),
  ]);
  const now = new Date();
  const b2cToday = getB2CClassesToday(
    b2cClasses.filter((c) => !b2cMeetings.override_class_ids.includes(c.id)),
    now,
  );
  const todayCount =
    today.length +
    b2cToday.length +
    b2cMeetings.rows.filter((m) => m.status !== "cancelled").length;
  return (
    <TeacherHomeDashboard
      fullName={user.fullName}
      now={now.toISOString()}
      today={today}
      needAttendance={needAttendance}
      pendingGrading={pendingGrading}
      atRisk={atRisk}
      myClasses={myClasses}
      b2cClasses={b2cClasses}
      b2cToday={b2cToday}
      meetings={b2cMeetings.rows}
      todayCount={todayCount}
      canMarkB2CAttendance={b2cPermissions.includes("mark_attendance")}
    />
  );
}
