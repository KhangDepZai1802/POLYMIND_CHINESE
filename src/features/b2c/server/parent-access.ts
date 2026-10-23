import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/permissions/routes";
import { permissionRpc } from "./permission-rpc";
import type { ParentDashboardRow } from "../domain/parent-dashboard";

export async function requireB2CParentAccess() {
  const user = await requireUser();
  if (!await permissionRpc<boolean>("can_manage_b2c_parents")) redirect(homePathForRole(user.role));
  return user;
}

export async function readTeacherParentDashboard() {
  await requireB2CParentAccess();
  const parents: ParentDashboardRow[] = [];
  let expected: number | null = null;
  for (let page = 0; ; page++) {
    const batch = await permissionRpc<{ parents: ParentDashboardRow[]; total: number }>("read_teacher_b2c_parents_page", { p_query: "", p_page: page });
    if (!batch || !Array.isArray(batch.parents) || !Number.isInteger(batch.total)) throw new Error("Dữ liệu phụ huynh chưa hợp lệ.");
    if (expected !== null && expected !== batch.total) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
    expected = batch.total;
    parents.push(...batch.parents);
    if (parents.length >= batch.total) break;
    if (!batch.parents.length) throw new Error("Chưa tải đủ danh sách phụ huynh.");
  }
  if (new Set(parents.map(p => p.id)).size !== parents.length) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
  return parents;
}
