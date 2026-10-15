"use server";
import { revalidatePath } from "next/cache";
import { requireManager, requireTeaching } from "@/lib/auth/session";
import {
  teacherPermissionsSchema,
  type B2CPermission,
} from "../domain/teacher-permissions";
import { permissionRpc } from "./permission-rpc";
export type PermissionAdminData = {
  teachers: {
    id: string;
    full_name: string;
    source_teacher_id: string | null;
    account_name: string | null;
    active: boolean;
    permissions: B2CPermission[];
    updated_at: string | null;
  }[];
  accounts: { id: string; full_name: string }[];
};
export async function readB2CPermissionAdminAction() {
  await requireManager();
  return permissionRpc<PermissionAdminData>("read_b2c_permission_admin");
}
export async function saveB2CPermissionsAction(input: unknown) {
  await requireManager();
  const parsed = teacherPermissionsSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Quyền không hợp lệ." };
  const value = parsed.data;
  try {
    await permissionRpc("save_b2c_teacher_permissions", {
      p_teacher_id: value.teacher_id,
      p_source_teacher_id: value.source_teacher_id,
      p_permissions: value.permissions,
      p_expected_updated_at: value.expected_updated_at,
    });
    revalidatePath("/admin/b2c/teachers");
    revalidatePath("/teacher", "layout");
    return { success: "Đã lưu phân quyền giáo viên B2C." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Không lưu được phân quyền.",
    };
  }
}
export async function getMyB2CPermissionsAction() {
  await requireTeaching();
  return permissionRpc<B2CPermission[]>("get_my_b2c_permissions");
}
