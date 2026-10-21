"use server";
import { revalidateB2CViews } from "./revalidate-views";
import { requireTeaching } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { scheduleSchema } from "../domain/structured-schedule";
export async function generateB2CScheduleAction(input: unknown) {
  await requireTeaching("super_admin");
  const p = scheduleSchema.safeParse(input);
  if (!p.success)
    return {
      error: p.error.issues[0]?.message ?? "Kiểm tra thứ, ngày và giờ học.",
    };
  const { data, error } = await (
    await createClient()
  ).rpc("generate_b2c_class_schedule", { p_data: p.data });
  if (error)
    return {
      error: ["P0001", "22023", "23514"].includes(error.code)
        ? error.message
        : error.code === "23P01"
          ? "Phòng đã có lịch trùng giờ. Chưa lưu thay đổi."
          : "Không sinh được buổi học. Tải lại và thử lại.",
    };
  revalidateB2CViews();
  const r = data as { created: number; skipped: number; retry: boolean };
  return {
    success: r.retry
      ? "Yêu cầu này đã được xử lý; không tạo thêm buổi."
      : `Đã tạo ${r.created} buổi, bỏ qua ${r.skipped} buổi đã có.`,
  };
}
