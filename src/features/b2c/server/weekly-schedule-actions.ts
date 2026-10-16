"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  WEEKLY_DAYS,
  weeklyScheduleSchema,
  serializeWeeklySlots,
} from "../domain/weekly-schedule";

export async function readWeeklyScheduleAction(classId: string) {
  await requireManager();
  const id = z.uuid().parse(classId),
    client = await createClient();
  const result = await client
    .from("b2c_classes")
    .select("id,teacher_name,weekdays_text,time_text,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (result.error || !result.data)
    throw new Error("Không tải được lịch tuần của lớp.");
  return result.data;
}

export async function saveWeeklyScheduleAction(input: unknown) {
  await requireManager();
  const parsed = weeklyScheduleSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Kiểm tra thứ và giờ học.",
    };
  const v = parsed.data,
    client = await createClient();
  const { data, error } = await client
    .from("b2c_classes")
    .update({
      teacher_name: v.teacher_name,
      weekdays_text: WEEKLY_DAYS.filter((d) =>
        v.slots.some((s) => s.day === d),
      ).join("-"),
      time_text: serializeWeeklySlots(v.slots),
    })
    .eq("id", v.class_id)
    .eq("updated_at", v.expected_updated_at)
    .select("id")
    .maybeSingle();
  if (error)
    return { error: "Không lưu được lịch tuần. Vui lòng tải lại và thử lại." };
  if (!data)
    return {
      error:
        "Thông tin lớp đã thay đổi hoặc bạn không có quyền sửa. Đóng và mở lại cửa sổ để tải dữ liệu mới.",
    };
  revalidatePath("/admin/b2c", "layout");
  revalidatePath("/teacher", "layout");
  return { success: "Đã lưu lịch học hằng tuần." };
}
