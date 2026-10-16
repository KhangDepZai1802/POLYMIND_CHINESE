import "server-only";
import { requireTeaching } from "@/lib/auth/session";
import { getMyB2CPermissionsAction } from "./permission-actions";
import {
  getMyB2CToday,
  type TeacherB2CMeetingToday,
} from "./teacher-class-queries";

export type B2CAttendanceOptions = {
  allowed: boolean;
  meetings: TeacherB2CMeetingToday[];
};
export async function getB2CAttendanceOptions(): Promise<B2CAttendanceOptions | null> {
  const actor = await requireTeaching("super_admin");
  if (actor.role !== "teacher" && actor.role !== "academic_manager")
    return null;
  const permissions = await getMyB2CPermissionsAction();
  if (!permissions.includes("mark_attendance"))
    return { allowed: false, meetings: [] };
  const data = await getMyB2CToday();
  return {
    allowed: true,
    meetings: data.rows.filter((m) => m.status !== "cancelled"),
  };
}
