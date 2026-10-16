import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

// Forward migration RPCs, typed here until the next full database type generation.
type PermissionRpc =
  | "add_b2c_class_student"
  | "find_b2c_enrollment_students"
  | "correct_b2c_tuition"
  | "save_b2c_tuition_package_with_reason"
  | "read_b2c_tuition_corrections"
  | "get_my_b2c_permissions"
  | "has_b2c_permission"
  | "read_b2c_permission_admin"
  | "save_b2c_teacher_permissions"
  | "read_teacher_b2c_workspace"
  | "read_b2c_permitted_receipts"
  | "save_teacher_b2c_class"
  | "read_teacher_b2c_class_edit"
  | "read_teacher_b2c_student_edit"
  | "save_teacher_b2c_student";
export async function permissionRpc<T>(
  name: PermissionRpc,
  args: Record<string, Json | undefined> = {},
): Promise<T> {
  const client = await createClient();
  const { data, error } = await client.rpc(name as never, args as never);
  if (error)
    throw new Error(
      ["42501", "40001", "P0001", "22023", "23505", "23514"].includes(
        error.code,
      )
        ? error.message
        : "Không xử lý được yêu cầu B2C. Vui lòng thử lại.",
    );
  return data as T;
}
