"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/session";
import { certificateFiltersSchema, certificateResultSchema, type CertificateResultsModel, type CertificateStudent, type CertificateMarketingRow } from "../domain/certificate-results";
import { permissionRpc } from "./permission-rpc";

export async function readCertificateResultsAction(input: unknown) {
  await requireManager();
  return permissionRpc<CertificateResultsModel>("read_b2c_certificate_results", { p_filters: certificateFiltersSchema.parse(input), p_limit: 25 });
}
export async function findCertificateStudentsAction(query: string, page: number) {
  await requireManager();
  const v = z.object({ query: z.string().trim().min(1).max(200), page: z.number().int().min(0).max(1000000) }).parse({ query, page });
  return permissionRpc<{ rows: CertificateStudent[]; total: number }>("find_b2c_certificate_students", { p_query: v.query, p_page: v.page });
}
export async function saveCertificateResultAction(input: unknown) {
  await requireManager();
  const p = certificateResultSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Kiểm tra kết quả chứng chỉ." };
  try {
    const id = await permissionRpc<string>("write_b2c_certificate_result", { p_action: "save", p_data: p.data });
    revalidatePath("/admin/b2c/certificates");
    return { id };
  } catch (e) { return { error: e instanceof Error ? e.message : "Không lưu được kết quả." }; }
}
export async function archiveCertificateResultAction(input: unknown) {
  await requireManager();
  const p = z.object({ request_id: z.uuid(), id: z.uuid(), expected_updated_at: z.string(), action: z.enum(["archive", "restore"]) }).safeParse(input);
  if (!p.success) return { error: "Chọn kết quả cần lưu trữ/khôi phục." };
  try {
    await permissionRpc("write_b2c_certificate_result", { p_action: p.data.action, p_data: p.data });
    revalidatePath("/admin/b2c/certificates"); return { success: true };
  } catch (e) { return { error: e instanceof Error ? e.message : "Không cập nhật được kết quả." }; }
}
export async function readCertificateHistoryAction(id: string, page: number) {
  await requireManager();
  const p = z.object({ id: z.uuid(), page: z.number().int().min(0).max(1000000) }).parse({ id, page });
  return permissionRpc<{ rows: { id: string; action: string; before_data: Record<string, unknown> | null; after_data: Record<string, unknown>; actor_name: string; created_at: string }[]; total: number }>("read_b2c_certificate_history", { p_result_id: p.id, p_page: p.page });
}
export async function exportCertificateMarketingAction(input: unknown): Promise<{ rows?: CertificateMarketingRow[]; error?: string }> {
  await requireManager();
  const p = certificateFiltersSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Bộ lọc không hợp lệ." };
  try {
    // Always select active marketing-approved records, regardless of client filters.
    const data = await permissionRpc<CertificateResultsModel>("read_b2c_certificate_results", { p_filters: { ...p.data, marketing: "yes", archived: false, page: 0 }, p_limit: 5000 });
    if (data.total > 5000) return { error: "Có hơn 5.000 kết quả. Thu hẹp loại chứng chỉ hoặc khoảng ngày trước khi xuất." };
    return { rows: data.rows.map(({ student_code, full_name, certificate_type, level, score, exam_date }) => ({ student_code, full_name, certificate_type, level, score, exam_date })) };
  } catch (e) { return { error: e instanceof Error ? e.message : "Không xuất được dữ liệu marketing." }; }
}
