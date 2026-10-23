import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/permissions/routes";
import { permissionRpc } from "./permission-rpc";

export type StudentDataRow = {
  enrollment_id: string | null; student_id: string; code: string; full_name: string;
  phone: string | null; customer_source: string | null; referrer_name: string | null;
  class_id: string | null; class_name: string | null; teacher_name: string | null; salesperson: string | null;
  enrollment_date: string | null; learning_start_date: string | null; tuition_end_date: string | null;
  student_updated_at: string; enrollment_updated_at: string | null;
};
export async function requireStudentDataAccess() {
  const user = await requireUser();
  if (!await permissionRpc<boolean>("has_b2c_permission", { p_key: "manage_center_student_data" })) redirect(homePathForRole(user.role));
  return user;
}
