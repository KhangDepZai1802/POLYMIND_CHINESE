import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/permissions/routes";
import type { TuitionDashboardRow } from "../domain/tuition-dashboard";
import { permissionRpc } from "./permission-rpc";

export async function requireCenterTuitionAccess() {
  const user = await requireUser();
  if (!await permissionRpc<boolean>("has_b2c_permission", { p_key: "manage_center_tuition" }))
    redirect(homePathForRole(user.role));
  return user;
}

export async function readCenterTuitionDashboard() {
  await requireCenterTuitionAccess();
  const rows: TuitionDashboardRow[] = [];
  let expected: number | null = null;
  for (let page = 0; ; page++) {
    const batch = await permissionRpc<{ rows: TuitionDashboardRow[]; total: number }>("read_center_b2c_tuition_page", { p_query: "", p_page: page });
    if (!batch || !Array.isArray(batch.rows) || !Number.isInteger(batch.total)) throw new Error("Dữ liệu học phí chưa hợp lệ.");
    if (expected !== null && expected !== batch.total) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
    expected = batch.total;
    rows.push(...batch.rows);
    if (rows.length >= batch.total) break;
    if (!batch.rows.length) throw new Error("Chưa tải đủ danh sách học phí. Vui lòng thử lại.");
  }
  if (new Set(rows.map(r => r.enrollment_id)).size !== rows.length) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
  return rows;
}
