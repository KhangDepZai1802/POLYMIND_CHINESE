import "server-only";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { B2CTuitionRow } from "../tuition-schema";
import type { TuitionDashboardRow } from "../domain/tuition-dashboard";

export async function readTuitionDashboard(): Promise<TuitionDashboardRow[]> {
  await requireManager();
  const client = await createClient();
  const rows: B2CTuitionRow[] = [];
  let expected: number | null = null;
  // Reuse the effective-balance RPC, including cancellations/refunds/adjustments.
  for (let page = 0; ; page++) {
    const { data, error } = await client.rpc("get_b2c_tuition_page", { p_query: "", p_page: page });
    if (error) throw new Error("Không tải được học phí. Vui lòng thử lại.");
    const batch = data as unknown as { rows: B2CTuitionRow[]; total: number };
    if (!batch || !Array.isArray(batch.rows) || !Number.isInteger(batch.total)) throw new Error("Dữ liệu học phí chưa hợp lệ.");
    if (expected !== null && expected !== batch.total) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
    expected = batch.total;
    rows.push(...batch.rows);
    if (rows.length >= batch.total) break;
    if (!batch.rows.length) throw new Error("Chưa tải đủ danh sách học phí. Vui lòng thử lại.");
  }
  if (new Set(rows.map(r => r.enrollment_id)).size !== rows.length) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
  const details = new Map<string, { class_id: string; enrollment_date: string | null; tuition_end_date: string | null; status: string }>();
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await client.from("b2c_enrollments").select("id,class_id,enrollment_date,tuition_end_date,status").in("id", rows.slice(i, i + 200).map(r => r.enrollment_id));
    if (error) throw new Error("Không tải được kỳ ghi danh và hạn học phí.");
    for (const row of data ?? []) details.set(row.id, row);
  }
  return rows.map(row => {
    const detail = details.get(row.enrollment_id);
    if (!detail) throw new Error("Ghi danh vừa thay đổi. Vui lòng tải lại.");
    return { ...row, ...detail };
  });
}
