"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTeaching } from "@/lib/auth/session";
import { monthlyCommentSchema, type MonthlyCommentsModel } from "../domain/monthly-comments";
import { permissionRpc } from "./permission-rpc";

export type MonthlyCommentDetail = {
  updated_at: string; status: "draft" | "ready"; message: string;
  recipients: { key: string; name: string; zalo: string | null; email: string | null }[];
  history_total: number; delivery_total: number;
  history: { id: string; actor_name: string; created_at: string; before_data: { status: string; content: Record<string, string> } | null; after_data: { status: string; content: Record<string, string> } }[];
  deliveries: { id: string; actor_name: string; created_at: string; channel: string; recipient_name: string; destination: string; message: string; report_updated_at: string }[];
};
export async function readMonthlyCommentsAction(input: unknown) {
  await requireTeaching("super_admin");
  const v = z.object({ classId: z.uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), page: z.number().int().min(0).max(1000000), query: z.string().trim().max(200) }).parse(input);
  return permissionRpc<MonthlyCommentsModel>("read_b2c_monthly_comments", { p_class_id: v.classId, p_month: v.month, p_page: v.page, p_query: v.query });
}
export async function readMonthlyCommentDetailAction(reportId: string, page: number) {
  await requireTeaching("super_admin");
  const v = z.object({ reportId: z.uuid(), page: z.number().int().min(0).max(1000000) }).parse({ reportId, page });
  return permissionRpc<MonthlyCommentDetail>("read_b2c_monthly_comment_detail", { p_report_id: v.reportId, p_page: v.page });
}
export async function saveMonthlyCommentAction(input: unknown) {
  await requireTeaching("super_admin");
  const p = monthlyCommentSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Kiểm tra nhận xét." };
  try {
    const id = await permissionRpc<string>("write_b2c_monthly_comment", { p_action: "save", p_data: p.data });
    revalidatePath("/admin/b2c", "layout"); revalidatePath(`/teacher/b2c-classes/${p.data.class_id}`);
    return { id };
  } catch (e) { return { error: e instanceof Error ? e.message : "Không lưu được nhận xét." }; }
}
export async function confirmMonthlyCommentDeliveryAction(input: unknown) {
  await requireTeaching("super_admin");
  const p = z.object({ request_id: z.uuid(), class_id: z.uuid(), report_id: z.uuid(), expected_updated_at: z.string(), expected_message: z.string().min(1).max(12000), expected_destination: z.string().min(1).max(254), channel: z.enum(["zalo", "email"]), recipient_key: z.union([z.uuid(), z.literal("guardian")]), confirmed: z.literal(true) }).safeParse(input);
  if (!p.success) return { error: "Chọn phụ huynh, kênh và xác nhận đã gửi thủ công." };
  try {
    const id = await permissionRpc<string>("write_b2c_monthly_comment", { p_action: "confirm_delivery", p_data: p.data });
    revalidatePath("/admin/b2c", "layout"); revalidatePath(`/teacher/b2c-classes/${p.data.class_id}`);
    return { id };
  } catch (e) { return { error: e instanceof Error ? e.message : "Không ghi nhận được lần gửi." }; }
}
