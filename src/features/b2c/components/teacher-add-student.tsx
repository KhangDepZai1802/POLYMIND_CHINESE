import { ClassStudentAddDialog } from "./class-student-add-dialog";
import { permissionRpc } from "../server/permission-rpc";
import { todayISO } from "@/lib/dates";

export async function TeacherAddStudent() {
  const allowed = await permissionRpc<boolean>("can_add_b2c_students");
  if (!allowed) return null;
  const classes = await permissionRpc<{ id: string; code: string; name: string; status: string }[]>("read_b2c_enrollment_classes");
  return <ClassStudentAddDialog classes={classes} today={todayISO()} />;
}
